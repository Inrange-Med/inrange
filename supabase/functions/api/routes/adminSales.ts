// Admin's side of the 23 Nov 2026 call: payment links and who paid, what each plan includes, and the calls the
// team schedules. Mounted at /api. Every route: role ADMIN only.
//   POST  /admin/medicine/patients/:patientId/payment-links   { planId, discountPercent?, salespersonId?, coachPreference?, note? }
//   POST  /admin/payment-links/:id/check          asks Razorpay whether it was paid
//   POST  /admin/payment-links/:id/cancel         withdraws one nobody paid
//   POST  /admin/payment-links/:id/simulate-paid  a test patient's link only: plays the payment, for dry runs
//   GET   /admin/payments                         every payment link, and money Razorpay took that matches no order
//                                                 or link of ours, each with the patient whose number paid it
//   POST  /admin/received-payments/:id/set-aside  hides one that is not for a plan
//   GET   /admin/plans                            the plans, with what each includes and the sales discount allowed
//   PATCH /admin/plans/:id                        any of { doctorConsults, coachCalls, fitnessCalls, maxSalesDiscountPercent }
//   GET   /admin/calls                            consultations coming up (all patients), and who is due a follow-up
//   GET   /admin/consultations/:id/links          the video links for the patient, the doctor and the salesperson
import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "../lib/db.ts";
import { body, fail, intParam, ok } from "../lib/http.ts";
import { requireDesk, requireUser } from "../lib/auth.ts";
import { isTestMobile } from "../lib/env.ts";
import * as links from "../lib/paymentLinks.ts";
import { callLink } from "../lib/callLinks.ts";
import { cancelPaymentLink } from "../integrations/razorpay.ts";

export const adminSalesRoutes = new Hono();

const admin = async (c: Context) => {
  const me = await requireUser(c, "ADMIN");
  if (me.role !== "ADMIN") fail(403, "You do not have access to this.");
  return me;
};
const name = sql`coalesce(nullif(trim(concat_ws(' ', pp.first_name, pp.last_name)), ''), pu.full_name, 'Patient ' || pu.id)`;
const starts = sql`to_char((s.slot_date + s.start_time), 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"')`;

async function patient(id: number) {
  const [p] = await sql`select pu.id, pu.mobile, ${name} as name from users pu left join patient_profiles pp on pp.user_id = pu.id
                        where pu.id = ${id} and pu.role = 'PATIENT'`;
  return (p ?? fail(404, "That patient was not found.")) as { id: number; mobile: string; name: string };
}

adminSalesRoutes.post("/admin/medicine/patients/:patientId/payment-links", async (c) => {
  const me = await admin(c);
  const p = await patient(intParam(c.req.param("patientId"), "patient"));
  const b = await body<links.LinkInput & { salespersonId?: unknown }>(c);
  const [seller] = b.salespersonId == null || b.salespersonId === "" ? []
    : await sql`select id, full_name from salespeople where id = ${Number(b.salespersonId) || 0} and active`;
  if (b.salespersonId != null && b.salespersonId !== "" && !seller) fail(400, "That salesperson is not on the sales team.");
  const made = await links.createLink(p, b, { userId: me.id, seller: (seller as never) ?? null, isAdmin: true });
  return ok(c, made, made.texted ? "Link made. Razorpay has texted it to the patient; you can send it too."
    : "Link made. Copy it and send it to the patient.");
});

adminSalesRoutes.post("/admin/payment-links/:id/check", async (c) => {
  await admin(c);
  const status = await links.check(c.req.param("id").slice(0, 40)).catch(() => fail(502, "Razorpay could not be reached. Try again in a moment."));
  if (!status) fail(404, "That payment link was not found.");
  return ok(c, { status }, status === "PAID" ? "Paid. The plan has started." : status === "CREATED" ? "Not paid yet." : "This link has ended.");
});

adminSalesRoutes.post("/admin/payment-links/:id/cancel", async (c) => {
  const me = await admin(c);
  const [l] = await sql`select id, status, patient_id, purpose from payment_links where id = ${c.req.param("id").slice(0, 40)}`;
  if (!l) fail(404, "That payment link was not found.");
  if (l.status !== "CREATED") fail(409, "Only a link still waiting can be withdrawn.");
  await links.cancelOpen(sql, l.patient_id, l.purpose);
  await sql`insert into audit_log (patient_id, actor_id, action) values (${l.patient_id}, ${me.id}, 'Withdrew a payment link')`;
  return ok(c, null, "Link withdrawn");
});

/** Dry runs: plays the payment of a test patient's link (TEST_MOBILES), exactly as Razorpay's would act. Never for a real patient. */
adminSalesRoutes.post("/admin/payment-links/:id/simulate-paid", async (c) => {
  await admin(c);
  const [l] = await sql`select l.id, l.status, u.mobile from payment_links l join users u on u.id = l.patient_id where l.id = ${c.req.param("id").slice(0, 40)}`;
  if (!l || !isTestMobile(l.mobile)) fail(404, "This feature is not available.");
  if (l.status !== "CREATED") fail(409, "Only a link still waiting can be paid.");
  // the real link, if there is one, is closed first so nobody can pay it as well
  await cancelPaymentLink(l.id);
  await links.settle(l.id, `pay_test_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`);
  return ok(c, null, "Paid (test). The plan has started.");
});

adminSalesRoutes.get("/admin/payments", async (c) => {
  await admin(c);
  const [all, received] = await Promise.all([
    links.allLinks(),
    // who paid: the patient whose number the payment came from, when there is one
    sql`select r.id, r.amount_paise / 100 as "amountRupees", r.mobile, r.method, r.description,
          to_char(r.captured_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') as "capturedAt",
          pu.id::text as "patientId", ${name} as "patientName"
        from received_payments r left join users pu on pu.mobile = r.mobile and pu.role = 'PATIENT'
        left join patient_profiles pp on pp.user_id = pu.id
        where r.used_at is null and r.set_aside_at is null order by r.captured_at desc limit 100`,
  ]);
  return ok(c, { links: all, received: received.map((r) => ({ ...r, patientName: r.patientId ? r.patientName : null })) });
});

adminSalesRoutes.post("/admin/received-payments/:id/set-aside", async (c) => {
  await admin(c);
  await sql`update received_payments set set_aside_at = now() where id = ${c.req.param("id").slice(0, 40)}`;
  return ok(c, null, "Set aside");
});

// ---------------------------------------------------------------- plans

const plans = () => sql`
  select id::text as id, name, duration_months as months, price_rupees as "priceRupees", active,
    doctor_consults as "doctorConsults", coach_calls as "coachCalls", fitness_calls as "fitnessCalls",
    max_sales_discount_percent as "maxDiscountPercent"
  from plans where active order by sort_order, duration_months`;

adminSalesRoutes.get("/admin/plans", async (c) => {
  await admin(c);
  return ok(c, await plans());
});

adminSalesRoutes.patch("/admin/plans/:id", async (c) => {
  await admin(c);
  const id = intParam(c.req.param("id"), "plan");
  const b = await body<Record<string, unknown>>(c);
  const whole = (v: unknown, max: number, what: string) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > max) fail(400, `${what} is a whole number from 0 to ${max}.`);
    return n;
  };
  const set: Record<string, number> = {};
  if (b.doctorConsults !== undefined) set.doctor_consults = whole(b.doctorConsults, 200, "Doctor consultations");
  if (b.coachCalls !== undefined) set.coach_calls = whole(b.coachCalls, 500, "Coach calls");
  if (b.fitnessCalls !== undefined) set.fitness_calls = whole(b.fitnessCalls, 500, "Fitness calls");
  if (b.maxDiscountPercent !== undefined) set.max_sales_discount_percent = whole(b.maxDiscountPercent, 90, "The discount");
  if (Object.keys(set).length && !(await sql`update plans set ${sql(set)} where id = ${id} returning id`).length) fail(404, "That plan was not found.");
  return ok(c, await plans(), "Saved");
});

// ---------------------------------------------------------------- calls

adminSalesRoutes.get("/admin/calls", async (c) => {
  await requireDesk(c, "CONSULTATIONS");
  const [upcoming, due] = await Promise.all([
    sql`select a.id::text as id, ${starts} as "startsAt", a.status, case when a.visit_type = 'FOLLOW_UP' then 'FOLLOW_UP' else 'FIRST' end as "visitType",
          pu.id::text as "patientId", ${name} as "patientName", pu.mobile as "patientMobile", d.full_name as "doctorName", pp.salesperson
        from appointments a join doctor_slots s on s.id = a.slot_id join doctors d on d.id = a.doctor_id
        join users pu on pu.id = a.patient_id left join patient_profiles pp on pp.user_id = pu.id
        where a.status in ('Booked', 'InProgress') and (s.slot_date + s.start_time) > (now() at time zone 'Asia/Kolkata') - interval '2 hours'
        order by s.slot_date, s.start_time limit 200`,
    // the follow-up sheet: the last consultation was 25 days ago or more, and nothing is booked. The team calls
    // them and books the next one, with their own doctor.
    sql`select pu.id::text as "patientId", ${name} as "patientName", pu.mobile as "patientMobile", pp.salesperson,
          to_char(lc.at, 'YYYY-MM-DD') as "lastOn", (current_date - lc.at::date)::int as "daysSince",
          (select d.full_name from care_team_doctors t join doctors d on d.id = t.doctor_id where t.patient_id = pu.id order by t.added_at, t.doctor_id limit 1) as "doctorName",
          pl.name as "planName", pl.doctor_consults as "consultsIncluded",
          (select count(*) from appointments a2 join doctor_slots s2 on s2.id = a2.slot_id where a2.patient_id = pu.id and a2.status = 'Completed'
            and pl.starts_at is not null and (s2.slot_date + s2.start_time) >= (pl.starts_at at time zone 'Asia/Kolkata'))::int as "consultsDone"
        from users pu left join patient_profiles pp on pp.user_id = pu.id
        join lateral (select max(s.slot_date + s.start_time) as at from appointments a join doctor_slots s on s.id = a.slot_id
          where a.patient_id = pu.id and a.status = 'Completed') lc on lc.at is not null
        left join lateral (select p.name, p.doctor_consults, sb.starts_at from subscriptions sb join plans p on p.id = sb.plan_id
          where sb.user_id = pu.id and sb.status = 'Active' and sb.ends_at > now() order by sb.ends_at desc limit 1) pl on true
        where pu.role = 'PATIENT' and lc.at < (now() at time zone 'Asia/Kolkata') - interval '25 days'
          and not exists (select 1 from appointments a join doctor_slots s on s.id = a.slot_id where a.patient_id = pu.id
            and a.status in ('Booked', 'InProgress') and (s.slot_date + s.start_time) > (now() at time zone 'Asia/Kolkata'))
        -- those on a plan first, longest overdue first
        order by (pl.name is null), lc.at limit 200`,
  ]);
  return ok(c, { upcoming, followUpsDue: due });
});

adminSalesRoutes.get("/admin/consultations/:id/links", async (c) => {
  const me = await requireDesk(c, "CONSULTATIONS");
  const [a] = await sql`
    select a.id, a.video_room_id, a.status, a.patient_id, a.doctor_id, d.full_name as doctor, ${name} as patient, sp.full_name as seller, sp.user_id as seller_user
    from appointments a join doctors d on d.id = a.doctor_id join users pu on pu.id = a.patient_id
    left join patient_profiles pp on pp.user_id = pu.id left join salespeople sp on sp.id = pp.salesperson_id and sp.active
    where a.id = ${intParam(c.req.param("id"), "consultation")}`;
  if (!a) fail(404, "That consultation was not found.");
  if (a.status !== "Booked" && a.status !== "InProgress") fail(409, "This consultation is not open any more, so it has no links.");
  const room = a as never;
  try {
    // one after the other: the first makes the room, the rest reuse it
    const patientUrl = await callLink(room, "patient", a.patient, a.patient_id);
    const doctorUrl = await callLink(room, "doctor", a.doctor, a.doctor_id);
    const salesUrl = a.seller ? await callLink(room, "patient", `${a.seller} (inrange)`, a.seller_user ?? me.id) : null;
    await sql`insert into audit_log (patient_id, actor_id, action) values (${a.patient_id}, ${me.id}, 'Opened the video links of a consultation')`;
    return ok(c, { patient: patientUrl, doctor: doctorUrl, sales: salesUrl, salesName: a.seller ?? null });
  } catch (e) {
    console.error("call links", a.id, e);
    return fail(502, "The video room could not be opened. Please try again in a moment.");
  }
});
