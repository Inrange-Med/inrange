// The sales panel (23 and 24 Nov 2026 calls): a salesperson's own place. Mounted at /api.
// A salesperson (role SALES, active on the sales team) reaches only the leads assigned to them. An admin reaches every
// lead through the same routes (admin's Sales tab), with ?salespersonId= to narrow the list. Nobody else gets in.
// What a salesperson sees of a lead is what the team's own sheet tracks: contact, BMI, what they paid, where their
// blood test and report stand, the consultation and its doctor, whether a prescription was sent and whether it has
// a GLP-1 medicine, the plan, and their own call notes. Never a report, a lab value, a PDF or the doctor's notes.
//   GET  /sales/me                              who I am, my place on the team and my numbers
//   GET  /sales/plans                           the plans on sale: price, what each includes, the discount I may give
//   GET  /sales/patients?q=&salespersonId=      the leads, the ones to act on first
//   GET  /sales/patients/:patientId             one lead, end to end
//   POST /sales/patients/:patientId/updates     { callStatus?, remark?, followUpOn? } a note after a call
//   PUT  /sales/patients/:patientId/sale-form   { condition, programme, note } the sales form, after the payment
//   POST /sales/patients/:patientId/payment-links  { planId, discountPercent?, coachPreference?, note? } makes the link;
//                                               when it is paid the plan starts by itself
//   POST /sales/payment-links/:id/check         asks Razorpay whether it was paid
//   POST /sales/payment-links/:id/cancel        withdraws one nobody paid
//   POST /sales/patients/:patientId/sale        { planId, paymentId, coachPreference?, note? }: a Razorpay payment
//                                               already made another way; the plan starts once Razorpay confirms it
//   GET  /sales/consultations/:id/join          my link into a lead's video call (the salesperson joins after the doctor)
import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "../lib/db.ts";
import { body, fail, intParam, ok, todayIST } from "../lib/http.ts";
import { type AuthUser, requireUser } from "../lib/auth.ts";
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
const GLP1 = "tirzepatide|semaglutide|dulaglutide|liraglutide|mounjaro|wegovy|ozempic|rybelsus|trulicity|victoza";

type Seller = { id: number; full_name: string };
/** Who is asking: a salesperson (`s`, their own leads), or an admin (`all`). */
type Ctx = { me: AuthUser; s: Seller | null; all: boolean };

async function seller(c: Context): Promise<Ctx> {
  const me = await requireUser(c, "SALES");
  if (me.role === "ADMIN") return { me, s: null, all: true };
  const [s] = await sql`select id, full_name from salespeople where user_id = ${me.id} and active`;
  if (!s) fail(403, "You do not have access to this.");
  return { me, s: s as Seller, all: false };
}
const mine = (x: Ctx) => (x.all ? sql`` : sql`and pp.salesperson_id = ${x.s!.id}`);

/** One of my leads (any patient, for an admin), or a 404 that says nothing about anyone else's. */
async function customer(x: Ctx, patientId: number) {
  const [p] = await sql`
    select pu.id, pu.mobile, ${name} as name, pp.salesperson_id
    from users pu left join patient_profiles pp on pp.user_id = pu.id
    where pu.id = ${patientId} and pu.role = 'PATIENT' ${mine(x)}`;
  return p ?? fail(404, "That lead was not found.");
}

/** Where a lead stands, from what has happened to them: the one word the list sorts and filters by. */
// deno-lint-ignore no-explicit-any
function stageOf(r: Record<string, any>) {
  if (r.planName) return "ON_PLAN";
  if (r.linkRupees != null) return "LINK_SENT";
  if (r.lastConsultAt) return "CONSULTED";
  if (r.nextCallAt) return "CONSULT_BOOKED";
  if (["UNDER_REVIEW", "APPROVED", "NOT_APPROVED"].includes(r.eligibilityStage)) return "REPORT_IN";
  if (["LAB_SCHEDULED", "SAMPLE_COLLECTED"].includes(r.eligibilityStage)) return "TEST_BOOKED";
  if (r.labCredit) return "PAID";
  return "NEW";
}

/** The leads as the sheet tracks them. `only`: one patient (the lead's own page). */
async function leads(x: Ctx, opts: { q?: string; only?: number; salespersonId?: string }) {
  const q = (opts.q ?? "").trim().toLowerCase().slice(0, 40);
  const by = x.all && opts.salespersonId
    ? opts.salespersonId === "none" ? sql`and pp.salesperson_id is null` : sql`and pp.salesperson_id = ${Number(opts.salespersonId) || 0}`
    : sql``;
  const rows = await sql`
    select pu.id::text as id, ${name} as name, pu.mobile, pu.email, ${iso("pu.created_at")} as "createdAt",
      case when pp.height_cm > 0 and pp.weight_kg > 0 then round((pp.weight_kg / ((pp.height_cm / 100.0) ^ 2))::numeric, 1)::float end as bmi,
      pp.salesperson, pp.salesperson_id::text as "salespersonId",
      (select string_agg(d.full_name, ', ' order by t.added_at, t.doctor_id) from care_team_doctors t
        join doctors d on d.id = t.doctor_id where t.patient_id = pu.id) as doctors,
      (select cu.full_name from users cu where cu.id = pp.coach_id) as "coachName",
      (select fu.full_name from users fu where fu.id = pp.fitness_coach_id) as "fitnessCoachName",
      coalesce(e.stage, 'NOT_STARTED') as "eligibilityStage", coalesce(e.lab_credit, false) as "labCredit", e.path as "reportPath",
      pay.rupees as "paidRupees", pay.last as "lastPaidAt", pay.what as "paidFor",
      pl.name as "planName", ${iso("pl.starts_at")} as "planStartedAt", ${iso("pl.ends_at")} as "planEndsAt",
      pl.form_due as "formDue",
      lk.amount_paise / 100 as "linkRupees", ${iso("lk.created_at")} as "linkSentAt",
      nx.id::text as "nextCallId", nx.starts as "nextCallAt", nx.doctor as "nextCallDoctor", nx.status as "nextCallStatus",
      to_char(lc.at, 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') as "lastConsultAt", lc.doctor as "lastConsultDoctor",
      rx.sent as "prescriptionSentAt", rx.glp as "glp1Prescribed",
      ${iso("lo.placed_at")} as "lastOrderAt",
      lu.call_status as "callStatus", lu.remark, to_char(lu.follow_up_on, 'YYYY-MM-DD') as "followUpOn", ${iso("lu.created_at")} as "lastNoteAt"
    from users pu
    left join patient_profiles pp on pp.user_id = pu.id
    left join eligibility e on e.user_id = pu.id
    left join lateral (select (sum(o.amount_paise) / 100)::int as rupees, to_char(max(o.paid_at) at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') as last,
        (array_agg(o.title order by o.paid_at desc))[1] as what
      from payment_orders o where o.user_id = pu.id and o.status = 'PAID') pay on true
    left join lateral (select p.name, sb.starts_at, sb.ends_at,
        not exists (select 1 from plan_recommendations r where r.patient_id = pu.id and r.plan_id = sb.plan_id
          and r.created_at <= sb.created_at and r.form_submitted_at is not null) as form_due
      from subscriptions sb join plans p on p.id = sb.plan_id
      where sb.user_id = pu.id and sb.status = 'Active' and sb.ends_at > now() order by sb.ends_at desc limit 1) pl on true
    left join lateral (select l.amount_paise, l.created_at from payment_links l
      where l.patient_id = pu.id and l.status = 'CREATED' and l.purpose = 'PLAN' limit 1) lk on true
    left join lateral (select a.id, ${starts} as starts, d.full_name as doctor, a.status from appointments a
      join doctor_slots s on s.id = a.slot_id join doctors d on d.id = a.doctor_id
      where a.patient_id = pu.id and a.status in ('Booked', 'InProgress') and ${ahead}
      order by s.slot_date, s.start_time limit 1) nx on true
    left join lateral (select (s.slot_date + s.start_time) as at, d.full_name as doctor from appointments a
      join doctor_slots s on s.id = a.slot_id join doctors d on d.id = a.doctor_id
      where a.patient_id = pu.id and a.status = 'Completed' order by s.slot_date desc, s.start_time desc limit 1) lc on true
    left join lateral (select to_char(coalesce(x.sent_at, x.signed_at) at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') as sent,
        x.items::text ~* ${GLP1} as glp
      from prescriptions x where x.patient_id = pu.id and x.status = 'SIGNED' order by coalesce(x.sent_at, x.signed_at) desc limit 1) rx on true
    left join lateral (select o.placed_at from medicine_orders o where o.patient_id = pu.id order by o.id desc limit 1) lo on true
    left join lateral (select u.call_status, u.remark, u.follow_up_on, u.created_at from lead_updates u
      where u.patient_id = pu.id order by u.created_at desc limit 1) lu on true
    where pu.role = 'PATIENT' ${mine(x)} ${by}
      ${opts.only ? sql`and pu.id = ${opts.only}` : sql``}
      ${q ? sql`and (lower(${name}) like ${`%${q}%`} or pu.mobile like ${`%${q}%`})` : sql``}
    -- a follow-up that is due first, then a call coming up, then the newest
    order by (lu.follow_up_on is not null and lu.follow_up_on <= ${todayIST()}::date) desc, nx.starts nulls last, pu.created_at desc
    limit 400`;
  return rows.map((r) => ({ ...r, stage: stageOf(r), formDue: Boolean(r.formDue), glp1Prescribed: r.glp1Prescribed ?? null }));
}

salesRoutes.get("/sales/me", async (c) => {
  const x = await seller(c);
  const who = x.all ? sql`true` : sql`l.salesperson_id = ${x.s!.id}`;
  const [n] = await sql`
    select (select count(*) from patient_profiles p join users u on u.id = p.user_id and u.role = 'PATIENT'
        where ${x.all ? sql`true` : sql`p.salesperson_id = ${x.s!.id}`})::int as patients,
      (select count(*) from plan_recommendations l where ${who} and exists (
        select 1 from subscriptions b where b.user_id = l.patient_id and b.plan_id = l.plan_id and b.created_at >= l.created_at))::int as sold,
      (select count(*) from payment_links l where ${who} and l.status = 'CREATED' and l.purpose = 'PLAN')::int as waiting,
      ${x.all ? sql`null::int` : sql`(select count(*) from salespeople o where o.active
        and (o.rank, o.id) <= (select rank, id from salespeople where id = ${x.s!.id}))::int`} as rank`;
  return ok(c, { name: x.s?.full_name ?? "Everyone's leads", rank: n.rank, patients: n.patients, plansSold: n.sold, linksWaiting: n.waiting, admin: x.all });
});

salesRoutes.get("/sales/plans", async (c) => {
  const x = await seller(c);
  const rows = await sql`select id::text as id, name, duration_months as months, price_rupees as "priceRupees",
      ${x.all ? sql`90` : sql`max_sales_discount_percent`} as "maxDiscountPercent", doctor_consults as "doctorConsults", coach_calls as "coachCalls",
      fitness_calls as "fitnessCalls"
    from plans where active and price_rupees > 0 order by sort_order, duration_months`;
  return ok(c, rows);
});

salesRoutes.get("/sales/patients", async (c) => {
  const x = await seller(c);
  return ok(c, await leads(x, { q: c.req.query("q"), salespersonId: c.req.query("salespersonId") }));
});

salesRoutes.get("/sales/patients/:patientId", async (c) => {
  const x = await seller(c);
  const p = await customer(x, intParam(c.req.param("patientId"), "lead"));
  // a payment link still waiting: Razorpay is asked now (at most every 10 seconds), so a payment shows on the page,
  // the plan starts and the sale is recorded with nobody pressing anything. The page asks again while it is open,
  // and only its first load is logged as a view.
  const [open] = await sql`select id from payment_links where patient_id = ${p.id} and status = 'CREATED' and purpose = 'PLAN'
                           and coalesce(checked_at, created_at) < now() - interval '10 seconds'`;
  if (open) await links.check(open.id).catch((e) => console.error("link check", (e as Error).message));
  if (c.req.query("quiet") !== "1")
    await sql`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${x.me.id}, 'Viewed the lead (sales)')`;
  const [[lead], calls, [rx], mine, updates, payments, [sale]] = await Promise.all([
    leads(x, { only: p.id }),
    sql`select a.id::text as id, ${starts} as "startsAt", d.full_name as "doctorName", a.status,
          case when a.visit_type = 'FOLLOW_UP' then 'FOLLOW_UP' else 'FIRST' end as "visitType",
          (a.status in ('Booked', 'InProgress') and ${ahead}) as joinable
        from appointments a join doctor_slots s on s.id = a.slot_id join doctors d on d.id = a.doctor_id
        where a.patient_id = ${p.id} and a.status <> 'Cancelled' order by s.slot_date desc, s.start_time desc limit 8`,
    // the condition the doctor wrote, so the plan can be explained against it; never the medicines' doses, the PDF,
    // the reports or the doctor's notes
    sql`select x.diagnosis, d.full_name as doctor from prescriptions x left join doctors d on d.id = x.doctor_id
        where x.patient_id = ${p.id} and x.status = 'SIGNED' order by coalesce(x.sent_at, x.signed_at) desc limit 1`,
    links.linksFor(p.id),
    sql`select id::text as id, author_name as by, call_status as "callStatus", remark, to_char(follow_up_on, 'YYYY-MM-DD') as "followUpOn",
          ${iso("created_at")} as at from lead_updates where patient_id = ${p.id} order by created_at desc limit 40`,
    sql`select title, amount_paise / 100 as "amountRupees", ${iso("paid_at")} as "paidAt", provider_payment_id as "paymentId"
        from payment_orders where user_id = ${p.id} and status = 'PAID' order by paid_at desc limit 12`,
    // the sale behind the plan they are on: what the payment recorded, and what the sales form added
    sql`select pl.name as "planName", ${iso("sb.starts_at")} as "startedAt",
          coalesce(po.amount_paise, r.amount_paise) / 100 as "amountRupees", coalesce(po.provider_payment_id, r.payment_ref) as "paymentId",
          r.salesperson, r.coach_preference as "coachPreference", r.note, r.form_condition as condition, r.form_programme as programme,
          ${iso("r.form_submitted_at")} as "submittedAt", r.form_by as "submittedBy"
        from subscriptions sb join plans pl on pl.id = sb.plan_id
        left join payment_orders po on po.id = sb.payment_order_id
        left join lateral (select * from plan_recommendations r where r.patient_id = sb.user_id and r.plan_id = sb.plan_id
          and r.created_at <= sb.created_at order by r.created_at desc limit 1) r on true
        where sb.user_id = ${p.id} and sb.status = 'Active' and sb.ends_at > now() order by sb.ends_at desc limit 1`,
  ]);
  return ok(c, {
    lead,
    condition: rx?.diagnosis ?? null,
    consultations: calls,
    // a salesperson's links are for plans; a blood test's link is the team's
    links: mine.filter((l) => l.purpose === "PLAN"),
    updates,
    payments,
    sale: sale ?? null,
  });
});

const CALL_STATUSES = ["SPOKE", "NO_ANSWER", "CALL_BACK", "INTERESTED", "NOT_INTERESTED"];

salesRoutes.post("/sales/patients/:patientId/updates", async (c) => {
  const x = await seller(c);
  const p = await customer(x, intParam(c.req.param("patientId"), "lead"));
  const b = await body<{ callStatus?: unknown; remark?: unknown; followUpOn?: unknown }>(c);
  const callStatus = CALL_STATUSES.includes(String(b.callStatus)) ? String(b.callStatus) : null;
  const remark = String(b.remark ?? "").trim().slice(0, 2000) || null;
  const followUpOn = typeof b.followUpOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.followUpOn) ? b.followUpOn : null;
  if (!callStatus && !remark && !followUpOn) fail(400, "Add how the call went, a remark, or a day to call again.");
  if (followUpOn && followUpOn < todayIST()) fail(400, "Choose today or a later day to call again.");
  const by = x.me.fullName?.trim() || (x.all ? "Care team" : x.s!.full_name);
  await sql`insert into lead_updates (patient_id, author_id, author_name, call_status, remark, follow_up_on)
            values (${p.id}, ${x.me.id}, ${by}, ${callStatus}, ${remark}, ${followUpOn})`;
  return ok(c, null, "Saved");
});

/**
 * The sales form (23 Nov 2026 call): filled in once the payment is in. The customer, the plan, the amount, the
 * payment ID and the salesperson come from the payment by themselves; the salesperson adds the customer's condition
 * and programme in their own words, the coach they asked for and any remarks. It can be opened and corrected later.
 */
salesRoutes.put("/sales/patients/:patientId/sale-form", async (c) => {
  const x = await seller(c);
  const p = await customer(x, intParam(c.req.param("patientId"), "lead"));
  const b = await body<{ condition?: unknown; programme?: unknown; coachPreference?: unknown; note?: unknown }>(c);
  const [sb] = await sql`select id, plan_id, created_at from subscriptions where user_id = ${p.id} and status = 'Active' and ends_at > now()
                         order by ends_at desc limit 1`;
  if (!sb) fail(409, "The sales form is filled in once the plan is paid for.");
  const by = x.me.fullName?.trim() || x.s?.full_name || "Care team";
  // the coach asked for is no longer on the form (25 Nov 2026): what an older sale recorded stays as it is
  const form = { form_condition: words(b.condition, 300), form_programme: words(b.programme, 120),
    note: words(b.note, 1000), form_submitted_at: new Date(), form_by: by };
  const [r] = await sql`select id, salesperson_id from plan_recommendations where patient_id = ${p.id} and plan_id = ${sb.plan_id}
                        and created_at <= (select created_at from subscriptions where id = ${sb.id}) order by created_at desc limit 1`;
  const who = x.s ? { salesperson: x.s.full_name, salesperson_id: x.s.id } : {};
  if (r) await sql`update plan_recommendations set ${sql({ ...form, ...(r.salesperson_id ? {} : who) })} where id = ${r.id}`;
  // a plan bought with no sale on record (straight from the app): the form becomes its record, dated with the plan
  else await sql`insert into plan_recommendations ${sql({ patient_id: p.id, plan_id: sb.plan_id, assigned_by: x.me.id, created_at: sb.created_at, ...who, ...form })}`;
  await sql`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${x.me.id}, 'Filled in the sales form')`;
  return ok(c, null, "Sales form saved");
});

salesRoutes.post("/sales/patients/:patientId/payment-links", async (c) => {
  const x = await seller(c);
  const p = await customer(x, intParam(c.req.param("patientId"), "lead"));
  const b = await body<links.LinkInput & { salespersonId?: unknown }>(c);
  // an admin names who sold it (else the lead's own salesperson); a salesperson's links are their own
  const [named] = x.all ? await sql`select id, full_name from salespeople where id = ${Number(b.salespersonId) || p.salesperson_id || 0} and active` : [x.s];
  const made = await links.createLink(p as never, b, { userId: x.me.id, seller: (named as Seller) ?? null, isAdmin: x.all });
  return ok(c, made, made.texted ? "Link made. Razorpay has texted it to the customer; you can send it too."
    : "Link made. Copy it and send it to the customer.");
});

/** A link of one of my customers. */
async function myLink(x: Ctx, id: string) {
  const [l] = await sql`select l.id, l.status, l.patient_id from payment_links l left join patient_profiles pp on pp.user_id = l.patient_id
                        where l.id = ${id.slice(0, 40)} and l.purpose = 'PLAN' ${mine(x)}`;
  return l ?? fail(404, "That payment link was not found.");
}

salesRoutes.post("/sales/payment-links/:id/check", async (c) => {
  const x = await seller(c);
  const l = await myLink(x, c.req.param("id"));
  const status = await links.check(l.id).catch(() => fail(502, "Razorpay could not be reached. Try again in a moment."));
  return ok(c, { status }, status === "PAID" ? "Paid. The plan has started." : status === "CREATED" ? "Not paid yet." : "This link has ended.");
});

salesRoutes.post("/sales/payment-links/:id/cancel", async (c) => {
  const x = await seller(c);
  const { me } = x;
  const l = await myLink(x, c.req.param("id"));
  if (l.status !== "CREATED") fail(409, "Only a link still waiting can be withdrawn.");
  await links.cancelOpen(sql, l.patient_id);
  await sql`insert into audit_log (patient_id, actor_id, action) values (${l.patient_id}, ${me.id}, 'Withdrew a payment link')`;
  return ok(c, null, "Link withdrawn");
});

salesRoutes.post("/sales/patients/:patientId/sale", async (c) => {
  const x = await seller(c);
  const { me } = x;
  const p = await customer(x, intParam(c.req.param("patientId"), "lead"));
  const [s] = x.s ? [x.s] : await sql`select id, full_name from salespeople where id = ${p.salesperson_id ?? 0}`;
  const b = await body<{ planId?: unknown; paymentId?: unknown; coachPreference?: unknown; note?: unknown }>(c);
  const [plan] = await sql`select id, name, price_rupees, max_sales_discount_percent from plans
                           where id = ${Number(b.planId) || 0} and active and price_rupees > 0`;
  if (!plan) fail(400, "That plan is not available.");
  if (await onPlan(sql, p.id)) fail(409, "This customer is already on a plan.");
  const paymentId = String(b.paymentId ?? "").trim();
  // the least this plan can be sold for by a salesperson; Razorpay, never the form, says what was paid
  const amountPaise = await links.provePayment(paymentId, Math.round(plan.price_rupees * (100 - (x.all ? 90 : plan.max_sales_discount_percent)) / 100) * 100);
  const messages = await sql.begin(async (tx) => {
    await tx`delete from plan_recommendations where patient_id = ${p.id}
             and created_at > coalesce((select max(sb.created_at) from subscriptions sb where sb.user_id = ${p.id}), '-infinity')`;
    // the unique payment ID is the last word on "used once": a second form with it fails here
    await tx`insert into plan_recommendations (patient_id, plan_id, assigned_by, salesperson, salesperson_id, coach_preference, note, amount_paise, payment_ref)
             values (${p.id}, ${plan.id}, ${me.id}, ${s?.full_name ?? null}, ${s?.id ?? null}, ${words(b.coachPreference, 200)}, ${words(b.note, 1000)}, ${amountPaise}, ${paymentId})`;
    await startPlan(tx, p.id, plan.id, null);
    await tx`update received_payments set used_for_patient = ${p.id}, used_at = now() where id = ${paymentId}`;
    await tx`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${me.id},
               ${`Started ${plan.name}: Razorpay payment ${paymentId} (Rs ${amountPaise / 100})${s ? `, sold by ${s.full_name}` : ""}`})`;
    return await notices.within(tx, (sp) => notices.planStarted(sp, p.id, plan.name, paymentId));
  });
  await links.cancelOpen(sql, p.id);
  await sendNow(messages);
  return ok(c, { amountRupees: amountPaise / 100 }, `${plan.name} started`);
});

salesRoutes.get("/sales/consultations/:id/join", async (c) => {
  const x = await seller(c);
  const { me } = x;
  const [a] = await sql`
    select a.id, a.video_room_id, a.status, a.patient_id from appointments a left join patient_profiles pp on pp.user_id = a.patient_id
    where a.id = ${intParam(c.req.param("id"), "consultation")} ${mine(x)}`;
  if (!a) fail(404, "That consultation was not found.");
  if (a.status !== "Booked" && a.status !== "InProgress") fail(409, "This consultation is not open to join.");
  // joins with a guest's rights (the patient's room role): cannot end the call or remove anyone
  const url = await callLink(a as never, "patient", `${x.s?.full_name ?? me.fullName ?? "Care team"} (inrange)`, me.id)
    .catch(() => fail(502, "The video room could not be opened. Please try again in a moment."));
  await sql`insert into audit_log (patient_id, actor_id, action) values (${a.patient_id}, ${me.id}, 'Joined the consultation (sales)')`;
  return ok(c, { url });
});
