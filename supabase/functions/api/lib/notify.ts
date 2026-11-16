// Messages to the patient: queued with a key that makes every trigger idempotent, checked again right
// before they go (still wanted? still opted in?), sent through integrations/whatsapp.ts, retried with
// backoff, and recorded whatever happens (patient_messages). docs/backend/medicine-flow.md.
import type { TransactionSql } from "postgres";
import { sql } from "./db.ts";
import { daytime } from "./hours.ts";
import { type MessageKind, TEMPLATES, type Template } from "./messages.ts";
import { downloadFile } from "./storage.ts";
import * as wa from "../integrations/whatsapp.ts";

type Tx = TransactionSql | typeof sql;

export type QueueInput = {
  patientId: number;
  kind: MessageKind;
  /** fills the template's {{n}}, in order */
  values: string[];
  /** unique per trigger: "rx:41:ready", "order:7:DISPATCHED"; a second queue with the same key does nothing */
  dedupeKey: string;
  sendAfter?: Date;
  prescriptionId?: number | null;
  cartId?: number | null;
  medicineOrderId?: number | null;
  doseEventId?: number | null;
  /** the prescription PDF to attach (storage path), for RX_READY* */
  documentPath?: string | null;
};

const MAX_ATTEMPTS = 5;

/** Queues a message; returns its id, or null when the same trigger was queued before. */
export async function queueMessage(tx: Tx, m: QueueInput): Promise<number | null> {
  const t: Template = TEMPLATES[m.kind];
  const when = t.daytime ? daytime(m.sendAfter ?? new Date()) : (m.sendAfter ?? new Date());
  const [row] = await tx`
    insert into patient_messages (patient_id, kind, vars, dedupe_key, send_after, prescription_id, cart_id, medicine_order_id, dose_event_id)
    values (${m.patientId}, ${m.kind}, ${tx.json({ values: m.values, documentPath: m.documentPath ?? null })}, ${m.dedupeKey},
      ${when}, ${m.prescriptionId ?? null}, ${m.cartId ?? null}, ${m.medicineOrderId ?? null}, ${m.doseEventId ?? null})
    on conflict (dedupe_key) do nothing returning id`;
  return row?.id ?? null;
}

/** True when the patient has agreed to WhatsApp messages (an active WHATSAPP consent). */
export async function whatsappOptedIn(patientId: number): Promise<boolean> {
  const [row] = await sql`select 1 from consents where user_id = ${patientId} and consent_type = 'WHATSAPP' and revoked_at is null limit 1`;
  return Boolean(row);
}

/**
 * Why a queued message should not go any more, or null to send. Each kind re-checks the state it was
 * about, so a message queued yesterday never contradicts what happened since (paid, bought elsewhere,
 * dose already logged).
 */
// deno-lint-ignore no-explicit-any
async function staleReason(m: Record<string, any>): Promise<string | null> {
  const cartKinds = ["CHECK_IN_1", "CHECK_IN_2", "PLAN_REMINDER", "ORDER_LINK", "PAYMENT_FAILED", "REFILL_DUE"];
  if (m.cart_id && cartKinds.includes(m.kind)) {
    const [k] = await sql`select status, elsewhere_at from medicine_carts where id = ${m.cart_id}`;
    if (!k || k.status !== "OPEN") return k?.status === "PAID" ? "Already paid" : "The order was replaced";
    if (k.elsewhere_at) return "Bought elsewhere";
  }
  if (m.dose_event_id) {
    const [e] = await sql`select status from dose_events where id = ${m.dose_event_id}`;
    if (!e || e.status !== "DUE") return "Dose already logged";
  }
  if (m.kind === "ORDER_FEEDBACK" && m.medicine_order_id) {
    const [o] = await sql`select feedback from medicine_orders where id = ${m.medicine_order_id}`;
    if (o?.feedback) return "Feedback already given";
  }
  return null;
}

/** Sends one queued message (claimed by the caller). Never throws: the row records the outcome. */
export async function deliver(id: number): Promise<string> {
  const [m] = await sql`
    select m.*, u.mobile from patient_messages m join users u on u.id = m.patient_id where m.id = ${id}`;
  if (!m || !["QUEUED", "FAILED"].includes(m.status)) return m?.status ?? "MISSING";
  const skip = async (reason: string) => {
    await sql`update patient_messages set status = 'SKIPPED', skip_reason = ${reason} where id = ${id}`;
    return "SKIPPED";
  };
  if (!(await whatsappOptedIn(m.patient_id))) return await skip("Not opted in to WhatsApp");
  const stale = await staleReason(m);
  if (stale) return await skip(stale);

  const t: Template = TEMPLATES[m.kind as MessageKind];
  if (!t) return await skip("Unknown message");
  try {
    let documentId: string | null = null;
    if (t.document && m.vars?.documentPath && wa.whatsappLive()) {
      const file = await downloadFile("prescriptions", m.vars.documentPath);
      if (file) documentId = await wa.uploadMedia(await file.blob(), "inrange-prescription.pdf");
    }
    const { providerId } = await wa.sendTemplate({
      to: m.mobile, ref: m.id, name: t.name, values: m.vars?.values ?? [], buttons: t.buttons, documentId,
    });
    await sql`update patient_messages set status = 'SENT', provider_id = ${providerId}, sent_at = now(), error = null,
              attempts = attempts + 1 where id = ${id}`;
    return "SENT";
  } catch (e) {
    const attempts = (m.attempts ?? 0) + 1;
    const message = (e as Error).message.slice(0, 500);
    console.error("whatsapp send", id, message);
    // back off 2, 4, 8, 16 minutes; then it stays FAILED for the medicine queue to see
    await sql`update patient_messages set attempts = ${attempts}, error = ${message},
      status = ${attempts >= MAX_ATTEMPTS ? "FAILED" : "QUEUED"},
      send_after = now() + make_interval(mins => ${2 ** attempts}) where id = ${id}`;
    return attempts >= MAX_ATTEMPTS ? "FAILED" : "RETRY";
  }
}

/** Queues and sends at once (order updates, the prescription): the tick only retries what fails. */
export async function queueAndSend(m: QueueInput): Promise<void> {
  const id = await queueMessage(sql, m);
  if (id && !(TEMPLATES[m.kind] as Template).daytime && (!m.sendAfter || m.sendAfter <= new Date())) await deliver(id);
}

/** The tick: everything due, oldest first, each claimed so two ticks never send the same row. */
export async function sendDue(limit = 60) {
  const claimed = await sql`
    update patient_messages set send_after = now() + interval '10 minutes'
    where id in (select id from patient_messages where status = 'QUEUED' and send_after <= now()
                 order by send_after limit ${limit} for update skip locked)
    returning id`;
  const out: Record<string, number> = {};
  for (const { id } of claimed) {
    const result = await deliver(id);
    out[result] = (out[result] ?? 0) + 1;
  }
  return out;
}

/** A plain reply inside WhatsApp's 24-hour window (after a tap), recorded like any message. */
export async function replyText(patientId: number, replyId: number, text: string) {
  const [row] = await sql`
    insert into patient_messages (patient_id, kind, vars, dedupe_key, status)
    values (${patientId}, 'REPLY', ${sql.json({ text })}, ${`reply:${replyId}`}, 'QUEUED')
    on conflict (dedupe_key) do nothing returning id`;
  if (!row) return;
  const [u] = await sql`select mobile from users where id = ${patientId}`;
  try {
    const { providerId } = await wa.sendText(u.mobile, row.id, text);
    await sql`update patient_messages set status = 'SENT', provider_id = ${providerId}, sent_at = now(), attempts = 1 where id = ${row.id}`;
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
    await sql`update patient_messages set status = 'SENT', provider_id = ${providerId}, sent_at = now(), attempts = 1 where id = ${row.id}`;
  } catch (e) {
    await sql`update patient_messages set status = 'FAILED', error = ${(e as Error).message.slice(0, 500)}, attempts = 1 where id = ${row.id}`;
  }
}
