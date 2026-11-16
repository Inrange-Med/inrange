// The medicine flow after a prescription, as one set of small steps the routes, the WhatsApp webhook and
// the tick (routes/jobs.ts) all call. docs/backend/medicine-flow.md has the rules; the PRD is mapped in
// docs/backend/medicine-flow-prd.md. Every step re-reads the state it acts on and is keyed (dedupe keys
// on messages and tasks), so it can run twice, late, or from two places, and still act once.
import type { TransactionSql } from "postgres";
import { sql } from "./db.ts";
import { addDays, atIst, dayWords, ist, nextWorkingMorning, workingDue } from "./hours.ts";
import { deliver, queueMessage } from "./notify.ts";
import { type CartLine } from "./pharmacy.ts";

type Tx = TransactionSql | typeof sql;
const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** How long the pharmacy has to dispatch after payment (PRD 10.5; we are the pharmacy). */
export const DISPATCH_HOURS = { PLAN: 24, NANO: 48 } as const;
/** A delivery this many hours past its expected date is late. */
const LATE_AFTER_HOURS = 6;
/** The feedback question goes this long after delivery. */
const FEEDBACK_AFTER_HOURS = 2;
/** A refill reminder goes this many days before the medicines run out. */
export const REFILL_DAYS_AHEAD = 7;
/** "Need more time" can push the check-ins back this many times before the team calls. */
const MAX_CHECK_INS = 4;
/** A dose not logged this long after its time (plus an hour per snooze) counts as missed. */
const MISSED_AFTER_HOURS = 2;
const MAX_SNOOZES = 2;

export const orderNumber = (id: number) => `MED-${String(id).padStart(5, "0")}`;

async function firstName(tx: Tx, patientId: number): Promise<string> {
  const [r] = await tx`select coalesce(nullif(p.first_name, ''), split_part(u.full_name, ' ', 1), 'there') as name
                       from users u left join patient_profiles p on p.user_id = u.id where u.id = ${patientId}`;
  return r?.name || "there";
}

const historyEntry = (what: string, by: number | null = null) => [{ at: new Date().toISOString(), by, what }];

// ---------------------------------------------------------------- the medicine queue

export type TaskKind =
  | "NO_REPLY" | "QUESTIONS" | "PLAN_CALL" | "PAYMENT_FAILED" | "DISPATCH_DUE" | "DELIVERY_LATE" | "DELIVERY_ISSUE"
  | "RENEWAL" | "REFILL_GAP" | "ADHERENCE" | "RECONCILE";

export type TaskInput = {
  kind: TaskKind;
  priority?: "CRITICAL" | "HIGH" | "NORMAL";
  patientId?: number | null;
  title: string;
  detail?: string | null;
  dueAt: Date;
  dedupeKey?: string;
  prescriptionId?: number | null;
  cartId?: number | null;
  medicineOrderId?: number | null;
  paymentOrderId?: string | null;
};

/** The kinds a health coach handles; they go to the patient's coach when there is one. */
const COACH_KINDS: TaskKind[] = ["ADHERENCE", "REFILL_GAP"];

/** Opens a task once (the dedupe key); returns its id, or null when it already exists. */
export async function openTask(tx: Tx, t: TaskInput): Promise<number | null> {
  const [coach] = t.patientId && COACH_KINDS.includes(t.kind)
    ? await tx`select coach_id from patient_profiles where user_id = ${t.patientId}` : [];
  const [row] = await tx`
    insert into ops_tasks (kind, priority, patient_id, title, detail, due_at, dedupe_key, prescription_id, cart_id,
      medicine_order_id, payment_order_id, assigned_to, history)
    values (${t.kind}, ${t.priority ?? "NORMAL"}, ${t.patientId ?? null}, ${t.title}, ${t.detail ?? null}, ${t.dueAt},
      ${t.dedupeKey ?? null}, ${t.prescriptionId ?? null}, ${t.cartId ?? null}, ${t.medicineOrderId ?? null},
      ${t.paymentOrderId ?? null}, ${coach?.coach_id ?? null}, ${tx.json(historyEntry("Opened"))})
    on conflict (dedupe_key) do nothing returning id`;
  return row?.id ?? null;
}

/** Closes open tasks of these kinds for a cart or an order, when what they were about has happened. */
export async function closeTasks(tx: Tx, where: { cartId?: number; medicineOrderId?: number }, kinds: TaskKind[], outcome: string, note: string) {
  await tx`
    update ops_tasks set status = 'DONE', outcome = ${outcome}, outcome_note = ${note}, done_at = now(),
      history = history || ${tx.json(historyEntry(`Closed: ${note}`))}
    where status = 'OPEN' and kind in ${tx(kinds)}
      and (${where.cartId ?? null}::int is not null and cart_id = ${where.cartId ?? null}
        or ${where.medicineOrderId ?? null}::int is not null and medicine_order_id = ${where.medicineOrderId ?? null})`;
}

// ---------------------------------------------------------------- the follow-up after a prescription

/**
 * On signing (routes/doctor.ts signRx, inside its transaction): the prescription message, and, when a
 * cart was made, its follow-up. A plan patient's first reminder is 24 hours after signing; the nano
 * plan's first check-in is when its cart opens (NANO_CART_DELAY_HOURS), the second a day later.
 * Returns the message to send once the transaction commits.
 */
export async function startMedicineFlow(tx: Tx, input: {
  patientId: number; prescriptionId: number; version: number; cartId: number | null; onPlan: boolean;
  signedAt: Date; availableAt: Date; doctorName: string; pdfPath: string;
}): Promise<number | null> {
  const name = await firstName(tx, input.patientId);
  const messageId = await queueMessage(tx, {
    patientId: input.patientId, kind: input.onPlan && input.cartId ? "RX_READY_ORDER" : "RX_READY",
    values: [name, input.doctorName], dedupeKey: `rx:${input.prescriptionId}:v${input.version}:ready`,
    prescriptionId: input.prescriptionId, cartId: input.cartId, documentPath: input.pdfPath,
  });
  if (input.cartId) {
    const flow = input.onPlan ? "PLAN" : "NANO";
    const nextAt = input.onPlan ? new Date(input.signedAt.getTime() + DAY) : input.availableAt;
    await tx`
      insert into medicine_followups (cart_id, patient_id, flow, stage, next_at, history)
      values (${input.cartId}, ${input.patientId}, ${flow}, 'WAITING', ${nextAt},
        ${tx.json(historyEntry(input.onPlan ? "Prescription sent with the order ready" : "Prescription sent; the order opens later"))})
      on conflict (cart_id) do nothing`;
  }
  return messageId;
}

async function closeFollowup(tx: Tx, id: number, reason: string, what: string) {
  await tx`update medicine_followups set stage = 'DONE', next_at = null, closed_reason = ${reason}, closed_at = now(),
           history = history || ${tx.json(historyEntry(what))} where id = ${id} and closed_at is null`;
}

/** One follow-up step, in its own transaction (the tick calls it for every one due). */
export async function advanceFollowup(id: number): Promise<string> {
  const sendAfterCommit: number[] = [];
  const result = await sql.begin(async (tx) => {
    const [f] = await tx`select * from medicine_followups where id = ${id} and closed_at is null for update skip locked`;
    if (!f || !f.next_at || new Date(f.next_at) > new Date()) return "not due";
    const [k] = await tx`
      select k.*, p.valid_until from medicine_carts k join prescriptions p on p.id = k.prescription_id where k.id = ${f.cart_id}`;
    // pre-flight (PRD 7.2 BR1): never nudge about something already settled
    if (!k || k.status === "CLOSED") return (await closeFollowup(tx, f.id, "SUPERSEDED", "A newer prescription replaced this order"), "closed");
    if (k.status === "PAID") return (await closeFollowup(tx, f.id, "PAID", "Paid"), "closed");
    if (k.elsewhere_at) return (await closeFollowup(tx, f.id, "ELSEWHERE", "Bought elsewhere"), "closed");
    if (k.valid_until && new Date(k.valid_until) <= new Date()) return (await closeFollowup(tx, f.id, "EXPIRED", "The prescription ended"), "closed");

    let flow = f.flow as "NANO" | "PLAN";
    let stage = f.stage as string;
    const [plan] = await tx`select 1 from subscriptions where user_id = ${f.patient_id} and status = 'Active' and ends_at > now()`;
    if (flow === "NANO" && plan) {
      // moved onto a plan mid-way (PRD 7.2 EC4): the order opens at once and the plan's rhythm takes over
      flow = "PLAN";
      stage = "WAITING";
      await tx`update medicine_carts set available_at = least(available_at, now()) where id = ${k.id}`;
      await tx`update medicine_followups set flow = 'PLAN', stage = 'WAITING',
               history = history || ${tx.json(historyEntry("On a plan now: the order opened at once"))} where id = ${f.id}`;
    }
    const name = await firstName(tx, f.patient_id);
    const n = f.check_ins + 1;
    const queue = async (kind: "CHECK_IN_1" | "CHECK_IN_2" | "PLAN_REMINDER") => {
      const mid = await queueMessage(tx, { patientId: f.patient_id, kind, values: [name], dedupeKey: `fu:${f.id}:c${n}`, cartId: k.id, prescriptionId: k.prescription_id });
      if (mid) sendAfterCommit.push(mid);
    };
    const step = async (next: string, what: string, nextAt: Date | null) =>
      await tx`update medicine_followups set stage = ${next}, next_at = ${nextAt}, check_ins = ${n},
               history = history || ${tx.json(historyEntry(what))} where id = ${f.id}`;
    const call = async (kind: "NO_REPLY" | "PLAN_CALL") => {
      const due = kind === "PLAN_CALL" ? workingDue(new Date(), 2) : workingDue(new Date(), 8);
      await openTask(tx, {
        kind, priority: kind === "PLAN_CALL" ? "CRITICAL" : "NORMAL", patientId: f.patient_id, cartId: k.id, prescriptionId: k.prescription_id,
        title: kind === "PLAN_CALL" ? "Plan patient has not ordered their medicines" : "No reply about the medicines",
        detail: "Call, answer any questions, and guide them to pay in the app themselves. Never place the order for them.",
        dueAt: due, dedupeKey: `fu:${f.id}:call`,
      });
      await tx`update medicine_followups set stage = 'CALL', next_at = null,
               history = history || ${tx.json(historyEntry("Handed to the care team for a call"))} where id = ${f.id}`;
    };

    if (flow === "PLAN") {
      if (stage === "WAITING") { await queue("PLAN_REMINDER"); await step("CHECK_IN_1", "Reminder sent", new Date(Date.now() + DAY)); }
      else await call("PLAN_CALL");
    } else {
      if (stage === "WAITING") { await queue("CHECK_IN_1"); await step("CHECK_IN_1", "First check-in sent", new Date(Date.now() + DAY)); }
      else if (stage === "CHECK_IN_1" && n <= MAX_CHECK_INS) { await queue("CHECK_IN_2"); await step("CHECK_IN_2", "Second check-in sent", new Date(Date.now() + DAY)); }
      else await call("NO_REPLY");
    }
    return "advanced";
  });
  for (const mid of sendAfterCommit) await deliver(mid);
  return result;
}

export async function advanceDueFollowups(limit = 50) {
  const due = await sql`select id from medicine_followups where closed_at is null and next_at <= now() order by next_at limit ${limit}`;
  const out: Record<string, number> = {};
  for (const { id } of due) {
    const r = await advanceFollowup(id).catch((e) => (console.error("followup", id, e.message), "error"));
    out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}

/** "Order now": sends the order link; a held nano order opens early because the patient asked (conflict 1 in the PRD doc). */
export async function orderNow(cartId: number, patientId: number, via: string, key: string) {
  const [k] = await sql`select * from medicine_carts where id = ${cartId} and patient_id = ${patientId} and status = 'OPEN'`;
  if (!k) return "No open order";
  const early = new Date(k.available_at) > new Date();
  if (early) await sql`update medicine_carts set available_at = now() where id = ${k.id}`;
  await sql`update medicine_followups set next_at = greatest(coalesce(next_at, now()), now() + interval '1 day'),
            history = history || ${sql.json(historyEntry(early ? `Opened early at the patient's request (${via})` : `Asked for the order link (${via})`))}
            where cart_id = ${k.id} and closed_at is null`;
  if (via !== "APP") {
    const mid = await queueMessage(sql, { patientId, kind: "ORDER_LINK", values: [await firstName(sql, patientId)], dedupeKey: `${key}:link`, cartId: k.id });
    if (mid) await deliver(mid);
  }
  return early ? "Opened early and sent the link" : "Sent the order link";
}

/** "I have them": no more reminders about this order. */
export async function boughtElsewhere(cartId: number, patientId: number, via: string) {
  await sql.begin(async (tx) => {
    await tx`update medicine_carts set elsewhere_at = coalesce(elsewhere_at, now()) where id = ${cartId} and patient_id = ${patientId}`;
    const [f] = await tx`select id from medicine_followups where cart_id = ${cartId} and closed_at is null`;
    if (f) await closeFollowup(tx, f.id, "ELSEWHERE", `Bought elsewhere (${via})`);
    await closeTasks(tx, { cartId }, ["NO_REPLY", "PLAN_CALL", "PAYMENT_FAILED"], "ELSEWHERE", "The patient bought them elsewhere");
  });
  return "Stopped reminders: bought elsewhere";
}

/** "Need more time": the next check-in a day later, up to MAX_CHECK_INS in all. */
export async function later(cartId: number) {
  const [f] = await sql`select * from medicine_followups where cart_id = ${cartId} and closed_at is null`;
  if (!f || f.stage === "CALL") return "Nothing scheduled";
  if (f.check_ins >= MAX_CHECK_INS) return "Already at the last check-in";
  // the next run sends the second check-in again, a day from now
  await sql`update medicine_followups set stage = ${f.flow === "NANO" ? "CHECK_IN_1" : f.stage}, next_at = now() + interval '1 day',
            history = history || ${sql.json(historyEntry("Asked for more time: next check-in tomorrow"))} where id = ${f.id}`;
  return "Next check-in tomorrow";
}

/** "I have questions": a call back within 2 working hours. Returns the due time for the reply. */
export async function questions(patientId: number, cartId: number | null, key: string, detail: string | null): Promise<Date> {
  const due = workingDue(new Date(), 2);
  await openTask(sql, {
    kind: "QUESTIONS", priority: "HIGH", patientId, cartId, title: "Patient has questions about their medicines",
    detail, dueAt: due, dedupeKey: `${key}:questions`,
  });
  return due;
}

// ---------------------------------------------------------------- deliveries

/** The days an order lasts: its shortest line (quantity x the pack's days). */
export async function supplyDays(tx: Tx, lines: CartLine[]): Promise<number | null> {
  const bought = lines.filter((l) => l.quantity > 0);
  if (!bought.length) return null;
  const packs = await tx`select id, pack_days from medicines where id in ${tx(bought.map((l) => l.medicineId))}`;
  const days = bought.map((l) => (packs.find((p) => p.id === l.medicineId)?.pack_days ?? 0) * l.quantity).filter((d) => d > 0);
  return days.length ? Math.min(...days) : null;
}

/** On payment (routes/payments.ts fulfil, inside its transaction): the order's flow and supply, the follow-up closed, the confirmation queued. */
export async function onMedicinePaid(tx: Tx, orderId: number) {
  const [o] = await tx`select o.*, k.lines from medicine_orders o join medicine_carts k on k.id = o.cart_id where o.id = ${orderId}`;
  if (!o) return;
  const [plan] = await tx`select 1 from subscriptions where user_id = ${o.patient_id} and status = 'Active' and ends_at > now()`;
  const days = await supplyDays(tx, o.lines as CartLine[]);
  await tx`update medicine_orders set flow = ${plan ? "PLAN" : "NANO"}, supply_days = ${days} where id = ${orderId}`;
  const [f] = await tx`select id from medicine_followups where cart_id = ${o.cart_id} and closed_at is null`;
  if (f) await closeFollowup(tx, f.id, "PAID", "Paid");
  await closeTasks(tx, { cartId: o.cart_id }, ["NO_REPLY", "PLAN_CALL", "PAYMENT_FAILED"], "PAID", "Paid");
  await queueMessage(tx, {
    patientId: o.patient_id, kind: "ORDER_CONFIRMED", medicineOrderId: orderId,
    values: [await firstName(tx, o.patient_id), orderNumber(orderId), dayWords(new Date(o.expected_at))],
    dedupeKey: `order:${orderId}:PLACED`,
  });
}

/** Sends what is queued and due for an order (after the transaction that queued it commits). */
export async function deliverQueued(where: { medicineOrderId?: number; cartId?: number }) {
  const rows = await sql`select id from patient_messages where status = 'QUEUED' and send_after <= now()
    and (${where.medicineOrderId ?? null}::int is not null and medicine_order_id = ${where.medicineOrderId ?? null}
      or ${where.cartId ?? null}::int is not null and cart_id = ${where.cartId ?? null})`;
  for (const { id } of rows) await deliver(id);
}

/** Payment failed on a medicines order: tell the patient how to try again; the team checks in if it stays unpaid. */
export async function onMedicinePaymentFailed(paymentOrderId: string) {
  const [o] = await sql`select * from payment_orders where id = ${paymentOrderId} and purpose = 'MEDICINE_ORDER'`;
  if (!o || o.status !== "CREATED") return;
  const cartId = Number(o.reference_id);
  const mid = await queueMessage(sql, {
    patientId: o.user_id, kind: "PAYMENT_FAILED", values: [await firstName(sql, o.user_id)],
    dedupeKey: `pay:${o.id}:failed`, cartId,
  });
  if (mid) await deliver(mid);
  await openTask(sql, {
    kind: "PAYMENT_FAILED", priority: "NORMAL", patientId: o.user_id, cartId, paymentOrderId: o.id,
    title: "A medicines payment failed", detail: o.failure_reason ?? null, dueAt: workingDue(new Date(), 4),
    dedupeKey: `pay:${o.id}:failed`,
  });
}

export const ORDER_STEPS = ["PLACED", "PACKED", "DISPATCHED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
export type OrderStep = (typeof ORDER_STEPS)[number];

/**
 * Moves an order forward (the pharmacy, in the medicine queue). Never backwards; a step may be skipped
 * (packed and dispatched together). Dispatch needs the courier and a tracking link or number.
 */
export async function moveOrder(orderId: number, to: OrderStep, actorId: number, d: {
  courier?: string | null; trackingNo?: string | null; trackingUrl?: string | null; expectedAt?: Date | null; note?: string | null;
}): Promise<Record<string, unknown>> {
  const out = await sql.begin(async (tx) => {
    const [o] = await tx`select * from medicine_orders where id = ${orderId} for update`;
    if (!o) throw new Error("That order was not found.");
    if (o.status === "CANCELLED") throw new Error("This order was cancelled.");
    const from = ORDER_STEPS.indexOf(o.status), next = ORDER_STEPS.indexOf(to);
    if (next <= from) throw new Error(`This order is already ${o.status.toLowerCase().replace(/_/g, " ")}.`);
    const courier = d.courier?.trim() || o.courier;
    const trackingUrl = d.trackingUrl?.trim() || o.tracking_url;
    const trackingNo = d.trackingNo?.trim() || o.tracking_no;
    if (next >= ORDER_STEPS.indexOf("DISPATCHED") && (!courier || !(trackingUrl || trackingNo)))
      throw new Error("Add the courier and its tracking link or number to dispatch.");
    if (trackingUrl && !/^https:\/\/\S+$/.test(trackingUrl)) throw new Error("The tracking link must start with https://.");
    const expected = d.expectedAt ?? (o.expected_at ? new Date(o.expected_at) : null);
    const note = d.note?.trim() || {
      PLACED: "Order received by the pharmacy", PACKED: "Packed and sealed", DISPATCHED: `Dispatched with ${courier}`,
      OUT_FOR_DELIVERY: "Out for delivery", DELIVERED: "Delivered",
    }[to];
    // a skipped step still gets its time, so the timeline and the numbers stay whole
    const now = new Date();
    const [updated] = await tx`
      update medicine_orders set status = ${to}, courier = ${courier}, tracking_url = ${trackingUrl}, tracking_no = ${trackingNo},
        expected_at = ${expected},
        packed_at = case when ${next >= 1} then coalesce(packed_at, ${now}) else packed_at end,
        dispatched_at = case when ${next >= 2} then coalesce(dispatched_at, ${now}) else dispatched_at end,
        delivered_at = case when ${next >= 4} then coalesce(delivered_at, ${now}) else delivered_at end,
        history = history || ${tx.json([{ status: to, at: now.toISOString(), note, by: actorId }])}
      where id = ${orderId} returning *`;
    const number = orderNumber(orderId);
    const queue = (kind: Parameters<typeof queueMessage>[1]["kind"], values: string[], suffix: string = to, sendAfter?: Date) =>
      queueMessage(tx, { patientId: o.patient_id, kind, values, dedupeKey: `order:${orderId}:${suffix}`, medicineOrderId: orderId, sendAfter });
    if (to === "PACKED") await queue("ORDER_PACKED", [number]);
    if (to === "DISPATCHED")
      await queue("ORDER_DISPATCHED", [number, courier!, trackingUrl ?? `tracking number ${trackingNo}`, expected ? dayWords(expected) : "soon"]);
    if (to === "OUT_FOR_DELIVERY") await queue("ORDER_OUT_FOR_DELIVERY", [number]);
    if (to === "DELIVERED") {
      await queue("ORDER_DELIVERED", [number]);
      await queue("ORDER_FEEDBACK", [number], "feedback", new Date(now.getTime() + FEEDBACK_AFTER_HOURS * HOUR));
      await closeTasks(tx, { medicineOrderId: orderId }, ["DISPATCH_DUE", "DELIVERY_LATE"], "DELIVERED", "Delivered");
      if (updated.flow === "PLAN") await createDoseSchedules(tx, updated);
    } else if (next >= 2) await closeTasks(tx, { medicineOrderId: orderId }, ["DISPATCH_DUE"], "DISPATCHED", "Dispatched");
    return updated;
  });
  await deliverQueued({ medicineOrderId: orderId });
  return out;
}

/** A new expected date while on the way: the patient hears the new date once per date. */
export async function delayOrder(orderId: number, expectedAt: Date, actorId: number) {
  const [o] = await sql`update medicine_orders set expected_at = ${expectedAt},
      history = history || ${sql.json([{ status: "DELAYED", at: new Date().toISOString(), note: `Now expected ${dayWords(expectedAt)}`, by: actorId }])}
    where id = ${orderId} and status in ('PLACED', 'PACKED', 'DISPATCHED', 'OUT_FOR_DELIVERY') returning *`;
  if (!o) throw new Error("Only an order on its way can get a new date.");
  const mid = await queueMessage(sql, {
    patientId: o.patient_id, kind: "ORDER_DELAYED", values: [orderNumber(orderId), dayWords(expectedAt)],
    dedupeKey: `order:${orderId}:delay:${ist(expectedAt).date}`, medicineOrderId: orderId,
  });
  if (mid) await deliver(mid);
  return o;
}

/** The tick: orders past their dispatch time, and deliveries past their expected date. */
export async function checkOrders() {
  let opened = 0;
  const notDispatched = await sql`
    select o.id, o.patient_id, o.flow, o.placed_at from medicine_orders o
    where o.status in ('PLACED', 'PACKED')
      and o.placed_at + make_interval(hours => case when o.flow = 'PLAN' then ${DISPATCH_HOURS.PLAN}::int else ${DISPATCH_HOURS.NANO}::int end) < now()`;
  for (const o of notDispatched)
    if (await openTask(sql, {
      kind: "DISPATCH_DUE", priority: o.flow === "PLAN" ? "CRITICAL" : "HIGH", patientId: o.patient_id, medicineOrderId: o.id,
      title: `${orderNumber(o.id)} is past its dispatch time`, detail: `Dispatch within ${DISPATCH_HOURS[o.flow as "PLAN" | "NANO"]} hours of payment.`,
      dueAt: new Date(), dedupeKey: `order:${o.id}:dispatch`,
    })) opened++;
  const late = await sql`
    select id, patient_id, expected_at from medicine_orders
    where status in ('DISPATCHED', 'OUT_FOR_DELIVERY') and expected_at + make_interval(hours => ${LATE_AFTER_HOURS}::int) < now()`;
  for (const o of late)
    if (await openTask(sql, {
      kind: "DELIVERY_LATE", priority: "HIGH", patientId: o.patient_id, medicineOrderId: o.id,
      title: `${orderNumber(o.id)} is late`, detail: "Check with the courier, then give the patient a new date.",
      dueAt: workingDue(new Date(), 1), dedupeKey: `order:${o.id}:late:${ist(new Date(o.expected_at)).date}`,
    })) opened++;
  return { opened };
}

/** "All good" / "Something is wrong" after a delivery. Returns the due time of the call when there is one. */
export async function orderFeedback(orderId: number, patientId: number, rating: "GOOD" | "ISSUE", note: string | null): Promise<Date | null> {
  const [o] = await sql`update medicine_orders set feedback = ${rating}, feedback_note = ${note}, feedback_at = now()
                        where id = ${orderId} and patient_id = ${patientId} and status = 'DELIVERED' returning id`;
  if (!o || rating === "GOOD") return null;
  const due = workingDue(new Date(), 1);
  await openTask(sql, {
    kind: "DELIVERY_ISSUE", priority: "CRITICAL", patientId, medicineOrderId: orderId,
    title: `Problem with delivered order ${orderNumber(orderId)}`, detail: note, dueAt: due, dedupeKey: `order:${orderId}:issue`,
  });
  return due;
}

// ---------------------------------------------------------------- refills and renewals

/** What is left to buy on a prescription: prescribed (on its first order) less everything paid since. */
async function remainingOn(tx: Tx, prescriptionId: number): Promise<CartLine[]> {
  const carts = await tx`select kind, status, lines from medicine_carts where prescription_id = ${prescriptionId} order by id`;
  const first = carts.find((c) => c.kind === "FIRST");
  if (!first) return [];
  return (first.lines as CartLine[]).map((l) => {
    const bought = carts.filter((c) => c.status === "PAID")
      .reduce((n, c) => n + ((c.lines as CartLine[]).find((x) => x.medicineId === l.medicineId)?.quantity ?? 0), 0);
    const left = Math.max(0, l.prescribed - bought);
    return { medicineId: l.medicineId, quantity: left, prescribed: left };
  }).filter((l) => l.prescribed > 0);
}

/**
 * Daily: a week before an order runs out, the next supply. When the prescription still covers it, a refill
 * order opens (filled in, payable at once) and the patient is reminded; otherwise the doctor reviews first
 * (PRD 7.7 BR4) and the team sets up the review. A day after running out with nothing new: a refill gap.
 */
export async function checkRefills() {
  const out = { refills: 0, renewals: 0, gaps: 0 };
  const due = await sql`
    select o.*, (o.delivered_at + make_interval(days => o.supply_days)) as run_out, p.valid_until
    from medicine_orders o left join prescriptions p on p.id = o.prescription_id
    where o.status = 'DELIVERED' and o.supply_days is not null
      and o.delivered_at + make_interval(days => o.supply_days - ${REFILL_DAYS_AHEAD}::int) <= now()
      -- a month past running out, it is the team's (the gap task) and no longer scanned
      and o.delivered_at + make_interval(days => o.supply_days) > now() - interval '30 days'
      and not exists (select 1 from medicine_orders n where n.patient_id = o.patient_id and n.id > o.id and n.status <> 'CANCELLED')
    order by o.id limit 100`;
  for (const o of due) {
    const runOut = new Date(o.run_out);
    const [handled] = await sql`select 1 from patient_messages where dedupe_key in (${`order:${o.id}:refill`}, ${`order:${o.id}:renewal`})
                                union all select 1 from ops_tasks where dedupe_key = ${`order:${o.id}:renewal`} limit 1`;
    if (!handled) {
      const name = await firstName(sql, o.patient_id);
      const covered = o.prescription_id && o.valid_until && new Date(o.valid_until) > runOut;
      const left = covered ? await remainingOn(sql, o.prescription_id) : [];
      if (left.length) {
        const cartId = await sql.begin(async (tx) => {
          const [open] = await tx`select id from medicine_carts where prescription_id = ${o.prescription_id} and status = 'OPEN'`;
          const id = open?.id ?? (await tx`
            insert into medicine_carts (patient_id, prescription_id, available_at, lines, address_id, kind)
            values (${o.patient_id}, ${o.prescription_id}, now(), ${tx.json(left)}, ${o.address_id}, 'REFILL') returning id`)[0].id;
          // the plan rhythm on the refill: if it is not ordered within 2 days, the team calls (still before it runs out)
          await tx`insert into medicine_followups (cart_id, patient_id, flow, stage, next_at, history)
                   values (${id}, ${o.patient_id}, 'PLAN', 'CHECK_IN_1', now() + interval '2 days', ${tx.json(historyEntry("Refill order opened"))})
                   on conflict (cart_id) do nothing`;
          await queueMessage(tx, { patientId: o.patient_id, kind: "REFILL_DUE", values: [name, dayWords(runOut)], dedupeKey: `order:${o.id}:refill`, cartId: id, medicineOrderId: o.id });
          return id;
        });
        await deliverQueued({ cartId });
        out.refills++;
      } else {
        await queueMessage(sql, { patientId: o.patient_id, kind: "RENEWAL_DUE", values: [name, dayWords(runOut)], dedupeKey: `order:${o.id}:renewal`, medicineOrderId: o.id });
        await openTask(sql, {
          kind: "RENEWAL", priority: "NORMAL", patientId: o.patient_id, medicineOrderId: o.id, prescriptionId: o.prescription_id,
          title: "Medicines run out soon: book the doctor's review", detail: `Runs out about ${dayWords(runOut)}. The prescription does not cover another supply.`,
          dueAt: nextWorkingMorning(new Date()), dedupeKey: `order:${o.id}:renewal`,
        });
        out.renewals++;
      }
    }
    if (runOut.getTime() + DAY < Date.now()
      && await openTask(sql, {
        kind: "REFILL_GAP", priority: "HIGH", patientId: o.patient_id, medicineOrderId: o.id,
        title: "Ran out of medicines with nothing new on the way", detail: `Ran out about ${dayWords(runOut)}. Dose reminders are paused until a new supply arrives.`,
        dueAt: workingDue(new Date(), 2), dedupeKey: `order:${o.id}:gap`,
      })) out.gaps++;
  }
  return out;
}

/** "I have enough": one more reminder two days before the run-out date. */
export async function haveEnough(orderId: number, patientId: number) {
  const [o] = await sql`select *, delivered_at + make_interval(days => supply_days) as run_out from medicine_orders
                        where id = ${orderId} and patient_id = ${patientId}`;
  if (!o?.run_out) return "No date to remind on";
  const runOut = new Date(o.run_out);
  const [k] = await sql`select id from medicine_carts where prescription_id = ${o.prescription_id} and status = 'OPEN' order by id desc limit 1`;
  await queueMessage(sql, {
    patientId, kind: "REFILL_DUE", values: [await firstName(sql, patientId), dayWords(runOut)], dedupeKey: `order:${orderId}:refill2`,
    cartId: k?.id ?? null, medicineOrderId: orderId, sendAfter: new Date(runOut.getTime() - 2 * DAY),
  });
  if (k) await sql`update medicine_followups set next_at = ${new Date(runOut.getTime() - DAY)} where cart_id = ${k.id} and closed_at is null`;
  return "Reminder moved to two days before";
}

// ---------------------------------------------------------------- doses and adherence (patients on a plan)

/** The reminder rhythm a prescription's frequency describes, or null when it has none we can remind on. */
export function cadenceOf(frequency: string): { cadence: "WEEKLY" | "DAILY" | "TWICE_DAILY"; times: string[] } | null {
  const f = frequency.toLowerCase();
  if (/week/.test(f)) return { cadence: "WEEKLY", times: ["09:00"] };
  if (/twice|two times|2 times|\bbd\b|\bbid\b|morning and (evening|night)/.test(f)) return { cadence: "TWICE_DAILY", times: ["09:00", "21:00"] };
  if (/daily|once a day|every day|\bod\b|each day|at night|in the morning/.test(f)) return { cadence: "DAILY", times: ["09:00"] };
  return null;
}

/**
 * On delivery for a plan patient: one schedule per medicine whose frequency we can remind on, from the
 * delivery day to the day the order runs out. A patient's earlier day and time for the same medicine
 * carry over, and the earlier schedule ends.
 */
// deno-lint-ignore no-explicit-any
export async function createDoseSchedules(tx: Tx, order: Record<string, any>) {
  const [rx] = order.prescription_id ? await tx`select items from prescriptions where id = ${order.prescription_id}` : [];
  const [k] = await tx`select lines from medicine_carts where id = ${order.cart_id}`;
  if (!rx || !k) return;
  const delivered = new Date(order.delivered_at ?? Date.now());
  const { date, weekday } = ist(delivered);
  const endsOn = order.supply_days ? addDays(date, order.supply_days) : null;
  for (const line of (k.lines as CartLine[]).filter((l) => l.quantity > 0)) {
    // deno-lint-ignore no-explicit-any
    const item = (rx.items as Record<string, any>[]).find((i) => Number(i.medicineId) === line.medicineId);
    const rhythm = item ? cadenceOf(String(item.frequency ?? "")) : null;
    if (!item || !rhythm) continue;
    const medicine = `${item.medicineName ?? ""} ${item.strength ?? ""}`.trim();
    const generic = String(item.genericName ?? item.medicineName ?? "");
    const [before] = await tx`
      select s.* from dose_schedules s
      where s.patient_id = ${order.patient_id} and s.medicine_order_id <> ${order.id} and s.cadence = ${rhythm.cadence}
        and (s.ends_on is null or s.ends_on >= ${date}::date)
        and exists (select 1 from prescriptions p, jsonb_array_elements(p.items) i
                    where p.id = s.prescription_id and coalesce(i->>'genericName', i->>'medicineName') = ${generic})
      order by s.id desc limit 1`;
    if (before) await tx`update dose_schedules set ends_on = ${date}::date - 1 where id = ${before.id}`;
    await tx`
      insert into dose_schedules (patient_id, prescription_id, medicine_order_id, medicine, cadence, weekday, times, starts_on, ends_on)
      values (${order.patient_id}, ${order.prescription_id}, ${order.id}, ${medicine}, ${rhythm.cadence},
        ${rhythm.cadence === "WEEKLY" ? (before?.weekday ?? weekday) : null}, ${before?.times ?? rhythm.times}, ${date}, ${endsOn})
      on conflict (medicine_order_id, medicine) do nothing`;
  }
}

/** The tick: the next two days' doses, reminders due now, and doses gone unlogged (missed). */
/** The next two days' doses for every running schedule (or one), never one before the schedule existed. */
export async function makeDoseEvents(scheduleId: number | null = null) {
  // a dose before the schedule existed (delivered at 3 pm, dose time 9 am) is never created
  return await sql`
    insert into dose_events (schedule_id, patient_id, due_at)
    select s.id, s.patient_id, (d::date + t::time) at time zone 'Asia/Kolkata'
    from dose_schedules s
    cross join lateral generate_series((now() at time zone 'Asia/Kolkata')::date, (now() at time zone 'Asia/Kolkata')::date + 2, interval '1 day') d
    cross join lateral unnest(s.times) t
    where not s.paused and d::date >= s.starts_on and (s.ends_on is null or d::date <= s.ends_on)
      and (s.cadence <> 'WEEKLY' or extract(isodow from d) = s.weekday)
      and (d::date + t::time) at time zone 'Asia/Kolkata' > s.created_at
      and (${scheduleId}::int is null or s.id = ${scheduleId})
    on conflict (schedule_id, due_at) do nothing returning id`;
}

export async function checkDoses() {
  const made = await makeDoseEvents();
  const due = await sql`
    select e.id, e.patient_id from dose_events e join dose_schedules s on s.id = e.schedule_id
    where e.status = 'DUE' and not s.paused and e.due_at <= now() and e.due_at > now() - make_interval(hours => ${MISSED_AFTER_HOURS}::int)
      and not exists (select 1 from patient_messages m where m.dedupe_key = 'dose:' || e.id)`;
  for (const e of due) {
    const mid = await queueMessage(sql, { patientId: e.patient_id, kind: "DOSE_REMINDER", values: [await firstName(sql, e.patient_id)], dedupeKey: `dose:${e.id}`, doseEventId: e.id });
    if (mid) await deliver(mid);
  }
  const missed = await sql`
    update dose_events set status = 'MISSED'
    where status = 'DUE' and due_at + make_interval(hours => ${MISSED_AFTER_HOURS}::int + snoozes) < now()
    returning patient_id`;
  for (const p of new Set(missed.map((m) => m.patient_id as number))) await checkAdherence(p);
  return { created: made.length, reminded: due.length, missed: missed.length };
}

/** Taken, or skipped with a reason, from WhatsApp or the app. Returns the due time of a call for side effects. */
export async function recordDose(eventId: number, patientId: number, status: "TAKEN" | "SKIPPED", reason: string | null): Promise<Date | null> {
  const [e] = await sql`select * from dose_events where id = ${eventId} and patient_id = ${patientId}`;
  if (!e) throw new Error("That dose was not found.");
  const late = e.status === "MISSED" || Date.now() > new Date(e.due_at).getTime() + MISSED_AFTER_HOURS * HOUR;
  const final = status === "TAKEN" ? (late ? "TAKEN_LATE" : "TAKEN") : "SKIPPED";
  await sql`update dose_events set status = ${final}, skip_reason = ${status === "SKIPPED" ? reason ?? "OTHER" : null}, responded_at = now()
            where id = ${eventId}`;
  let due: Date | null = null;
  if (status === "SKIPPED" && reason === "SIDE_EFFECTS") {
    due = workingDue(new Date(), 1);
    await openTask(sql, {
      kind: "ADHERENCE", priority: "HIGH", patientId, title: "Skipped a dose because of side effects",
      detail: "Call today and tell the doctor. If it sounds severe, the patient should call 112.", dueAt: due, dedupeKey: `dose:${eventId}:side-effects`,
    });
  }
  await checkAdherence(patientId);
  return due;
}

/** "Remind me in an hour", up to MAX_SNOOZES times. */
export async function snoozeDose(eventId: number, patientId: number) {
  const [e] = await sql`update dose_events set snoozes = snoozes + 1 where id = ${eventId} and patient_id = ${patientId}
                        and status = 'DUE' and snoozes < ${MAX_SNOOZES} returning snoozes`;
  if (!e) return "No more reminders for this dose";
  await queueMessage(sql, {
    patientId, kind: "DOSE_REMINDER", values: [await firstName(sql, patientId)], dedupeKey: `dose:${eventId}:snooze:${e.snoozes}`,
    doseEventId: eventId, sendAfter: new Date(Date.now() + HOUR),
  });
  return "Reminding again in an hour";
}

/**
 * The coach is told (PRD 7.6 BR4) when, over the last 7 days, two or more doses were skipped or missed,
 * when the last three in a row were missed, or when fewer than 70% were taken over 4 weeks.
 */
export async function checkAdherence(patientId: number) {
  const week = isoWeek(ist(new Date()).date);
  const [s] = await sql`
    select
      count(*) filter (where status in ('SKIPPED', 'MISSED') and due_at > now() - interval '7 days') as off_week,
      count(*) filter (where status <> 'DUE' and due_at > now() - interval '28 days') as resolved,
      count(*) filter (where status in ('TAKEN', 'TAKEN_LATE') and due_at > now() - interval '28 days') as taken
    from dose_events where patient_id = ${patientId}`;
  const last3 = await sql`select status from dose_events where patient_id = ${patientId} and status <> 'DUE' order by due_at desc limit 3`;
  const reasons: string[] = [];
  if (Number(s.off_week) >= 2) reasons.push(`${s.off_week} doses skipped or missed in the last 7 days`);
  if (last3.length === 3 && last3.every((r) => r.status === "MISSED")) reasons.push("the last three doses were missed");
  if (Number(s.resolved) >= 3 && Number(s.taken) / Number(s.resolved) < 0.7) reasons.push(`${Math.round((Number(s.taken) / Number(s.resolved)) * 100)}% of doses taken over 4 weeks`);
  if (!reasons.length) return;
  await openTask(sql, {
    kind: "ADHERENCE", priority: "NORMAL", patientId, title: "Doses slipping",
    detail: `${reasons.join("; ")}. Check in and find out what is getting in the way.`,
    dueAt: workingDue(new Date(), 8), dedupeKey: `adh:${patientId}:${week}`,
  });
}

/** "2026-W47": one adherence task per patient per week at most. */
export function isoWeek(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)); // the Thursday of this week decides the year
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((d.getTime() - jan4.getTime()) / 86400_000 / 7 - 3 / 7 + ((jan4.getUTCDay() + 6) % 7) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---------------------------------------------------------------- daily jobs

/** True the first time `name` runs on an India-time day; records the run. */
export async function firstRunToday(name: string): Promise<boolean> {
  const today = ist(new Date()).date;
  const [row] = await sql`
    insert into job_runs (name, last_run_at) values (${name}, now())
    on conflict (name) do update set last_run_at = now()
      where (job_runs.last_run_at at time zone 'Asia/Kolkata')::date < ${today}::date
    returning name`;
  return Boolean(row);
}

export const todayAt = (time: string) => atIst(ist(new Date()).date, time);

if (import.meta.main) {
  // deno run --allow-env lib/medicineFlow.ts: the pure parts
  const assert = (ok: boolean, what: string) => { if (!ok) throw new Error(what); };
  assert(cadenceOf("Once a week, same day each week")?.cadence === "WEEKLY", "weekly");
  assert(cadenceOf("Twice a day after meals")?.cadence === "TWICE_DAILY", "twice daily");
  assert(cadenceOf("Once daily in the morning")?.cadence === "DAILY", "daily");
  assert(cadenceOf("As needed") === null, "no rhythm");
  assert(isoWeek("2026-11-17") === "2026-W47", `iso week ${isoWeek("2026-11-17")}`);
  assert(isoWeek("2027-01-01") === "2026-W53", `iso week year edge ${isoWeek("2027-01-01")}`);
  assert(orderNumber(42) === "MED-00042", "order number");
  console.log("medicineFlow ok");
}
