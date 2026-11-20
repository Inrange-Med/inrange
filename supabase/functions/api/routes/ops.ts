// The medicine queue: the care team's one place for medicine work (PRD 9.1). Mounted at /api.
// ADMIN sees everything and runs the pharmacy (orders, refunds); a COACH sees only their own patients,
// their tasks and their doses. Every look at a patient's medicines is written to audit_log.
// docs/backend/medicine-flow.md, "The medicine queue".
//   GET   /admin/medicine/summary                      counts for the tabs
//   GET   /admin/medicine/tasks?status=&kind=&mine=    the queue, soonest due first
//   POST  /admin/medicine/tasks/:taskId/done           { outcome, note, callBackAt? }
//   POST  /admin/medicine/tasks/:taskId/assign         { to: "me" | userId | null }
//   POST  /admin/medicine/tasks/:taskId/send-link      the app link to the patient on WhatsApp, after a call
//   GET   /admin/medicine/tasks/:taskId/unmatched      a MATCH_MEDICINE task's hand-typed lines (admin)
//   POST  /admin/medicine/tasks/:taskId/match          { line, medicineId } matches one to the master list (admin)
//   GET   /admin/medicine/patients?q=                  admin: every patient; a coach: their own
//   GET   /admin/medicine/patients/:patientId          everything about one patient's medicines, plan and sales
//   PATCH /admin/medicine/patients/:patientId/coach    { coachId | null } (admin)
//   PATCH /admin/medicine/patients/:patientId/salesperson  { name | "" } who sells to them (admin)
//   PUT   /admin/medicine/patients/:patientId/plan     { planId | null, salesperson? } puts them on a plan to pay for
//                                                     in the app, or withdraws it (admin; 20 Nov 2026)
//   GET   /admin/medicine/orders?status=               deliveries (admin)
//   POST  /admin/medicine/orders/:orderId/move         { to, courier?, trackingNo?, trackingUrl?, expectedAt?, note? } (admin)
//   POST  /admin/medicine/orders/:orderId/delay        { expectedAt } (admin)
//   POST  /admin/medicine/orders/:orderId/cancel       { reason } full refund (admin)
//   GET   /admin/medicine/messages?patientId=&status=  every message sent or skipped
//   POST  /admin/medicine/messages/:messageId/reply    { code?, text? } plays the patient's reply; mock mode only (admin)
//   GET   /admin/medicine/numbers?days=30              the PRD's measures (admin)
//   POST  /admin/whatsapp/templates/sync               submits lib/messages.ts's templates to Meta, returns each one's status (admin)
//   GET   /admin/coaches                               the coaches (admin)
//   POST  /admin/coaches                               { fullName, mobile } (admin)
import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "../lib/db.ts";
import { body, fail, intParam, ok } from "../lib/http.ts";
import { type AuthUser, requireUser } from "../lib/auth.ts";
import { nextWorkingMorning } from "../lib/hours.ts";
import * as flow from "../lib/medicineFlow.ts";
import { deliver, queueMessage } from "../lib/notify.ts";
import { handleReply } from "../lib/replies.ts";
import { priceCart, type CartLine } from "../lib/pharmacy.ts";
import { refundPayment } from "../integrations/razorpay.ts";
import { syncTemplates, whatsappLive } from "../integrations/whatsapp.ts";
import { env } from "../lib/env.ts";
import { TEMPLATES, type Template } from "../lib/messages.ts";
import { ist, lineOf, lineView } from "../lib/prescriptions.ts";
import { packsFor } from "../lib/medicineSearch.ts";
import { onPlan as hasPlan, pendingPlan } from "../lib/pharmacy.ts";

export const opsRoutes = new Hono();

const staff = (c: Context) => requireUser(c, "COACH");               // ADMIN always passes requireUser
const admin = (c: Context) => requireUser(c, "ADMIN");
const iso = (col: string) => sql`to_char(${sql(col)} at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"')`;
const name = sql`coalesce(nullif(trim(concat_ws(' ', pp.first_name, pp.last_name)), ''), pu.full_name, 'Patient ' || pu.id)`;

/** A coach reaches only patients assigned to them; an admin reaches everyone. */
const scope = (me: AuthUser) => (me.role === "COACH" ? sql`and pp.coach_id = ${me.id}` : sql``);

async function patientFor(me: AuthUser, patientId: number) {
  const [p] = await sql`
    select pu.id, pu.mobile, ${name} as name, pp.coach_id from users pu left join patient_profiles pp on pp.user_id = pu.id
    where pu.id = ${patientId} and pu.role = 'PATIENT' ${scope(me)}`;
  if (!p) fail(404, "That patient was not found.");
  return p;
}

/** What a coach works on; the pharmacy, payment and reconciliation tasks are the care team's alone. */
const COACH_TASKS = ["ADHERENCE", "REFILL_GAP", "QUESTIONS", "NO_REPLY", "PLAN_CALL"];

async function taskFor(me: AuthUser, taskId: number) {
  const [t] = await sql`select t.* from ops_tasks t left join patient_profiles pp on pp.user_id = t.patient_id
                        where t.id = ${taskId} ${scope(me)} ${me.role === "COACH" ? sql`and t.kind in ${sql(COACH_TASKS)}` : sql``}`;
  if (!t) fail(404, "That task was not found.");
  return t;
}

const entry = (me: AuthUser, what: string) => sql.json([{ at: new Date().toISOString(), by: me.id, byName: me.fullName ?? null, what }]);

// ---------------------------------------------------------------- summary and queue

opsRoutes.get("/admin/medicine/summary", async (c) => {
  const me = await staff(c);
  const [t] = await sql`
    select count(*) filter (where t.status = 'OPEN') as open,
      count(*) filter (where t.status = 'OPEN' and t.due_at < now()) as overdue,
      count(*) filter (where t.status = 'OPEN' and t.priority = 'CRITICAL') as critical,
      count(*) filter (where t.status = 'OPEN' and t.assigned_to = ${me.id}) as mine
    from ops_tasks t left join patient_profiles pp on pp.user_id = t.patient_id
    where true ${scope(me)} ${me.role === "COACH" ? sql`and t.kind in ${sql(COACH_TASKS)}` : sql``}`;
  const [o] = me.role === "ADMIN" ? await sql`
    select count(*) filter (where status in ('PLACED', 'PACKED')) as to_dispatch,
      count(*) filter (where status in ('DISPATCHED', 'OUT_FOR_DELIVERY')) as on_the_way
    from medicine_orders` : [{ to_dispatch: 0, on_the_way: 0 }];
  const [m] = await sql`select count(*) as failed from patient_messages where status = 'FAILED' and created_at > now() - interval '7 days'`;
  const [tick] = await sql`select ${iso("last_run_at")} as at from job_runs where name = 'tick'`;
  return ok(c, {
    tasks: { open: Number(t.open), overdue: Number(t.overdue), critical: Number(t.critical), mine: Number(t.mine) },
    orders: { toDispatch: Number(o.to_dispatch), onTheWay: Number(o.on_the_way) },
    messages: { failed: me.role === "ADMIN" ? Number(m.failed) : 0, whatsapp: whatsappLive() ? "live" : "mock" },
    lastTickAt: tick?.at ?? null,
    role: me.role,
  });
});

opsRoutes.get("/admin/medicine/tasks", async (c) => {
  const me = await staff(c);
  const status = c.req.query("status") === "DONE" ? "DONE" : "OPEN";
  const kind = c.req.query("kind") || null;
  const mine = c.req.query("mine") === "1";
  const rows = await sql`
    select t.id::text as id, t.kind, t.priority, t.title, t.detail, ${iso("t.due_at")} as "dueAt", t.status, t.outcome,
      t.outcome_note as "outcomeNote", ${iso("t.created_at")} as "createdAt", ${iso("t.done_at")} as "doneAt",
      t.patient_id::text as "patientId", ${name} as "patientName", pu.mobile as "patientMobile",
      t.assigned_to::text as "assignedTo", au.full_name as "assignedName",
      t.cart_id::text as "cartId", t.medicine_order_id::text as "orderId",
      case when t.medicine_order_id is not null then 'MED-' || lpad(t.medicine_order_id::text, 5, '0') end as "orderNumber"
    from ops_tasks t
    left join users pu on pu.id = t.patient_id
    left join patient_profiles pp on pp.user_id = t.patient_id
    left join users au on au.id = t.assigned_to
    where t.status = ${status} ${kind ? sql`and t.kind = ${kind}` : sql``} ${mine ? sql`and t.assigned_to = ${me.id}` : sql``} ${scope(me)}
      ${me.role === "COACH" ? sql`and t.kind in ${sql(COACH_TASKS)}` : sql``}
    order by ${status === "OPEN" ? sql`t.due_at asc, case t.priority when 'CRITICAL' then 0 when 'HIGH' then 1 else 2 end` : sql`t.done_at desc`}
    limit 200`;
  return ok(c, rows);
});

/** What closing a task can say. CALL_BACK and NO_ANSWER keep it open for later. */
const OUTCOMES = ["RESOLVED", "WILL_PAY", "PAID", "ELSEWHERE", "DECLINED", "CALL_BACK", "NO_ANSWER"] as const;

opsRoutes.post("/admin/medicine/tasks/:taskId/done", async (c) => {
  const me = await staff(c);
  const t = await taskFor(me, intParam(c.req.param("taskId"), "task"));
  if (t.status !== "OPEN") fail(409, "This task is already done.");
  const b = await body<{ outcome?: string; note?: unknown; callBackAt?: unknown }>(c);
  const outcome = OUTCOMES.find((o) => o === b.outcome) ?? fail(400, "Choose what happened.");
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 2000) : "";
  // every outcome is written down (PRD 9.1): what was said, so the next person can pick it up
  if (note.length < 3) fail(400, "Add a short note on what happened.");
  if (outcome === "CALL_BACK" || outcome === "NO_ANSWER") {
    const at = outcome === "NO_ANSWER" ? nextWorkingMorning(new Date()) : new Date(String(b.callBackAt ?? ""));
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() - 60_000) fail(400, "Choose when to call back.");
    await sql`update ops_tasks set due_at = ${at}, history = history || ${entry(me, `${outcome === "NO_ANSWER" ? "No answer" : "Call back"}: ${note}`)}
              where id = ${t.id}`;
    return ok(c, { id: String(t.id), status: "OPEN", dueAt: at.toISOString() }, "Moved to the call-back time");
  }
  await sql.begin(async (tx) => {
    await tx`update ops_tasks set status = 'DONE', outcome = ${outcome}, outcome_note = ${note}, done_at = now(), done_by = ${me.id},
             history = history || ${entry(me, `Done (${outcome.toLowerCase().replace("_", " ")}): ${note}`)} where id = ${t.id}`;
    if (t.cart_id && (outcome === "ELSEWHERE" || outcome === "DECLINED")) {
      if (outcome === "ELSEWHERE") await tx`update medicine_carts set elsewhere_at = coalesce(elsewhere_at, now()) where id = ${t.cart_id}`;
      await tx`update medicine_followups set stage = 'DONE', next_at = null, closed_reason = ${outcome}, closed_at = now(),
               history = history || ${entry(me, outcome === "DECLINED" ? `Declined: ${note}` : "Bought elsewhere (told the team)")}
               where cart_id = ${t.cart_id} and closed_at is null`;
    }
  });
  return ok(c, { id: String(t.id), status: "DONE" }, "Done");
});

opsRoutes.post("/admin/medicine/tasks/:taskId/assign", async (c) => {
  const me = await staff(c);
  const t = await taskFor(me, intParam(c.req.param("taskId"), "task"));
  const b = await body<{ to?: unknown }>(c);
  let to: number | null = null;
  if (b.to === "me") to = me.id;
  else if (b.to != null) {
    if (me.role !== "ADMIN") fail(403, "Only an admin can assign to someone else.");
    const [u] = await sql`select id from users where id = ${Number(b.to) || 0} and role in ('ADMIN', 'COACH')`;
    if (!u) fail(400, "That person is not on the care team.");
    to = u.id;
  }
  const [u] = to ? await sql`select full_name from users where id = ${to}` : [];
  await sql`update ops_tasks set assigned_to = ${to}, history = history || ${entry(me, to ? `Assigned to ${u?.full_name ?? "someone"}` : "Unassigned")}
            where id = ${t.id}`;
  return ok(c, { id: String(t.id), assignedTo: to ? String(to) : null }, to ? "Assigned" : "Unassigned");
});

opsRoutes.post("/admin/medicine/tasks/:taskId/send-link", async (c) => {
  const me = await staff(c);
  const t = await taskFor(me, intParam(c.req.param("taskId"), "task"));
  const [k] = t.cart_id ? await sql`select * from medicine_carts where id = ${t.cart_id}` : [];
  if (!k || k.status !== "OPEN") fail(409, "There is no open order to send.");
  const [{ n }] = await sql`select count(*)::int as n from patient_messages where dedupe_key like ${`task:${t.id}:link:%`}`;
  if (n >= 3) fail(429, "The link was sent three times already. Call the patient instead.");
  const [p] = await sql`select coalesce(nullif(first_name, ''), 'there') as first from patient_profiles where user_id = ${k.patient_id}`;
  const id = await queueMessage(sql, { patientId: k.patient_id, kind: "CARE_LINK", values: [p?.first ?? "there"], dedupeKey: `task:${t.id}:link:${n + 1}`, cartId: k.id });
  const result = id ? await deliver(id) : "SKIPPED";
  await sql`update ops_tasks set history = history || ${entry(me, result === "SENT" ? "Sent the app link on WhatsApp" : `App link not sent (${result.toLowerCase()})`)}
            where id = ${t.id}`;
  if (result === "SKIPPED") fail(409, "The link was not sent: the patient has WhatsApp off. Read it to them on the call.");
  return ok(c, { result }, "App link sent");
});

// ---------------------------------------------------------------- matching a hand-typed medicine (doctor portal v2)

/** The prescription a MATCH_MEDICINE task is about, and its lines that are still not on the list. */
async function unmatchedOf(taskId: number) {
  const [t] = await sql`select * from ops_tasks where id = ${taskId} and kind = 'MATCH_MEDICINE'`;
  if (!t) fail(404, "That task was not found.");
  const [rx] = await sql`select * from prescriptions where id = ${t.prescription_id}`;
  if (!rx) fail(404, "The prescription for this task was not found.");
  // deno-lint-ignore no-explicit-any
  const lines = (rx.items as Record<string, any>[]).map((l, index) => ({ index, ...lineView(l) })).filter((l) => l.unlisted);
  return { t, rx, lines };
}

opsRoutes.get("/admin/medicine/tasks/:taskId/unmatched", async (c) => {
  await admin(c);
  const { rx, lines } = await unmatchedOf(intParam(c.req.param("taskId"), "task"));
  return ok(c, { prescriptionId: String(rx.id), current: rx.status === "SIGNED", lines });
});

/**
 * Matches one hand-typed line to a master-list item: the line takes the item (the PDF the patient has stays
 * as it was signed), and while the prescription is current and the item is sold, its packs join the open
 * cart (or start one). The task closes when nothing is left unmatched.
 */
opsRoutes.post("/admin/medicine/tasks/:taskId/match", async (c) => {
  const me = await admin(c);
  const b = await body<{ line?: unknown; medicineId?: unknown }>(c);
  const { t, rx, lines } = await unmatchedOf(intParam(c.req.param("taskId"), "task"));
  if (t.status !== "OPEN") fail(409, "This task is done already.");
  const index = Number(b.line);
  if (!lines.some((l) => l.index === index)) fail(400, "That line is matched already.");
  const [m] = await sql`select * from medicines where id = ${Number(b.medicineId) || 0} and active`;
  if (!m) fail(400, "Choose an item from the master list.");
  const left = await sql.begin(async (tx) => {
    // the prescription row is locked, so two lines matched at once never undo each other
    const [cur] = await tx`select * from prescriptions where id = ${rx.id} for update`;
    // deno-lint-ignore no-explicit-any
    const items = cur.items as Record<string, any>[];
    const was = items[index];
    if (!was?.unlisted) fail(409, "That line was matched a moment ago.");
    const matched: Record<string, unknown> = {
      ...lineOf({ ...was, frequency: was.frequencyCode, durationValue: was.durationValue, durationUnit: was.durationUnit }, m, index),
      typedAs: was.medicineName,
    };
    items[index] = matched;
    await tx`update prescriptions set items = ${tx.json(items as never)} where id = ${cur.id}`;
    if (cur.status === "SIGNED" && m.mrp_paise != null) {
      const onPlan = await hasPlan(tx, cur.patient_id);
      // as at Send: without a plan the order carries one month (lib/prescriptions.ts issueRx)
      const full = Number(matched.quantity) || 1;
      const q = onPlan ? full : Math.min(full, packsFor(30, m.pack_days));
      const [k] = await tx`select * from medicine_carts where prescription_id = ${cur.id} and status = 'OPEN'`;
      if (k) {
        const cartLines = (k.lines as CartLine[]).filter((l) => l.medicineId !== m.id);
        const prev = (k.lines as CartLine[]).find((l) => l.medicineId === m.id);
        cartLines.push({ medicineId: m.id, quantity: (prev?.quantity ?? 0) + q, prescribed: (prev?.prescribed ?? 0) + q });
        await tx`update medicine_carts set lines = ${tx.json(cartLines)} where id = ${k.id}`;
      } else {
        // a paid order does not take new lines, so the matched medicine starts its own; a closed one stays closed
        const [existing] = await tx`select 1 from medicine_carts where prescription_id = ${cur.id} and status <> 'PAID'`;
        if (!existing) {
          // nothing left to order on this prescription until now: its order, and its follow-up, start here
          const [addr] = await tx`select id from addresses where user_id = ${cur.patient_id} order by is_default desc, id desc limit 1`;
          const [cart] = await tx`
            insert into medicine_carts (patient_id, prescription_id, available_at, lines, address_id)
            values (${cur.patient_id}, ${cur.id}, now(), ${tx.json([{ medicineId: m.id, quantity: q, prescribed: q }])}, ${addr?.id ?? null})
            returning id`;
          await tx`
            insert into medicine_followups (cart_id, patient_id, flow, stage, next_at, history)
            values (${cart.id}, ${cur.patient_id}, ${onPlan ? "PLAN" : "NANO"}, 'WAITING',
              now() + interval '1 day',
              ${tx.json([{ at: new Date().toISOString(), what: "Order opened when the care team matched a medicine" }])})
            on conflict (cart_id) do nothing`;
          await tx`update ops_tasks set cart_id = ${cart.id} where id = ${t.id}`;
        }
      }
    }
    const remaining = items.filter((x) => x.unlisted).length;
    const what = `Matched "${String(was.medicineName)}" to ${m.brand} ${m.strength}`;
    await tx`update ops_tasks set history = history || ${entry(me, what)}
             ${remaining ? sql`` : sql`, status = 'DONE', outcome = 'RESOLVED', outcome_note = 'Every medicine matched to the list', done_by = ${me.id}, done_at = now()`}
             where id = ${t.id}`;
    await tx`insert into audit_log (patient_id, actor_id, action) values (${cur.patient_id}, ${me.id}, ${what})`;
    return remaining;
  });
  return ok(c, { left }, left ? "Matched" : "All matched");
});

// ---------------------------------------------------------------- patients

opsRoutes.get("/admin/medicine/patients", async (c) => {
  const me = await staff(c);
  const q = (c.req.query("q") ?? "").trim().toLowerCase().slice(0, 40);
  const rows = await sql`
    select pu.id::text as id, ${name} as name, pu.mobile, pp.coach_id::text as "coachId", cu.full_name as "coachName",
      pp.salesperson, (select pl.name from subscriptions sb join plans pl on pl.id = sb.plan_id
        where sb.user_id = pu.id and sb.status = 'Active' and sb.ends_at > now() order by sb.ends_at desc limit 1) as "planName",
      lo.status as "lastOrderStatus", ${iso("lo.placed_at")} as "lastOrderAt",
      case when lo.supply_days is not null and lo.delivered_at is not null
        then to_char((lo.delivered_at + make_interval(days => lo.supply_days)) at time zone 'Asia/Kolkata', 'YYYY-MM-DD') end as "runOutOn",
      (select count(*) from ops_tasks t where t.patient_id = pu.id and t.status = 'OPEN')::int as "openTasks",
      ad.resolved::int as "dosesResolved", ad.taken::int as "dosesTaken",
      exists (select 1 from consents x where x.user_id = pu.id and x.consent_type = 'WHATSAPP' and x.revoked_at is null) as whatsapp
    from users pu
    left join patient_profiles pp on pp.user_id = pu.id
    left join users cu on cu.id = pp.coach_id
    left join lateral (select * from medicine_orders o where o.patient_id = pu.id order by o.id desc limit 1) lo on true
    left join lateral (select count(*) filter (where status <> 'DUE') as resolved, count(*) filter (where status in ('TAKEN', 'TAKEN_LATE')) as taken
                       from dose_events e where e.patient_id = pu.id and e.due_at > now() - interval '28 days') ad on true
    where pu.role = 'PATIENT' ${scope(me)}
      ${q ? sql`and (lower(${name}) like ${`%${q}%`} or pu.mobile like ${`%${q}%`})` : sql``}
    order by coalesce(lo.placed_at, pu.created_at) desc limit 200`;
  return ok(c, rows);
});

opsRoutes.get("/admin/medicine/patients/:patientId", async (c) => {
  const me = await staff(c);
  const p = await patientFor(me, intParam(c.req.param("patientId"), "patient"));
  await sql`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${me.id}, ${`Viewed medicines (${me.role === "COACH" ? "coach" : "care team"})`})`;
  const [[rx], carts, followups, orders, messages, replies, tasks, schedules, events, [plan], [coach], [consent], [profile], assigned] = await Promise.all([
    sql`select p.id, p.items, p.months, ${iso("p.signed_at")} as signed, ${iso("p.valid_until")} as valid, d.full_name as doctor
        from prescriptions p join doctors d on d.id = p.doctor_id where p.patient_id = ${p.id} and p.status = 'SIGNED' order by p.signed_at desc limit 1`,
    sql`select k.*, rx.months from medicine_carts k join prescriptions rx on rx.id = k.prescription_id
        where k.patient_id = ${p.id} order by k.id desc limit 5`,
    sql`select f.*, ${iso("f.next_at")} as next_iso from medicine_followups f where f.patient_id = ${p.id} order by f.id desc limit 5`,
    sql`select o.*, ${iso("o.placed_at")} as placed_iso, ${iso("o.expected_at")} as expected_iso, ${iso("o.delivered_at")} as delivered_iso
        from medicine_orders o where o.patient_id = ${p.id} order by o.id desc limit 10`,
    sql`select id, kind, status, skip_reason, vars, error, ${iso("created_at")} as created, ${iso("sent_at")} as sent, ${iso("send_after")} as send_after,
          ${iso("read_at")} as read, cart_id, medicine_order_id, dose_event_id
        from patient_messages where patient_id = ${p.id} order by id desc limit 60`,
    sql`select id, message_id, action, text, outcome, ${iso("received_at")} as at from patient_message_replies
        where patient_id = ${p.id} order by id desc limit 60`,
    sql`select id, kind, priority, title, status, outcome, outcome_note, ${iso("due_at")} as due, history from ops_tasks
        where patient_id = ${p.id} order by (status = 'OPEN') desc, id desc limit 30`,
    sql`select id, medicine, cadence, weekday, times, paused, to_char(starts_on, 'YYYY-MM-DD') as starts, to_char(ends_on, 'YYYY-MM-DD') as ends
        from dose_schedules where patient_id = ${p.id} order by id desc limit 10`,
    sql`select e.id, s.medicine, e.status, e.skip_reason, ${iso("e.due_at")} as due from dose_events e join dose_schedules s on s.id = e.schedule_id
        where e.patient_id = ${p.id} and e.due_at < now() + interval '3 days' order by e.due_at desc limit 30`,
    sql`select pl.name, ${iso("s.ends_at")} as ends from subscriptions s join plans pl on pl.id = s.plan_id
        where s.user_id = ${p.id} and s.status = 'Active' and s.ends_at > now() order by s.ends_at desc limit 1`,
    p.coach_id ? sql`select id, full_name from users where id = ${p.coach_id}` : Promise.resolve([]),
    sql`select ${iso("accepted_at")} as at from consents where user_id = ${p.id} and consent_type = 'WHATSAPP' and revoked_at is null limit 1`,
    sql`select salesperson from patient_profiles where user_id = ${p.id}`,
    pendingPlan(sql, p.id),
  ]);
  const priced = await Promise.all(carts.map((k) => priceCart(sql, k as never)));
  return ok(c, {
    patient: { id: String(p.id), name: p.name, mobile: p.mobile, plan: plan?.name ?? null, planEndsAt: plan?.ends ?? null,
      whatsappSince: consent?.at ?? null, coach: coach ? { id: String(coach.id), name: coach.full_name } : null,
      salesperson: profile?.salesperson ?? null,
      // the plan admin put them on that they have not paid for yet (it waits in the app, with any medicines)
      assignedPlan: assigned ? { planId: String(assigned.plan_id), name: assigned.name, priceRupees: assigned.price_rupees,
        assignedAt: ist(assigned.created_at), salesperson: assigned.salesperson ?? null } : null },
    prescription: rx ? { id: String(rx.id), doctor: rx.doctor, signedAt: rx.signed, validUntil: rx.valid, months: rx.months,
      items: (rx.items ?? []).map((i: Record<string, unknown>) => ({ name: `${i.medicineName ?? ""} ${i.strength ?? ""}`.trim(), frequency: i.frequency ?? "", stocked: Boolean(i.medicineId) })) } : null,
    carts: carts.map((k, i) => ({ id: String(k.id), kind: k.kind, status: k.status, boughtElsewhere: Boolean(k.elsewhere_at),
      totalPaise: priced[i].totalPaise, lines: priced[i].lines.map((l) => ({ name: `${l.brand} ${l.strength}`, quantity: l.quantity, prescribed: l.prescribed })) })),
    followups: followups.map((f) => ({ id: String(f.id), cartId: String(f.cart_id), flow: f.flow, stage: f.stage, nextAt: f.next_iso, closedReason: f.closed_reason, history: f.history })),
    orders: orders.map((o) => ({ id: String(o.id), orderNumber: flow.orderNumber(o.id), status: o.status, flow: o.flow, placedAt: o.placed_iso,
      expectedAt: o.expected_iso, deliveredAt: o.delivered_iso, courier: o.courier, trackingNo: o.tracking_no, trackingUrl: o.tracking_url,
      items: o.items, history: o.history, feedback: o.feedback, feedbackNote: o.feedback_note, supplyDays: o.supply_days })),
    messages: messages.map((m) => ({ id: String(m.id), kind: m.kind, status: m.status, skipReason: m.skip_reason, error: m.error,
      values: m.vars?.values ?? null, text: m.vars?.text ?? null, choices: m.vars?.rows ?? null,
      createdAt: m.created, sentAt: m.sent, readAt: m.read, sendAfter: m.send_after,
      replies: replies.filter((r) => r.message_id === m.id).map((r) => ({ action: r.action, text: r.text, outcome: r.outcome, at: r.at })) })),
    looseReplies: replies.filter((r) => !r.message_id).map((r) => ({ text: r.text, outcome: r.outcome, at: r.at })),
    tasks: tasks.map((t) => ({ id: String(t.id), kind: t.kind, priority: t.priority, title: t.title, status: t.status, outcome: t.outcome,
      outcomeNote: t.outcome_note, dueAt: t.due, history: t.history })),
    doses: {
      schedules: schedules.map((s) => ({ id: String(s.id), medicine: s.medicine, cadence: s.cadence, weekday: s.weekday, times: s.times, paused: s.paused, startsOn: s.starts, endsOn: s.ends })),
      events: events.map((e) => ({ id: String(e.id), medicine: e.medicine, status: e.status, skipReason: e.skip_reason, dueAt: e.due })),
    },
  });
});

opsRoutes.patch("/admin/medicine/patients/:patientId/coach", async (c) => {
  const me = await admin(c);
  const p = await patientFor(me, intParam(c.req.param("patientId"), "patient"));
  const b = await body<{ coachId?: unknown }>(c);
  let coachId: number | null = null;
  if (b.coachId != null && b.coachId !== "") {
    const [u] = await sql`select id from users where id = ${Number(b.coachId) || 0} and role = 'COACH'`;
    if (!u) fail(400, "That coach was not found.");
    coachId = u.id;
  }
  await sql.begin(async (tx) => {
    await tx`update patient_profiles set coach_id = ${coachId} where user_id = ${p.id}`;
    // the patient's open coaching tasks follow them to the new coach
    await tx`update ops_tasks set assigned_to = ${coachId} where patient_id = ${p.id} and status = 'OPEN' and kind in ('ADHERENCE', 'REFILL_GAP')`;
    await tx`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${me.id}, ${coachId ? "Assigned a health coach" : "Removed the health coach"})`;
  });
  return ok(c, { coachId: coachId ? String(coachId) : null }, coachId ? "Coach assigned" : "Coach removed");
});

opsRoutes.patch("/admin/medicine/patients/:patientId/salesperson", async (c) => {
  const me = await admin(c);
  const p = await patientFor(me, intParam(c.req.param("patientId"), "patient"));
  const b = await body<{ name?: unknown }>(c);
  const name = String(b.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80) || null;
  await sql.begin(async (tx) => {
    await tx`insert into patient_profiles (user_id, salesperson) values (${p.id}, ${name})
             on conflict (user_id) do update set salesperson = excluded.salesperson`;
    await tx`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${me.id}, ${name ? `Salesperson set: ${name}` : "Salesperson removed"})`;
  });
  return ok(c, { salesperson: name }, name ? "Salesperson saved" : "Salesperson removed");
});

/**
 * Puts the patient on a plan (20 Nov 2026): the salesperson sold it on the call and told admin. From now the app asks
 * the patient to pay for it, with any medicines waiting in the same payment (lib/pharmacy.ts priceCart). A plan
 * assigned again replaces the one not yet paid for; `planId: null` withdraws it. Never for someone already on a plan.
 */
opsRoutes.put("/admin/medicine/patients/:patientId/plan", async (c) => {
  const me = await admin(c);
  const p = await patientFor(me, intParam(c.req.param("patientId"), "patient"));
  const b = await body<{ planId?: unknown; salesperson?: unknown }>(c);
  const planId = b.planId == null || b.planId === "" ? null : Number(b.planId);
  const salesperson = String(b.salesperson ?? "").trim().replace(/\s+/g, " ").slice(0, 80) || null;
  const [plan] = planId ? await sql`select id, name from plans where id = ${planId} and active and price_rupees > 0` : [];
  if (planId !== null && !plan) fail(400, "That plan is not available.");
  if (plan && await hasPlan(sql, p.id)) fail(409, "This patient is already on a plan.");
  await sql.begin(async (tx) => {
    // the plan not yet paid for (an earlier assignment, or a doctor's old suggestion) gives way to this one
    await tx`delete from plan_recommendations where patient_id = ${p.id}
             and created_at > coalesce((select max(s.created_at) from subscriptions s where s.user_id = ${p.id}), '-infinity')`;
    if (plan)
      await tx`insert into plan_recommendations (patient_id, plan_id, assigned_by, salesperson)
               values (${p.id}, ${plan.id}, ${me.id}, ${salesperson})`;
    if (salesperson)
      await tx`insert into patient_profiles (user_id, salesperson) values (${p.id}, ${salesperson})
               on conflict (user_id) do update set salesperson = excluded.salesperson`;
    await tx`insert into audit_log (patient_id, actor_id, action)
             values (${p.id}, ${me.id}, ${plan ? `Put on ${plan.name}${salesperson ? `, sold by ${salesperson}` : ""}` : "Plan withdrawn before payment"})`;
  });
  return ok(c, { planId: plan ? String(plan.id) : null }, plan ? `${plan.name}: waiting for the patient to pay in the app` : "Plan withdrawn");
});

// ---------------------------------------------------------------- deliveries (the pharmacy)

opsRoutes.get("/admin/medicine/orders", async (c) => {
  await admin(c);
  const status = c.req.query("status") || null;
  const rows = await sql`
    select o.id::text as id, 'MED-' || lpad(o.id::text, 5, '0') as "orderNumber", o.status, o.flow, ${iso("o.placed_at")} as "placedAt",
      ${iso("o.expected_at")} as "expectedAt", ${iso("o.dispatched_at")} as "dispatchedAt", ${iso("o.delivered_at")} as "deliveredAt",
      to_char((o.placed_at + make_interval(hours => case when o.flow = 'PLAN' then ${flow.DISPATCH_HOURS.PLAN}::int else ${flow.DISPATCH_HOURS.NANO}::int end))
        at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') as "dispatchBy",
      o.courier, o.tracking_no as "trackingNo", o.tracking_url as "trackingUrl", o.items, o.feedback,
      o.patient_id::text as "patientId", ${name} as "patientName", pu.mobile as "patientMobile",
      concat_ws(', ', a.line1, a.line2, a.city, a.pincode) as address
    from medicine_orders o
    join users pu on pu.id = o.patient_id left join patient_profiles pp on pp.user_id = o.patient_id
    left join addresses a on a.id = o.address_id
    where ${status ? sql`o.status = ${status}` : sql`(o.status not in ('DELIVERED', 'CANCELLED') or o.delivered_at > now() - interval '3 days')`}
    order by case o.status when 'PLACED' then 0 when 'PACKED' then 1 when 'DISPATCHED' then 2 when 'OUT_FOR_DELIVERY' then 3 else 4 end, o.placed_at
    limit 200`;
  return ok(c, rows);
});

opsRoutes.post("/admin/medicine/orders/:orderId/move", async (c) => {
  const me = await admin(c);
  const id = intParam(c.req.param("orderId"), "order");
  const b = await body<{ to?: string; courier?: string; trackingNo?: string; trackingUrl?: string; expectedAt?: string; note?: string }>(c);
  const to = flow.ORDER_STEPS.find((s) => s === b.to);
  if (!to || to === "PLACED") fail(400, "Choose the next step.");
  const expectedAt = b.expectedAt ? new Date(b.expectedAt) : null;
  if (expectedAt && Number.isNaN(expectedAt.getTime())) fail(400, "That date is not valid.");
  try {
    const o = await flow.moveOrder(id, to!, me.id, { courier: b.courier, trackingNo: b.trackingNo, trackingUrl: b.trackingUrl, expectedAt, note: b.note });
    return ok(c, { id: String(id), status: o.status }, "Order updated");
  } catch (e) {
    return fail(400, (e as Error).message);
  }
});

opsRoutes.post("/admin/medicine/orders/:orderId/delay", async (c) => {
  const me = await admin(c);
  const id = intParam(c.req.param("orderId"), "order");
  const b = await body<{ expectedAt?: string }>(c);
  const at = new Date(String(b.expectedAt ?? ""));
  if (Number.isNaN(at.getTime()) || at.getTime() < Date.now()) fail(400, "Choose the new expected date.");
  try {
    await flow.delayOrder(id, at, me.id);
  } catch (e) {
    fail(400, (e as Error).message);
  }
  await flow.closeTasks(sql, { medicineOrderId: id }, ["DELIVERY_LATE"], "RESOLVED", "Gave the patient a new date");
  return ok(c, { id: String(id), expectedAt: at.toISOString() }, "New date sent to the patient");
});

opsRoutes.post("/admin/medicine/orders/:orderId/cancel", async (c) => {
  const me = await admin(c);
  const id = intParam(c.req.param("orderId"), "order");
  const b = await body<{ reason?: unknown }>(c);
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 500) : "";
  if (reason.length < 3) fail(400, "Say why the order is cancelled.");
  // the claim: one cancel at a time, and only for an order still on its way (a delivered one is a return,
  // handled by the team). cancelled_at marks it as being cancelled until the refund is in.
  const [o] = await sql`
    update medicine_orders o set cancelled_at = now() from (select id from medicine_orders where id = ${id} for update) x
    where o.id = x.id and o.status in ('PLACED', 'PACKED', 'DISPATCHED', 'OUT_FOR_DELIVERY')
      -- a cancel that stopped half-way (the refund made, the rest not) can be finished; a stuck claim frees after 5 minutes
      and (o.cancelled_at is null or o.refund_id is not null or o.cancelled_at < now() - interval '5 minutes')
    returning o.*, (select p.provider_payment_id from payment_orders p where p.id = o.payment_order_id) as provider_payment_id,
      (select p.amount_paise from payment_orders p where p.id = o.payment_order_id) as amount_paise`;
  if (!o) {
    const [now] = await sql`select status, cancelled_at from medicine_orders where id = ${id}`;
    if (!now) fail(404, "That order was not found.");
    fail(409, now.status === "CANCELLED" ? "This order is already cancelled." : now.status === "DELIVERED"
      ? "This order is delivered. Handle a return with the patient first." : "This order is being cancelled already.");
  }
  // the refund first: an order is only marked cancelled once the money is on its way back
  let refundId: string | null = o.refund_id ?? null;
  if (!refundId && o.provider_payment_id && o.amount_paise)
    refundId = await refundPayment(o.provider_payment_id, o.amount_paise, { order: flow.orderNumber(id), reason }).catch(async () => {
      await sql`update medicine_orders set cancelled_at = null where id = ${id}`;
      return fail(502, "The refund could not be started. Nothing was changed. Try again, or refund in the Razorpay dashboard.");
    });
  // the refund is on its way: write it down before anything else can fail
  if (refundId) await sql`update medicine_orders set refund_id = ${refundId} where id = ${id}`;
  await sql.begin(async (tx) => {
    await tx`update medicine_orders set status = 'CANCELLED', cancel_reason = ${reason}, refund_id = ${refundId},
             refunded_paise = ${refundId ? o.amount_paise : null},
             history = history || ${tx.json([{ status: "CANCELLED", at: new Date().toISOString(), note: reason, by: me.id }])} where id = ${id}`;
    // the prescription can be ordered again: its cart opens (unless another order on it is open already)
    await tx`update medicine_carts k set status = 'OPEN', paid_at = null where k.id = ${o.cart_id}
             and not exists (select 1 from medicine_carts x where x.prescription_id = k.prescription_id and x.status = 'OPEN')`;
    if (o.payment_order_id)
      await tx`update payment_orders set meta = meta || ${tx.json({ refundId, refundedAt: new Date().toISOString(), refundReason: reason })} where id = ${o.payment_order_id}`;
    await tx`update dose_schedules set ends_on = (now() at time zone 'Asia/Kolkata')::date where medicine_order_id = ${id}`;
    await tx`delete from dose_events e using dose_schedules s where s.id = e.schedule_id and s.medicine_order_id = ${id} and e.status = 'DUE' and e.due_at > now()`;
    await queueMessage(tx, { patientId: o.patient_id, kind: "ORDER_CANCELLED", values: [flow.orderNumber(id)], dedupeKey: `order:${id}:CANCELLED`, medicineOrderId: id });
  });
  await flow.closeTasks(sql, { medicineOrderId: id }, ["DISPATCH_DUE", "DELIVERY_LATE", "DELIVERY_ISSUE"], "RESOLVED", "Order cancelled and refunded");
  await flow.deliverQueued({ medicineOrderId: id });
  return ok(c, { id: String(id), status: "CANCELLED", refundId }, refundId ? "Cancelled and refunded" : "Cancelled");
});

// ---------------------------------------------------------------- messages

opsRoutes.get("/admin/medicine/messages", async (c) => {
  const me = await staff(c);
  const patientId = Number(c.req.query("patientId")) || null;
  const status = c.req.query("status") || null;
  if (patientId) {
    const p = await patientFor(me, patientId);
    await sql`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${me.id}, 'Viewed WhatsApp messages')`;
  }
  const rows = await sql`
    select m.id::text as id, m.kind, m.status, m.skip_reason as "skipReason", m.error, m.vars, ${iso("m.created_at")} as "createdAt",
      ${iso("m.send_after")} as "sendAfter", ${iso("m.sent_at")} as "sentAt", ${iso("m.read_at")} as "readAt",
      m.patient_id::text as "patientId", ${name} as "patientName"
    from patient_messages m join users pu on pu.id = m.patient_id left join patient_profiles pp on pp.user_id = m.patient_id
    where true ${patientId ? sql`and m.patient_id = ${patientId}` : sql``} ${status ? sql`and m.status = ${status}` : sql``} ${scope(me)}
    order by m.id desc limit 200`;
  return ok(c, rows.map((m) => ({ ...m, values: m.vars?.values ?? null, text: m.vars?.text ?? null, choices: m.vars?.rows ?? null, vars: undefined })));
});

opsRoutes.post("/admin/medicine/messages/:messageId/reply", async (c) => {
  const me = await admin(c);
  if (whatsappLive()) fail(409, "WhatsApp is live: replies come from the patient's phone only.");
  const id = intParam(c.req.param("messageId"), "message");
  const [m] = await sql`select m.*, u.role from patient_messages m join users u on u.id = m.patient_id where m.id = ${id}`;
  if (!m) fail(404, "That message was not found.");
  const b = await body<{ code?: string; text?: string }>(c);
  const outcome = await handleReply({
    userId: m.patient_id, role: m.role, ref: m.id, code: b.code ?? null, text: typeof b.text === "string" ? b.text.slice(0, 2000) : null,
    eventId: `sim-${me.id}-${crypto.randomUUID()}`,
  });
  // a reply played in test mode changes the record like the patient's own: who played it is logged
  await sql`insert into audit_log (patient_id, actor_id, action) values (${m.patient_id}, ${me.id}, ${`Played a WhatsApp reply in test mode: ${b.code ?? "text"} (${outcome})`.slice(0, 300)})`;
  return ok(c, { outcome }, outcome);
});

// ---------------------------------------------------------------- the measures (PRD 14)

opsRoutes.get("/admin/medicine/numbers", async (c) => {
  await admin(c);
  const days = Math.min(365, Math.max(7, Number(c.req.query("days")) || 30));
  const since = sql`now() - make_interval(days => ${days}::int)`;
  const [[rx], [msg], [checkIn], [del], [fb], [disp], [adh], [tasks]] = await Promise.all([
    // prescription to paid within 7 days, over prescriptions old enough to have had their 7 days
    sql`select count(*) as total, count(*) filter (where k.paid_at <= p.signed_at + interval '7 days') as paid
        from prescriptions p join medicine_carts k on k.prescription_id = p.id and k.kind = 'FIRST'
        where p.signed_at > ${since} and p.signed_at < now() - interval '7 days'`,
    sql`select count(*) filter (where m.status in ('SENT', 'DELIVERED', 'READ')) as sent,
          count(*) filter (where m.status in ('SENT', 'DELIVERED', 'READ') and m.sent_at <= p.signed_at + interval '5 minutes') as fast,
          count(*) filter (where m.status = 'SKIPPED') as skipped
        from patient_messages m join prescriptions p on p.id = m.prescription_id
        where m.kind = 'RX_READY' and m.created_at > ${since}`,
    sql`select count(*) as sent, count(*) filter (where exists (select 1 from patient_message_replies r where r.message_id = m.id)) as answered
        from patient_messages m where m.kind = 'CHECK_IN' and m.dedupe_key like 'fu:%:c1' and m.status in ('SENT', 'DELIVERED', 'READ') and m.created_at > ${since}`,
    sql`select count(*) filter (where status = 'DELIVERED') as delivered,
          count(*) filter (where status = 'DELIVERED' and delivered_at <= expected_at + interval '6 hours') as on_time
        from medicine_orders where placed_at > ${since}`,
    sql`select count(*) filter (where feedback = 'GOOD') as good, count(*) filter (where feedback = 'ISSUE') as issue
        from medicine_orders where placed_at > ${since}`,
    sql`select count(*) filter (where dispatched_at is not null) as dispatched,
          count(*) filter (where dispatched_at <= placed_at + make_interval(hours => case when flow = 'PLAN' then ${flow.DISPATCH_HOURS.PLAN}::int else ${flow.DISPATCH_HOURS.NANO}::int end)) as in_time
        from medicine_orders where placed_at > ${since}`,
    sql`select count(*) filter (where status <> 'DUE') as resolved, count(*) filter (where status in ('TAKEN', 'TAKEN_LATE')) as taken
        from dose_events where due_at > ${since} and due_at < now()`,
    sql`select count(*) filter (where kind = 'DELIVERY_ISSUE') as issues,
          count(*) filter (where status = 'OPEN' and due_at < now()) as overdue,
          percentile_cont(0.5) within group (order by extract(epoch from done_at - created_at)) filter (where status = 'DONE') as median_close
        from ops_tasks where created_at > ${since}`,
  ]);
  const pct = (a: unknown, b: unknown) => (Number(b) > 0 ? Math.round((Number(a) / Number(b)) * 1000) / 10 : null);
  return ok(c, {
    days,
    measures: [
      { key: "rxToPaid", label: "Prescriptions paid for within 7 days", value: pct(rx.paid, rx.total), unit: "%", target: 70, base: Number(rx.total) },
      { key: "rxMessage", label: "Prescription on WhatsApp within 5 minutes", value: pct(msg.fast, msg.sent), unit: "%", target: 99, base: Number(msg.sent),
        note: Number(msg.skipped) ? `${msg.skipped} not sent: WhatsApp off` : null },
      { key: "checkInReplies", label: "First check-ins answered", value: pct(checkIn.answered, checkIn.sent), unit: "%", target: 60, base: Number(checkIn.sent) },
      { key: "dispatchInTime", label: "Dispatched in time", value: pct(disp.in_time, disp.dispatched), unit: "%", target: 95, base: Number(disp.dispatched) },
      { key: "deliveredOnTime", label: "Delivered by the expected date", value: pct(del.on_time, del.delivered), unit: "%", target: 95, base: Number(del.delivered) },
      { key: "escalations", label: "Delivery problems per 100 orders", value: Number(del.delivered) ? Math.round((Number(tasks.issues) / Number(del.delivered)) * 1000) / 10 : null,
        unit: "", target: 2, lowerIsBetter: true, base: Number(del.delivered) },
      { key: "satisfaction", label: "Deliveries rated All good", value: pct(fb.good, Number(fb.good) + Number(fb.issue)), unit: "%", target: 90, base: Number(fb.good) + Number(fb.issue) },
      { key: "adherence", label: "Doses taken", value: pct(adh.taken, adh.resolved), unit: "%", target: 80, base: Number(adh.resolved) },
      { key: "tasksOverdue", label: "Tasks overdue now", value: Number(tasks.overdue), unit: "", target: 0, lowerIsBetter: true },
      { key: "taskClose", label: "Median time to close a task", value: tasks.median_close == null ? null : Math.round((Number(tasks.median_close) / 3600) * 10) / 10, unit: "h", lowerIsBetter: true },
    ],
  });
});

// ---------------------------------------------------------------- WhatsApp templates

/** Every template in lib/messages.ts that Meta lacks is submitted (category UTILITY, English); the rest are listed with their status. */
opsRoutes.post("/admin/whatsapp/templates/sync", async (c) => {
  await admin(c);
  try {
    const templates = await syncTemplates(Object.values(TEMPLATES) as Template[], env.appUrl);
    return ok(c, templates, `${templates.filter((t) => t.status === "APPROVED").length} of ${templates.length} approved`);
  } catch (e) {
    return fail(502, (e as Error).message);
  }
});

// ---------------------------------------------------------------- coaches

opsRoutes.get("/admin/coaches", async (c) => {
  await admin(c);
  const rows = await sql`
    select u.id::text as id, u.full_name as "fullName", u.mobile,
      (select count(*) from patient_profiles p where p.coach_id = u.id)::int as patients
    from users u where u.role = 'COACH' order by u.full_name`;
  return ok(c, rows);
});

opsRoutes.post("/admin/coaches", async (c) => {
  await admin(c);
  const b = await body<{ fullName?: unknown; mobile?: unknown }>(c);
  const fullName = String(b.fullName ?? "").trim().slice(0, 80);
  const mobile = String(b.mobile ?? "").replace(/\D/g, "").slice(-10);
  if (fullName.length < 2) fail(400, "Add the coach's full name.");
  if (!/^[6-9]\d{9}$/.test(mobile)) fail(400, "Enter a 10-digit mobile number.");
  const [existing] = await sql`select id, role from users where mobile = ${mobile}`;
  if (existing && existing.role !== "COACH") fail(409, "That number already belongs to a patient, doctor or admin.");
  // a patient signing up with this number in between is never renamed: the update only touches a coach
  const [u] = await sql`
    insert into users (mobile, role, full_name) values (${mobile}, 'COACH', ${fullName})
    on conflict (mobile) do update set full_name = excluded.full_name where users.role = 'COACH' returning id`;
  if (!u) fail(409, "That number already belongs to a patient, doctor or admin.");
  return ok(c, { id: String(u.id), fullName, mobile, patients: 0 }, "Coach added. They sign in with this number.");
});
