// The sales panel (23 Nov 2026 call): a salesperson's own place, apart from admin's. Mounted at /api.
// Every route: role SALES, someone active on the sales team, and only the patients assigned to them. An admin
// does all of this from the admin area instead, so nothing here opens for any other role.
//   GET  /sales/me                              who I am, my place on the team and my numbers
//   GET  /sales/plans                           the plans on sale: price, what each includes, the discount I may give
//   GET  /sales/patients?q=                     my customers: plan or waiting link, doctor, coach, the next call
//   GET  /sales/patients/:patientId             one customer: details, doctor and coach, calls, the prescription's
//                                               diagnosis and medicines, the plan, their payment links
//   POST /sales/patients/:patientId/payment-links  the sales form: { planId, discountPercent?, coachPreference?, note? }
//                                               makes the link; when it is paid the plan starts by itself
//   POST /sales/payment-links/:id/check         asks Razorpay whether it was paid
//   POST /sales/payment-links/:id/cancel        withdraws one nobody paid
//   POST /sales/patients/:patientId/sale        { planId, paymentId, coachPreference?, note? }: a Razorpay payment
//                                               already made another way; the plan starts once Razorpay confirms it
//   GET  /sales/consultations/:id/join          my link into a customer's video call
import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "../lib/db.ts";
import { body, fail, intParam, ok } from "../lib/http.ts";
import { requireUser } from "../lib/auth.ts";
import { lineView } from "../lib/prescriptions.ts";
import { onPlan, startPlan } from "../lib/pharmacy.ts";
import * as links from "../lib/paymentLinks.ts";
import { callLink } from "../lib/callLinks.ts";
import * as notices from "../lib/notices.ts";
import { sendNow } from "../lib/notify.ts";

export const salesRoutes = new Hono();

const name = sql`coalesce(nullif(trim(concat_ws(' ', pp.first_name, pp.last_name)), ''), pu.full_name, 'Patient ' || pu.id)`;
const iso = (col: string) => sql`to_char(${sql(col)} at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"')`;
const starts = sql`to_char((s.slot_date + s.start_time), 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"')`;
const ahead = sql`(s.slot_date + s.start_time) > (now() at time zone 'Asia/Kolkata') - interval '2 hours'`;
const words = (v: unknown, max: number) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max) || null;

/** The signed-in salesperson. An admin is refused too: this panel is only ever one salesperson's own view. */
async function seller(c: Context) {
  const me = await requireUser(c, "SALES");
  const [s] = me.role === "SALES" ? await sql`select id, full_name from salespeople where user_id = ${me.id} and active` : [];
  if (!s) fail(403, "You do not have access to this.");
  return { me, s: s as { id: number; full_name: string } };
}

/** One of my customers, or a 404 that says nothing about anyone else's. */
async function customer(sellerId: number, patientId: number) {
  const [p] = await sql`
    select pu.id, pu.mobile, ${name} as name, pp.age_years, pp.gender, pp.coach_id, pp.fitness_coach_id
    from users pu join patient_profiles pp on pp.user_id = pu.id
    where pu.id = ${patientId} and pu.role = 'PATIENT' and pp.salesperson_id = ${sellerId}`;
  return p ?? fail(404, "That customer was not found.");
}

salesRoutes.get("/sales/me", async (c) => {
  const { s } = await seller(c);
  const [n] = await sql`
    select (select count(*) from patient_profiles p where p.salesperson_id = ${s.id})::int as patients,
      (select count(*) from plan_recommendations r where r.salesperson_id = ${s.id} and exists (
        select 1 from subscriptions b where b.user_id = r.patient_id and b.plan_id = r.plan_id and b.created_at >= r.created_at))::int as sold,
      (select count(*) from payment_links l where l.salesperson_id = ${s.id} and l.status = 'CREATED' and l.purpose = 'PLAN')::int as waiting,
      (select count(*) from salespeople o where o.active and (o.rank, o.id) <= (select rank, id from salespeople where id = ${s.id}))::int as rank`;
  return ok(c, { name: s.full_name, rank: n.rank, patients: n.patients, plansSold: n.sold, linksWaiting: n.waiting });
});

salesRoutes.get("/sales/plans", async (c) => {
  await seller(c);
  const rows = await sql`select id::text as id, name, duration_months as months, price_rupees as "priceRupees",
      max_sales_discount_percent as "maxDiscountPercent", doctor_consults as "doctorConsults", coach_calls as "coachCalls",
      fitness_calls as "fitnessCalls"
    from plans where active and price_rupees > 0 order by sort_order, duration_months`;
  return ok(c, rows);
});

salesRoutes.get("/sales/patients", async (c) => {
  const { s } = await seller(c);
  const q = (c.req.query("q") ?? "").trim().toLowerCase().slice(0, 40);
  const rows = await sql`
    select pu.id::text as id, ${name} as name, pu.mobile,
      (select string_agg(d.full_name, ', ' order by t.added_at, t.doctor_id) from care_team_doctors t
        join doctors d on d.id = t.doctor_id where t.patient_id = pu.id) as doctors,
      (select cu.full_name from users cu where cu.id = pp.coach_id) as "coachName",
      pl.name as "planName", ${iso("pl.ends_at")} as "planEndsAt",
      lk.amount_paise / 100 as "linkRupees", ${iso("lk.created_at")} as "linkSentAt",
      nx.id::text as "nextCallId", nx.starts as "nextCallAt", nx.doctor as "nextCallDoctor"
    from patient_profiles pp join users pu on pu.id = pp.user_id and pu.role = 'PATIENT'
    left join lateral (select p.name, sb.ends_at from subscriptions sb join plans p on p.id = sb.plan_id
      where sb.user_id = pu.id and sb.status = 'Active' and sb.ends_at > now() order by sb.ends_at desc limit 1) pl on true
    left join lateral (select l.amount_paise, l.created_at from payment_links l where l.patient_id = pu.id and l.status = 'CREATED' and l.purpose = 'PLAN' limit 1) lk on true
    left join lateral (select a.id, ${starts} as starts, d.full_name as doctor from appointments a
      join doctor_slots s on s.id = a.slot_id join doctors d on d.id = a.doctor_id
      where a.patient_id = pu.id and a.status in ('Booked', 'InProgress') and ${ahead}
      order by s.slot_date, s.start_time limit 1) nx on true
    where pp.salesperson_id = ${s.id}
      ${q ? sql`and (lower(${name}) like ${`%${q}%`} or pu.mobile like ${`%${q}%`})` : sql``}
    -- a call coming up first, then those still to buy, then the rest; newest customers first within each
    order by nx.starts nulls last, (pl.name is null) desc, pu.created_at desc limit 300`;
  return ok(c, rows);
});

salesRoutes.get("/sales/patients/:patientId", async (c) => {
  const { me, s } = await seller(c);
  const p = await customer(s.id, intParam(c.req.param("patientId"), "customer"));
  await sql`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${me.id}, 'Viewed the customer page (sales)')`;
  const [doctors, [coach], [fitness], [plan], calls, [rx], mine] = await Promise.all([
    sql`select d.full_name from care_team_doctors t join doctors d on d.id = t.doctor_id where t.patient_id = ${p.id} order by t.added_at, t.doctor_id`,
    p.coach_id ? sql`select full_name from users where id = ${p.coach_id}` : Promise.resolve([]),
    p.fitness_coach_id ? sql`select full_name from users where id = ${p.fitness_coach_id}` : Promise.resolve([]),
    sql`select pl.name, ${iso("sb.starts_at")} as starts, ${iso("sb.ends_at")} as ends from subscriptions sb join plans pl on pl.id = sb.plan_id
        where sb.user_id = ${p.id} and sb.status = 'Active' and sb.ends_at > now() order by sb.ends_at desc limit 1`,
    sql`select a.id::text as id, ${starts} as "startsAt", d.full_name as "doctorName", a.status,
          case when a.visit_type = 'FOLLOW_UP' then 'FOLLOW_UP' else 'FIRST' end as "visitType",
          (a.status in ('Booked', 'InProgress') and ${ahead}) as joinable
        from appointments a join doctor_slots s on s.id = a.slot_id join doctors d on d.id = a.doctor_id
        where a.patient_id = ${p.id} and a.status <> 'Cancelled' order by s.slot_date desc, s.start_time desc limit 8`,
    // what the doctor found and prescribed, so the plan can be explained against it; never the PDF, reports or notes
    sql`select x.items, x.diagnosis, d.full_name as doctor,
          to_char(coalesce(x.sent_at, x.signed_at) at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') as sent
        from prescriptions x left join doctors d on d.id = x.doctor_id
        where x.patient_id = ${p.id} and x.status = 'SIGNED' order by coalesce(x.sent_at, x.signed_at) desc limit 1`,
    links.linksFor(p.id),
  ]);
  return ok(c, {
    patient: { id: String(p.id), name: p.name, mobile: p.mobile, age: p.age_years ?? null, gender: p.gender ?? null,
      doctors: doctors.map((d) => d.full_name), coachName: coach?.full_name ?? null, fitnessCoachName: fitness?.full_name ?? null },
    plan: plan ? { name: plan.name, startedAt: plan.starts, endsAt: plan.ends } : null,
    consultations: calls,
    prescription: rx ? { doctorName: rx.doctor ?? "", sentAt: rx.sent, diagnosis: rx.diagnosis ?? "",
      // deno-lint-ignore no-explicit-any
      medicines: (rx.items as Record<string, any>[]).map(lineView).map((l) => l.name) } : null,
    // a salesperson's links are for plans; a blood test's link is the team's
    links: mine.filter((l) => l.purpose === "PLAN"),
  });
});

salesRoutes.post("/sales/patients/:patientId/payment-links", async (c) => {
  const { me, s } = await seller(c);
  const p = await customer(s.id, intParam(c.req.param("patientId"), "customer"));
  const made = await links.createLink(p as never, await body<links.LinkInput>(c), { userId: me.id, seller: s, isAdmin: false });
  return ok(c, made, made.texted ? "Link made. Razorpay has texted it to the customer; you can send it too."
    : "Link made. Copy it and send it to the customer.");
});

/** A link of one of my customers. */
async function myLink(sellerId: number, id: string) {
  const [l] = await sql`select l.id, l.status, l.patient_id from payment_links l join patient_profiles pp on pp.user_id = l.patient_id
                        where l.id = ${id.slice(0, 40)} and pp.salesperson_id = ${sellerId} and l.purpose = 'PLAN'`;
  return l ?? fail(404, "That payment link was not found.");
}

salesRoutes.post("/sales/payment-links/:id/check", async (c) => {
  const { s } = await seller(c);
  const l = await myLink(s.id, c.req.param("id"));
  const status = await links.check(l.id).catch(() => fail(502, "Razorpay could not be reached. Try again in a moment."));
  return ok(c, { status }, status === "PAID" ? "Paid. The plan has started." : status === "CREATED" ? "Not paid yet." : "This link has ended.");
});

salesRoutes.post("/sales/payment-links/:id/cancel", async (c) => {
  const { me, s } = await seller(c);
  const l = await myLink(s.id, c.req.param("id"));
  if (l.status !== "CREATED") fail(409, "Only a link still waiting can be withdrawn.");
  await links.cancelOpen(sql, l.patient_id);
  await sql`insert into audit_log (patient_id, actor_id, action) values (${l.patient_id}, ${me.id}, 'Withdrew a payment link')`;
  return ok(c, null, "Link withdrawn");
});

salesRoutes.post("/sales/patients/:patientId/sale", async (c) => {
  const { me, s } = await seller(c);
  const p = await customer(s.id, intParam(c.req.param("patientId"), "customer"));
  const b = await body<{ planId?: unknown; paymentId?: unknown; coachPreference?: unknown; note?: unknown }>(c);
  const [plan] = await sql`select id, name, price_rupees, max_sales_discount_percent from plans
                           where id = ${Number(b.planId) || 0} and active and price_rupees > 0`;
  if (!plan) fail(400, "That plan is not available.");
  if (await onPlan(sql, p.id)) fail(409, "This customer is already on a plan.");
  const paymentId = String(b.paymentId ?? "").trim();
  // the least this plan can be sold for by a salesperson; Razorpay, never the form, says what was paid
  const amountPaise = await links.provePayment(paymentId, Math.round(plan.price_rupees * (100 - plan.max_sales_discount_percent) / 100) * 100);
  const messages = await sql.begin(async (tx) => {
    await tx`delete from plan_recommendations where patient_id = ${p.id}
             and created_at > coalesce((select max(sb.created_at) from subscriptions sb where sb.user_id = ${p.id}), '-infinity')`;
    // the unique payment ID is the last word on "used once": a second form with it fails here
    await tx`insert into plan_recommendations (patient_id, plan_id, assigned_by, salesperson, salesperson_id, coach_preference, note, amount_paise, payment_ref)
             values (${p.id}, ${plan.id}, ${me.id}, ${s.full_name}, ${s.id}, ${words(b.coachPreference, 200)}, ${words(b.note, 1000)}, ${amountPaise}, ${paymentId})`;
    await startPlan(tx, p.id, plan.id, null);
    await tx`update received_payments set used_for_patient = ${p.id}, used_at = now() where id = ${paymentId}`;
    await tx`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${me.id},
               ${`Started ${plan.name}: Razorpay payment ${paymentId} (Rs ${amountPaise / 100}), sold by ${s.full_name}`})`;
    return await notices.within(tx, (sp) => notices.planStarted(sp, p.id, plan.name, paymentId));
  });
  await links.cancelOpen(sql, p.id);
  await sendNow(messages);
  return ok(c, { amountRupees: amountPaise / 100 }, `${plan.name} started`);
});

salesRoutes.get("/sales/consultations/:id/join", async (c) => {
  const { me, s } = await seller(c);
  const [a] = await sql`
    select a.id, a.video_room_id, a.status, a.patient_id from appointments a join patient_profiles pp on pp.user_id = a.patient_id
    where a.id = ${intParam(c.req.param("id"), "consultation")} and pp.salesperson_id = ${s.id}`;
  if (!a) fail(404, "That consultation was not found.");
  if (a.status !== "Booked" && a.status !== "InProgress") fail(409, "This consultation is not open to join.");
  // joins with a guest's rights (the patient's room role): cannot end the call or remove anyone
  const url = await callLink(a as never, "patient", `${s.full_name} (inrange)`, me.id)
    .catch(() => fail(502, "The video room could not be opened. Please try again in a moment."));
  await sql`insert into audit_log (patient_id, actor_id, action) values (${a.patient_id}, ${me.id}, 'Joined the consultation (sales)')`;
  return ok(c, { url });
});
