// Messages on WhatsApp, to patients and to doctors: queued with a key that makes every trigger idempotent,
// claimed by one sender at a time, checked again right before they go (still opted in? still true?), sent
// through integrations/whatsapp.ts, retried with backoff when Meta says it may work later, and recorded
// whatever happens (patient_messages; patient_id is whoever the message is for). docs/backend/whatsapp.md.
import type { TransactionSql } from "postgres";
import { sql } from "./db.ts";
import { isTestMobile } from "./env.ts";
import { daytime } from "./hours.ts";
import { type MessageKind, TEMPLATES, type Template } from "./messages.ts";
import * as wa from "../integrations/whatsapp.ts";

type Tx = TransactionSql | typeof sql;

export type QueueInput = {
  /** who the message is for: a patient, or a doctor for the doctor's notices */
  patientId: number;
  kind: MessageKind;
  /** fills the template's {{n}}, in order */
  values: string[];
  /** the id each dynamic URL button opens, in order (an appointment, a prescription, an order) */
  links?: string[];
  /** unique per trigger: "rx:41:v1:ready", "order:7:DISPATCHED"; a second queue with the same key does nothing */
  dedupeKey: string;
  sendAfter?: Date;
  prescriptionId?: number | null;
  cartId?: number | null;
  medicineOrderId?: number | null;
  doseEventId?: number | null;
  appointmentId?: number | null;
  labBookingId?: string | null;
  /** what the message assumed, re-checked before it goes: the slot it named, the payment it was about */
  slotId?: number | null;
  slotDate?: string | null;
  paymentOrderId?: string | null;
};

const MAX_ATTEMPTS = 5;

/** Queues a message; returns its id, or null when the same trigger was queued before. */
export async function queueMessage(tx: Tx, m: QueueInput): Promise<number | null> {
  const t: Template = TEMPLATES[m.kind];
  const when = t.daytime ? daytime(m.sendAfter ?? new Date()) : (m.sendAfter ?? new Date());
  const vars = {
    values: m.values, links: m.links ?? [], slotId: m.slotId ?? null, slotDate: m.slotDate ?? null, paymentOrderId: m.paymentOrderId ?? null,
  };
  const [row] = await tx`
    insert into patient_messages (patient_id, kind, vars, dedupe_key, send_after, prescription_id, cart_id, medicine_order_id,
      dose_event_id, appointment_id, lab_booking_id)
    values (${m.patientId}, ${m.kind}, ${tx.json(vars)}, ${m.dedupeKey}, ${when}, ${m.prescriptionId ?? null}, ${m.cartId ?? null},
      ${m.medicineOrderId ?? null}, ${m.doseEventId ?? null}, ${m.appointmentId ?? null}, ${m.labBookingId ?? null})
    on conflict (dedupe_key) do nothing returning id`;
  return row?.id ?? null;
}

/** True when the person has agreed to WhatsApp messages (an active WHATSAPP consent). */
export async function whatsappOptedIn(userId: number): Promise<boolean> {
  const [row] = await sql`select 1 from consents where user_id = ${userId} and consent_type = 'WHATSAPP' and revoked_at is null limit 1`;
  return Boolean(row);
}

const CART_KINDS = ["CHECK_IN", "CARE_LINK", "SUPPLY_LOW"];
const SLOT_KINDS = ["APPT_BOOKED", "APPT_MOVED", "APPT_REMINDER", "APPT_SOON", "DOCTOR_WAITING", "DR_BOOKED", "DR_MOVED", "DR_SOON", "DR_PATIENT_WAITING"];
const BEFORE_START = ["APPT_REMINDER", "APPT_SOON", "DR_SOON"];

/**
 * Why a queued message should not go any more, or null to send. Each kind re-checks the state it was
 * about, so a message queued earlier never contradicts what happened since (paid, moved, cancelled,
 * already joined, dose already logged).
 */
// deno-lint-ignore no-explicit-any
async function staleReason(m: Record<string, any>): Promise<string | null> {
  if (m.cart_id && CART_KINDS.includes(m.kind)) {
    const [k] = await sql`select status, elsewhere_at from medicine_carts where id = ${m.cart_id}`;
    if (!k || k.status !== "OPEN") return k?.status === "PAID" ? "Already paid" : "The order was replaced";
    if (k.elsewhere_at) return "Bought elsewhere";
  }
  if (m.kind === "PAYMENT_FAILED" && m.vars?.paymentOrderId) {
    const [p] = await sql`select status from payment_orders where id = ${m.vars.paymentOrderId}`;
    if (p?.status === "PAID") return "Paid since";
  }
  if (m.kind === "DOSE_REMINDER") {
    if (!m.dose_event_id) return "The dose was removed";
    const [e] = await sql`select status from dose_events where id = ${m.dose_event_id}`;
    if (!e || e.status !== "DUE") return "Dose already logged";
  }
  if (m.kind === "ORDER_FEEDBACK" && m.medicine_order_id) {
    const [o] = await sql`select feedback from medicine_orders where id = ${m.medicine_order_id}`;
    if (o?.feedback) return "Feedback already given";
  }
  if (m.appointment_id && SLOT_KINDS.includes(m.kind)) {
    const [a] = await sql`
      select a.status, a.slot_id, a.started_at, a.patient_joined_at, (s.slot_date + s.start_time) at time zone 'Asia/Kolkata' as starts_at
      from appointments a left join doctor_slots s on s.id = a.slot_id where a.id = ${m.appointment_id}`;
    if (!a || !["Booked", "InProgress"].includes(a.status)) return "The consultation ended or was cancelled";
    if (m.vars?.slotId && a.slot_id !== m.vars.slotId) return "The consultation moved since";
    if (BEFORE_START.includes(m.kind) && a.starts_at && new Date(a.starts_at) < new Date()) return "Too late: it has started";
    if (m.kind === "DOCTOR_WAITING" && a.patient_joined_at) return "The patient joined already";
    if (m.kind === "DR_PATIENT_WAITING" && a.started_at) return "The doctor joined already";
  }
  if (m.kind === "DR_NOTE_TO_SIGN" && m.appointment_id) {
    const [n] = await sql`select status from clinical_notes where appointment_id = ${m.appointment_id}`;
    if (n?.status === "SIGNED") return "Signed already";
  }
  if (m.lab_booking_id && m.kind === "LAB_TOMORROW") {
    const [b] = await sql`select status, to_char(slot_date, 'YYYY-MM-DD') as slot_date from lab_bookings where id = ${m.lab_booking_id}`;
    if (!b || !["BOOKED", "COLLECTOR_ASSIGNED"].includes(b.status)) return "The collection is no longer due";
    if (m.vars?.slotDate && b.slot_date !== m.vars.slotDate) return "The collection moved since";
  }
  return null;
}

/**
 * Sends one queued message once it is due. Never throws: the row records the outcome. The claim (status
 * QUEUED and due, then pushed 10 minutes on) makes it safe to call from anywhere, any number of times:
 * only one caller sends, and nothing goes before its time.
 */
export async function deliver(id: number): Promise<string> {
  const [m] = await sql`
    update patient_messages set send_after = now() + interval '10 minutes'
    where id = ${id} and status = 'QUEUED' and send_after <= now()
    returning *, (select u.mobile from users u where u.id = patient_messages.patient_id) as mobile,
      (select u.role from users u where u.id = patient_messages.patient_id) as role,
      (select p.reminders->>'remindersEnabled' from patient_profiles p where p.user_id = patient_messages.patient_id) as reminders_on`;
  if (!m) return "NOT_DUE";
  const skip = async (reason: string) => {
    await sql`update patient_messages set status = 'SKIPPED', skip_reason = ${reason} where id = ${id}`;
    return "SKIPPED";
  };
  const t: Template | undefined = TEMPLATES[m.kind as MessageKind];
  if (!t) return await skip("Unknown message");
  if (!(await whatsappOptedIn(m.patient_id))) return await skip("Not opted in to WhatsApp");
  if (t.reminder && m.role === "PATIENT" && m.reminders_on === "false") return await skip("Reminders turned off");
  // the seeded doctors and test patients have made-up numbers that may belong to someone real
  if (wa.whatsappLive() && isTestMobile(m.mobile)) return await skip("Test account: not sent");
  const stale = await staleReason(m);
  if (stale) return await skip(stale);

  try {
    const { providerId } = await wa.sendTemplate({ to: m.mobile, ref: m.id, template: t, values: m.vars?.values ?? [], links: m.vars?.links ?? [] });
    // a status webhook can land before this write (it finds the row by its pm: id): never move it back
    await sql`update patient_messages set status = case when status = 'QUEUED' then 'SENT' else status end, provider_id = ${providerId},
              sent_at = now(), error = null, attempts = attempts + 1 where id = ${id}`;
    return "SENT";
  } catch (e) {
    const attempts = (m.attempts ?? 0) + 1;
    // a final answer from Meta (bad number, template not approved, policy) is not retried
    const final = attempts >= MAX_ATTEMPTS || (e instanceof wa.WhatsAppError && !e.retry);
    const message = (e as Error).message.slice(0, 500);
    console.error("whatsapp send", id, message);
    // back off 2, 4, 8, 16 minutes; then it stays FAILED for the medicine queue to see
    // a delivered status may already be in (a timeout after Meta accepted it): then it stays delivered, no retry
    await sql`update patient_messages set attempts = ${attempts}, error = ${message},
      status = case when status in ('DELIVERED', 'READ') then status else ${final ? "FAILED" : "QUEUED"} end,
      send_after = now() + make_interval(mins => ${2 ** attempts}) where id = ${id}`;
    return final ? "FAILED" : "RETRY";
  }
}

/** Sends these (queued inside a transaction that has now committed). Not yet due, or not opted in: recorded, nothing sent. */
export async function sendNow(ids: (number | null | undefined)[]) {
  for (const id of ids) if (id) await deliver(id).catch((e) => console.error("send", id, (e as Error).message));
}

/** Queues and sends at once when it is due (order updates, notices): the tick sends anything later. */
export async function queueAndSend(m: QueueInput): Promise<number | null> {
  const id = await queueMessage(sql, m);
  await sendNow([id]);
  return id;
}

/** The tick: everything due, oldest first, until the time budget runs out (the rest goes on the next tick). */
export async function sendDue(budgetMs = 60_000, limit = 200) {
  const started = Date.now();
  const due = await sql`select id from patient_messages where status = 'QUEUED' and send_after <= now() order by send_after limit ${limit}`;
  const out: Record<string, number> = {};
  for (const { id } of due) {
    if (Date.now() - started > budgetMs) break;
    const result = await deliver(id);
    out[result] = (out[result] ?? 0) + 1;
  }
  return out;
}

/** A plain reply inside WhatsApp's 24-hour window (after a tap or a message), recorded like any message. */
export async function replyText(userId: number, replyId: number, text: string) {
  const [row] = await sql`
    insert into patient_messages (patient_id, kind, vars, dedupe_key, status)
    values (${userId}, 'REPLY', ${sql.json({ text })}, ${`reply:${replyId}`}, 'QUEUED')
    on conflict (dedupe_key) do nothing returning id`;
  if (!row) return;
  const [u] = await sql`select mobile from users where id = ${userId}`;
  try {
    const { providerId } = await wa.sendText(u.mobile, row.id, text);
    await sql`update patient_messages set status = case when status = 'QUEUED' then 'SENT' else status end, provider_id = ${providerId},
              sent_at = now(), attempts = 1 where id = ${row.id}`;
  } catch (e) {
    await sql`update patient_messages set status = 'FAILED', error = ${(e as Error).message.slice(0, 500)}, attempts = 1 where id = ${row.id}`;
  }
}

/** The skip-reason list after "Skip this one". */
export async function replyList(patientId: number, replyId: number, text: string, rows: { code: string; label: string }[], ref: number) {
  const [row] = await sql`
    insert into patient_messages (patient_id, kind, vars, dedupe_key, status, dose_event_id)
    select ${patientId}, 'REPLY', ${sql.json({ text, rows })}, ${`reply:${replyId}`}, 'QUEUED', dose_event_id
    from patient_messages where id = ${ref}
    on conflict (dedupe_key) do nothing returning id`;
  if (!row) return;
  const [u] = await sql`select mobile from users where id = ${patientId}`;
  try {
    const { providerId } = await wa.sendList(u.mobile, row.id, text, rows);
    await sql`update patient_messages set status = case when status = 'QUEUED' then 'SENT' else status end, provider_id = ${providerId},
              sent_at = now(), attempts = 1 where id = ${row.id}`;
  } catch (e) {
    await sql`update patient_messages set status = 'FAILED', error = ${(e as Error).message.slice(0, 500)}, attempts = 1 where id = ${row.id}`;
  }
}
