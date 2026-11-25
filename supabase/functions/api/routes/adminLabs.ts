// The team's side of the blood test (23 Nov 2026 call). About a third of patients do not book by themselves, or
// need a day the app does not offer (patients book tomorrow or the day after only), or need a booking moved or
// cancelled: someone on the team calls them and does it here. Mounted at /api. Every route: role ADMIN only.
//   GET   /admin/pipeline                             who to call next, by where they are stuck
//   GET   /admin/patients/:patientId/lab              what a booking needs: the person, their addresses, the price, their bookings
//   POST  /admin/patients/:patientId/lab/credit       { paymentRef } paid outside the app, nothing booked yet: they hold the credit
//   DELETE /admin/patients/:patientId/lab/credit      that payment was refunded
//   GET   /admin/lab/places?q=                        address search (for a patient with no address on the map yet)
//   POST  /admin/patients/:patientId/addresses        { addressLine, pincode, city?, state?, landmark?, eloc } saves one, placed on the map
//   GET   /admin/patients/:patientId/lab/slots?addressId=&date=   free collection times, today up to 4 days ahead
//   POST  /admin/patients/:patientId/lab/bookings     { addressId, collectionDate, slotId, person: { name, age, gender } }
//                                                     holds the time for 30 minutes; it waits for payment in the app, on a
//                                                     link, or is marked paid
//   POST  /admin/lab-bookings/:id/payment-link        a payment link for a held booking
//   POST  /admin/lab-bookings/:id/paid                { paymentRef } the money was taken another way: confirms the booking
//   POST  /admin/lab-bookings/:id/move                { collectionDate, slotId }
//   POST  /admin/lab-bookings/:id/cancel              { reason, refunded? } refunded: the money went back (in Razorpay), so
//                                                     it is not kept as credit for a new time
import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "../lib/db.ts";
import { body, fail, intParam, ok } from "../lib/http.ts";
import { requireDesk, requireUser, works } from "../lib/auth.ts";
import * as rc from "../integrations/redcliffe.ts";
import { bookingQuery, cancelBookingFor, expireHolds, fulfilLabBooking, giveCreditBack, holdBooking, moveBooking, toLabBooking } from "./labs.ts";
import * as links from "../lib/paymentLinks.ts";
import * as notices from "../lib/notices.ts";
import { sendNow } from "../lib/notify.ts";

export const adminLabRoutes = new Hono();

/** The blood test desk (the operations team), or an admin. */
const admin = (c: Context) => requireDesk(c, "BLOOD_TESTS");
const name = sql`coalesce(nullif(trim(concat_ws(' ', pp.first_name, pp.last_name)), ''), pu.full_name, 'Patient ' || pu.id)`;
const iso = (col: string) => sql`to_char(${sql(col)} at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"')`;
/** The lab's own errors (a time just taken, an address it does not reach) in words admin can act on. */
const lab = <T>(work: Promise<T>) => work.catch((e) => (e instanceof rc.RedcliffeError ? fail(422, e.message) : Promise.reject(e)));

async function patient(id: number) {
  const [p] = await sql`select pu.id, pu.mobile, pu.email, ${name} as name, pp.age_years, pp.gender
                        from users pu left join patient_profiles pp on pp.user_id = pu.id where pu.id = ${id} and pu.role = 'PATIENT'`;
  return p ?? fail(404, "That patient was not found.");
}

async function booking(id: string) {
  const [row] = await bookingQuery(sql, id.slice(0, 40));
  if (!row) fail(404, "That blood test booking was not found.");
  await expireHolds(row.user_id);
  return (await bookingQuery(sql, row.id))[0];
}

/** A booking as the team sees it: the patient's view, with who booked it and what needs sorting out. */
// deno-lint-ignore no-explicit-any
const view = (r: Record<string, any>) => {
  const b = toLabBooking(r);
  return { id: b.id, status: b.status, addressId: b.addressId ? String(b.addressId) : null, startsAt: b.collectionStartsAt, endsAt: b.collectionEndsAt, address: b.address, person: b.patient,
    totalRupees: b.price.total, holdExpiresAt: b.holdExpiresAt, reschedulesLeft: b.reschedulesLeft, paid: Boolean(r.paid_at),
    bookedByTeam: Boolean(r.booked_by), needsAttention: r.needs_attention ?? null };
};

// ---------------------------------------------------------------- who to call

adminLabRoutes.get("/admin/pipeline", async (c) => {
  // every desk has its own lists here; an admin sees them all
  const me = await requireUser(c, "OPS");
  const none = Promise.resolve([]);
  // each list is its own plain query, one after the other: a fresh piece of SQL every time, never one shared
  // between queries that run at once
  const base = () => sql`pu.id::text as "patientId", ${name} as "patientName", pu.mobile as "patientMobile", pp.salesperson`;
  const from = () => sql`from users pu left join patient_profiles pp on pp.user_id = pu.id left join eligibility e on e.user_id = pu.id`;
  const lists = [
    // signed up and gone quiet before a blood test: no test booked and no report of their own sent in
    sql`select ${base()}, ${iso("pu.created_at")} as since,
          exists (select 1 from lab_bookings b where b.user_id = pu.id and b.status = 'PAYMENT_PENDING' and b.hold_expires_at > now()) as holding
        ${from()}
        where pu.role = 'PATIENT' and pu.onboarding_completed and coalesce(e.stage, 'NOT_STARTED') in ('NOT_STARTED', 'AWAITING_PAYMENT')
          and not coalesce(e.lab_credit, false)
          and not exists (select 1 from reports r where r.user_id = pu.id)
          and not exists (select 1 from appointments a where a.patient_id = pu.id and a.status <> 'Cancelled')
          and pu.created_at > now() - interval '45 days'
        order by pu.created_at desc limit 150`,
    // paid, and no collection booked: the ones the team calls first (they did not book in their two days, or their
    // collection was cancelled). Booked for them on the call, at no charge.
    sql`select ${base()}, ${iso("e.lab_paid_at")} as since ${from()}
        where pu.role = 'PATIENT' and e.lab_credit order by e.lab_paid_at nulls last limit 150`,
    // a paid test that is not happening as booked: the lab cancelled it, or refused it after the payment
    sql`select ${base()}, b.id as "bookingId", coalesce(b.needs_attention, 'The collection was cancelled after it was paid for. Book a new time.') as why,
          ${iso("b.updated_at")} as since
        ${from()} join lab_bookings b on b.id = e.lab_booking_id
        where pu.role = 'PATIENT' and b.paid_at is not null and e.stage in ('LAB_SCHEDULED', 'AWAITING_PAYMENT')
          and (b.needs_attention is not null or b.status in ('CANCELLED', 'EXPIRED'))
        order by b.updated_at desc limit 100`,
    // the report is in: the team calls and books the doctor (the review may still be running)
    sql`select ${base()}, e.stage, ${iso("e.updated_at")} as since
        ${from()}
        where pu.role = 'PATIENT' and e.stage in ('UNDER_REVIEW', 'APPROVED')
          and not exists (select 1 from appointments a where a.patient_id = pu.id and a.status <> 'Cancelled')
        order by e.updated_at limit 150`,
    // seen by the doctor, not on a plan: the salesperson's to close
    sql`select ${base()}, to_char(lc.at, 'YYYY-MM-DD') as "lastOn",
          exists (select 1 from payment_links l where l.patient_id = pu.id and l.status = 'CREATED' and l.purpose = 'PLAN') as "linkWaiting"
        ${from()}
        join lateral (select max(s.slot_date + s.start_time) as at from appointments a join doctor_slots s on s.id = a.slot_id
          where a.patient_id = pu.id and a.status = 'Completed') lc on lc.at is not null
        where pu.role = 'PATIENT' and lc.at > (now() at time zone 'Asia/Kolkata') - interval '60 days'
          and not exists (select 1 from subscriptions sb where sb.user_id = pu.id and sb.status = 'Active' and sb.ends_at > now())
        order by lc.at desc limit 150`,
    // paid for a plan and still without a health coach: assign one, so the first call can happen
    sql`select ${base()}, pl.name as "planName", ${iso("sb.starts_at")} as since
        ${from()} join subscriptions sb on sb.user_id = pu.id and sb.status = 'Active' and sb.ends_at > now() join plans pl on pl.id = sb.plan_id
        where pu.role = 'PATIENT' and pp.coach_id is null order by sb.starts_at limit 150`,
  ];
  const lab = works(me, "BLOOD_TESTS"), dc = works(me, "CONSULTATIONS"), all = me.role === "ADMIN";
  const bloodTest = await (lab ? lists[0] : none), paidNoTest = await (lab ? lists[1] : none), labProblem = await (lab ? lists[2] : none);
  const consultation = await (dc ? lists[3] : none), plan = await (all ? lists[4] : none), coach = await (all ? lists[5] : none);
  return ok(c, { bloodTest, paidNoTest, labProblem, consultation, plan, coach });
});

// ---------------------------------------------------------------- booking a blood test for a patient

adminLabRoutes.get("/admin/patients/:patientId/lab", async (c) => {
  const me = await admin(c);
  const p = await patient(intParam(c.req.param("patientId"), "patient"));
  await expireHolds(p.id);
  const [credit] = await sql`select lab_credit from eligibility where user_id = ${p.id}`;
  const [addresses, [care], bookings] = await Promise.all([
    sql`select id, line1, city, pincode, (latitude is not null and longitude is not null) as placed from addresses
        where user_id = ${p.id} order by is_default desc, created_at desc`,
    sql`select code, name, price_rupees, lab_package_code from care_packages where includes_lab_tests and lab_package_code is not null order by price_rupees limit 1`,
    sql`select b.*, a.line1, a.line2, a.city, a.state, a.pincode from lab_bookings b left join addresses a on a.id = b.address_id
        where b.user_id = ${p.id} order by b.created_at desc limit 8`,
  ]);
  await sql`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${me.id}, 'Viewed blood test bookings (care team)')`;
  return ok(c, {
    person: { name: p.name.startsWith("Patient ") ? "" : p.name, age: p.age_years ?? null, gender: p.gender ?? null },
    addresses: addresses.map((a) => ({ id: String(a.id), line: [a.line1, a.city, a.pincode].filter(Boolean).join(", "), placed: a.placed })),
    priceRupees: care?.price_rupees ?? null,
    // paid for already, with no collection on it: a time booked now is confirmed at once, at no charge
    credit: Boolean(credit?.lab_credit),
    bookings: bookings.map(view),
  });
});

/**
 * The blood tests were paid for outside the app (a payment link from Razorpay's own dashboard, a transfer) before
 * any time was booked: the payment ID is recorded and the patient holds the credit, so they or the team book the
 * collection at no charge. DELETE takes it back when the money was refunded.
 */
adminLabRoutes.post("/admin/patients/:patientId/lab/credit", async (c) => {
  const me = await admin(c);
  const p = await patient(intParam(c.req.param("patientId"), "patient"));
  const ref = String((await body<{ paymentRef?: unknown }>(c)).paymentRef ?? "").trim().slice(0, 80);
  if (ref.length < 4) fail(400, "Add the payment ID of the money received.");
  const [care] = await sql`select code, name, price_rupees from care_packages where includes_lab_tests and lab_package_code is not null order by price_rupees limit 1`;
  if (!care) fail(409, "No blood test package is on sale.");
  const [e] = await sql`select lab_credit, stage from eligibility where user_id = ${p.id}`;
  if (e?.lab_credit) fail(409, "This patient has already paid. Book their blood test.");
  if (["LAB_SCHEDULED", "SAMPLE_COLLECTED", "UNDER_REVIEW", "APPROVED"].includes(e?.stage)) fail(409, "Their blood tests are already under way.");
  const [used] = await sql`select 1 from payment_orders where provider_payment_id = ${ref} union all select 1 from plan_recommendations where payment_ref = ${ref} limit 1`;
  if (used) fail(409, "That payment ID has been used already.");
  await sql.begin(async (tx) => {
    const [{ n }] = await tx`select nextval('invoice_seq') as n`;
    await tx`insert into payment_orders (id, user_id, purpose, reference_id, amount_paise, title, line_items, status, provider,
               provider_payment_id, paid_at, invoice_number, fulfilled_at, meta)
             values (${`team_care_${p.id}_${Date.now().toString(36)}`}, ${p.id}, 'CARE_PACKAGE', ${care.code}, ${care.price_rupees * 100}, ${care.name},
               ${tx.json([{ label: care.name, amountPaise: care.price_rupees * 100 }])}, 'PAID', ${ref.startsWith("pay_") ? "razorpay" : "mock"},
               ${ref}, now(), ${`INR-${new Date().getUTCFullYear()}-${String(n).padStart(6, "0")}`}, now(), ${tx.json({ paidOutside: true, recordedBy: me.id })})`;
    await tx`insert into eligibility (user_id, path, consultation_paid, lab_credit, lab_paid_at) values (${p.id}, 'LAB_TEST', true, true, now())
             on conflict (user_id) do update set path = 'LAB_TEST', consultation_paid = true, lab_credit = true, lab_paid_at = now(), updated_at = now()`;
    await tx`update received_payments set used_for_patient = ${p.id}, used_at = now() where id = ${ref}`;
    await tx`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${me.id}, ${`Blood tests marked paid outside the app (${ref})`})`;
  });
  return ok(c, null, "Marked paid. Their blood test can be booked now, at no charge.");
});

adminLabRoutes.delete("/admin/patients/:patientId/lab/credit", async (c) => {
  const me = await admin(c);
  const p = await patient(intParam(c.req.param("patientId"), "patient"));
  const [e] = await sql`update eligibility set lab_credit = false, lab_paid_at = null, consultation_paid = false, updated_at = now()
                        where user_id = ${p.id} and lab_credit and not consultation_used returning user_id`;
  if (!e) fail(409, "This patient has no payment waiting for a booking.");
  await sql`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${me.id}, 'Blood test payment marked refunded')`;
  return ok(c, null, "Marked refunded.");
});

adminLabRoutes.get("/admin/lab/places", async (c) => {
  await admin(c);
  return ok(c, await lab(rc.searchPlaces(c.req.query("q") ?? "", null)));
});

adminLabRoutes.post("/admin/patients/:patientId/addresses", async (c) => {
  const me = await admin(c);
  const p = await patient(intParam(c.req.param("patientId"), "patient"));
  const b = await body<Record<string, unknown>>(c);
  const line = String(b.addressLine ?? "").trim().slice(0, 300);
  const pincode = String(b.pincode ?? "").trim();
  if (line.length < 5) fail(400, "Enter the house, street and area.");
  if (!/^[1-9]\d{5}$/.test(pincode)) fail(400, "Enter a valid 6-digit pincode.");
  // placed on the map from the place chosen in the search, and checked that collections reach it
  const at = await lab(rc.coordinates(String(b.eloc ?? "")));
  const reach = await lab(rc.serviceability(at.latitude, at.longitude));
  if (!reach.serviceable) fail(422, "Home collection does not reach this address yet.");
  const words = (v: unknown) => String(v ?? "").trim().slice(0, 120) || null;
  const [row] = await sql`
    insert into addresses (user_id, line1, landmark, city, state, pincode, latitude, longitude, eloc, is_default)
    values (${p.id}, ${line}, ${words(b.landmark)}, ${words(b.city)}, ${words(b.state)}, ${pincode}, ${at.latitude}, ${at.longitude}, ${words(b.eloc)},
      not exists (select 1 from addresses where user_id = ${p.id}))
    returning id`;
  await sql`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${me.id}, 'Added an address for the patient')`;
  return ok(c, { addressId: String(row.id) }, "Address saved");
});

adminLabRoutes.get("/admin/patients/:patientId/lab/slots", async (c) => {
  await admin(c);
  const p = await patient(intParam(c.req.param("patientId"), "patient"));
  const [a] = await sql`select latitude, longitude from addresses where id = ${Number(c.req.query("addressId")) || 0} and user_id = ${p.id}`;
  if (!a) fail(404, "That address was not found.");
  if (a.latitude == null || a.longitude == null) fail(400, "This address is not on the map. Add it again from the search.");
  return ok(c, await lab(rc.slots(c.req.query("date") ?? "", Number(a.latitude), Number(a.longitude))));
});

adminLabRoutes.post("/admin/patients/:patientId/lab/bookings", async (c) => {
  const me = await admin(c);
  const p = await patient(intParam(c.req.param("patientId"), "patient"));
  const b = await body<{ addressId?: unknown; collectionDate?: unknown; slotId?: unknown; person?: { name?: unknown; age?: unknown; gender?: unknown } }>(c);
  const [care] = await sql`select code, lab_package_code from care_packages where includes_lab_tests and lab_package_code is not null order by price_rupees limit 1`;
  if (!care) fail(409, "No blood test package is on sale.");
  // a test that is booked and under way is moved, not booked again. One that was paid for but never confirmed (the
  // lab refused the time) is not in the way: the new time below is booked on that payment.
  const [under] = await sql`select 1 from lab_bookings where user_id = ${p.id}
                            and status in ('BOOKED', 'COLLECTOR_ASSIGNED', 'SAMPLE_COLLECTED', 'PROCESSING')`;
  if (under) fail(409, "This patient already has a blood test booked. Move that one instead.");
  const saved = await holdBooking(p.id, {
    packageCode: care.lab_package_code, carePackageCode: care.code, addressId: Number(b.addressId), collectionDate: String(b.collectionDate ?? ""),
    slotId: Number(b.slotId),
    patient: { name: String(b.person?.name ?? ""), age: Number(b.person?.age), gender: String(b.person?.gender ?? ""), mobile: p.mobile, email: p.email ?? "" },
  });
  await sql`update lab_bookings set booked_by = ${me.id} where id = ${saved.id}`;
  // someone who has paid already (pay first; or a paid test that was cancelled or refused) is booked at once on that
  // payment, inside holdBooking: never charged twice
  if (saved.status === "BOOKED") {
    await sql`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${me.id}, 'Booked a blood test for the patient, on their payment')`;
    return ok(c, view({ ...saved, booked_by: me.id }), "Booked. It was already paid for, and the patient was told.");
  }
  await sql`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${me.id}, 'Held a blood test time for the patient')`;
  return ok(c, view({ ...saved, booked_by: me.id }), "Time held for 30 minutes. It is booked once it is paid for.");
});

adminLabRoutes.post("/admin/lab-bookings/:id/payment-link", async (c) => {
  const me = await admin(c);
  const row = await booking(c.req.param("id"));
  if (row.status !== "PAYMENT_PENDING" || row.paid_at) fail(409, "Only a time that is held and not yet paid for needs a link.");
  const made = await links.createLabLink(await patient(row.user_id) as never, row as never, me.id);
  return ok(c, made, made.texted ? "Link made. Razorpay has texted it to the patient; you can send it too." : "Link made. Copy it and send it to the patient.");
});

adminLabRoutes.post("/admin/lab-bookings/:id/paid", async (c) => {
  const me = await admin(c);
  const row = await booking(c.req.param("id"));
  if (row.paid_at) fail(409, "This booking is paid for already.");
  if (row.status !== "PAYMENT_PENDING" && row.status !== "EXPIRED") fail(409, "This booking was cancelled. Hold a new time.");
  const ref = String((await body<{ paymentRef?: unknown }>(c)).paymentRef ?? "").trim().slice(0, 80);
  if (ref.length < 4) fail(400, "Add the payment ID of the money received.");
  const [used] = await sql`select 1 from payment_orders where provider_payment_id = ${ref} union all select 1 from plan_recommendations where payment_ref = ${ref} limit 1`;
  if (used) fail(409, "That payment ID has been used already.");
  const messages = await sql.begin(async (tx) => {
    const [{ n }] = await tx`select nextval('invoice_seq') as n`;
    await tx`insert into payment_orders (id, user_id, purpose, reference_id, amount_paise, title, line_items, status, provider,
               provider_payment_id, paid_at, invoice_number, fulfilled_at, meta)
             values (${`team_${row.id}_${Date.now().toString(36)}`}, ${row.user_id}, 'LAB_BOOKING', ${row.id}, ${row.amount_paise}, 'Blood tests and consultation',
               ${tx.json([{ label: "Blood tests and consultation", amountPaise: row.amount_paise }])}, 'PAID', ${ref.startsWith("pay_") ? "razorpay" : "mock"},
               ${ref}, now(), ${`INR-${new Date().getUTCFullYear()}-${String(n).padStart(6, "0")}`}, now(), ${tx.json({ paidOutside: true, recordedBy: me.id })})`;
    await tx`update received_payments set used_for_patient = ${row.user_id}, used_at = now() where id = ${ref}`;
    await fulfilLabBooking(tx, row.id, row.user_id);
    await tx`insert into audit_log (patient_id, actor_id, action) values (${row.user_id}, ${me.id}, ${`Blood test marked paid outside the app (${ref})`})`;
    return await notices.within(tx, (sp) => notices.labBooked(sp, row.id));
  });
  await links.cancelOpen(sql, row.user_id, "LAB_BOOKING");
  await sendNow(messages);
  const [saved] = await bookingQuery(sql, row.id);
  return ok(c, view(saved), saved.needs_attention ? "Paid, but the time could not be confirmed. Hold a new time." : "Paid. The collection is booked and the patient was told.");
});

adminLabRoutes.post("/admin/lab-bookings/:id/move", async (c) => {
  const me = await admin(c);
  const row = await booking(c.req.param("id"));
  const b = await body<{ collectionDate?: unknown; slotId?: unknown }>(c);
  const saved = await moveBooking(row, String(b.collectionDate ?? ""), Number(b.slotId));
  await sql`insert into audit_log (patient_id, actor_id, action) values (${row.user_id}, ${me.id}, 'Moved the blood test for the patient')`;
  // the patient hears the new time, as they did the first
  await notices.labBooked(sql, row.id, true).then(sendNow).catch((e) => console.error("lab moved notice", (e as Error).message));
  return ok(c, view(saved), "Collection moved");
});

adminLabRoutes.post("/admin/lab-bookings/:id/cancel", async (c) => {
  const me = await admin(c);
  const row = await booking(c.req.param("id"));
  const b = await body<{ reason?: unknown; refunded?: unknown }>(c);
  const reason = String(b.reason ?? "").trim().slice(0, 300);
  if (reason.length < 3) fail(400, "Say why it is cancelled.");
  // a paid booking the lab never confirmed has nothing to cancel there: it is closed here
  let saved;
  if (row.paid_at && row.status === "PAYMENT_PENDING") {
    [saved] = await sql`update lab_bookings set status = 'CANCELLED', updated_at = now() where id = ${row.id} returning *`;
    await giveCreditBack(sql, row.user_id, row.id);
  } else saved = await cancelBookingFor(row, reason);
  // a link made for this booking must not stay payable
  await links.cancelOpen(sql, row.user_id, "LAB_BOOKING");
  // refunded (in Razorpay, by the team): the payment is no longer a credit for the next booking, and the patient
  // is back at the start, to book and pay again if they wish
  const refunded = Boolean(row.paid_at) && b.refunded === true;
  if (refunded) {
    await sql`update lab_bookings set paid_at = null, needs_attention = null where id = ${row.id}`;
    await sql`update eligibility set stage = 'NOT_STARTED', lab_booking_id = null, lab_credit = false, lab_paid_at = null,
                consultation_paid = false, updated_at = now()
              where user_id = ${row.user_id} and not consultation_used`;
    [saved] = await bookingQuery(sql, row.id);
  }
  await sql`insert into audit_log (patient_id, actor_id, action) values (${row.user_id}, ${me.id},
              ${`Cancelled the blood test${refunded ? " (refunded)" : ""}: ${reason}`})`;
  return ok(c, view(saved), !row.paid_at ? "Cancelled" : refunded ? "Cancelled and marked refunded."
    : "Cancelled. Their payment is kept for a new time: book one, and it will not be charged again.");
});
