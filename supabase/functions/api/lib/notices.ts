// The WhatsApp notices outside the medicine flow: consultations (to the patient and to the doctor, with the
// link that opens the video room), blood tests, the medical team's review, a doctor's next steps, chat and
// failed payments. Each one queues inside the caller's transaction when there is one and returns the
// message ids; the caller passes them to sendNow() once it has committed. Reminders are queued ahead with
// their send time and re-checked before they go (lib/notify.ts), so a moved or cancelled consultation
// never gets the old reminder. docs/backend/whatsapp.md.
import type { TransactionSql } from "postgres";
import { sql } from "./db.ts";
import { atIst, clockWords, ist, spokenSlot } from "./hours.ts";
import { queueMessage } from "./notify.ts";

type Tx = TransactionSql | typeof sql;
type Id = number | null;
const MIN = 60_000;
const HOUR = 60 * MIN;

/**
 * Queues inside a business transaction without ever failing it: a failed statement would abort the whole
 * transaction (a paid booking with it), so the messages get their own savepoint, and a problem is logged.
 */
export async function within(tx: TransactionSql, queue: (sp: TransactionSql) => Promise<Id[]>): Promise<Id[]> {
  try {
    return await tx.savepoint((sp) => queue(sp));
  } catch (e) {
    console.error("notice not queued", (e as Error).message);
    return [];
  }
}

/** The first name a message greets: the profile's, else the account's, else "there". */
export async function firstName(tx: Tx, userId: number): Promise<string> {
  const [r] = await tx`select coalesce(nullif(p.first_name, ''), split_part(u.full_name, ' ', 1), 'there') as name
                       from users u left join patient_profiles p on p.user_id = u.id where u.id = ${userId}`;
  return r?.name || "there";
}

async function appointment(tx: Tx, appointmentId: number) {
  const [a] = await tx`
    select a.id, a.patient_id, a.doctor_id, a.slot_id, a.visit_type, d.full_name as doctor,
      to_char(s.slot_date, 'YYYY-MM-DD') as slot_date, to_char(s.start_time, 'HH24:MI') as start_time
    from appointments a join doctor_slots s on s.id = a.slot_id join doctors d on d.id = a.doctor_id
    where a.id = ${appointmentId}`;
  return a ?? null;
}

/** The booking's own reminders: the day before (when booked well ahead) and a quarter of an hour before, to both. */
// deno-lint-ignore no-explicit-any
async function reminders(tx: Tx, a: Record<string, any>, name: string): Promise<Id[]> {
  const startsAt = atIst(a.slot_date, a.start_time);
  const ahead = startsAt.getTime() - Date.now();
  const base = { appointmentId: a.id, slotId: a.slot_id, links: [String(a.id)] };
  const key = `appt:${a.id}:s${a.slot_id}`;
  const ids: Id[] = [];
  if (ahead > 26 * HOUR)
    ids.push(await queueMessage(tx, { ...base, patientId: a.patient_id, kind: "APPT_REMINDER", values: [name, a.doctor, spokenSlot(a.slot_date, a.start_time)],
      dedupeKey: `${key}:day`, sendAfter: new Date(startsAt.getTime() - 24 * HOUR) }));
  if (ahead > 30 * MIN) {
    const soon = new Date(startsAt.getTime() - 15 * MIN);
    ids.push(await queueMessage(tx, { ...base, patientId: a.patient_id, kind: "APPT_SOON", values: [name, a.doctor, clockWords(a.start_time)], dedupeKey: `${key}:soon`, sendAfter: soon }));
    ids.push(await queueMessage(tx, { ...base, patientId: a.doctor_id, kind: "DR_SOON", values: [clockWords(a.start_time)], dedupeKey: `${key}:dr-soon`, sendAfter: soon }));
  }
  return ids;
}

/** A consultation was booked (paid or prepaid): the patient's confirmation, the doctor's notice, the reminders. */
export async function appointmentBooked(tx: Tx, appointmentId: number): Promise<Id[]> {
  const a = await appointment(tx, appointmentId);
  if (!a) return [];
  const name = await firstName(tx, a.patient_id);
  const when = spokenSlot(a.slot_date, a.start_time);
  const base = { appointmentId: a.id, slotId: a.slot_id, links: [String(a.id)] };
  const key = `appt:${a.id}:s${a.slot_id}`;
  return [
    await queueMessage(tx, { ...base, patientId: a.patient_id, kind: "APPT_BOOKED", values: [name, a.doctor, when], dedupeKey: `${key}:booked` }),
    await queueMessage(tx, { ...base, patientId: a.doctor_id, kind: "DR_BOOKED",
      values: [a.visit_type === "FIRST" ? "first consultation" : "follow-up consultation", when], dedupeKey: `${key}:dr-booked` }),
    ...(await reminders(tx, a, name)),
  ];
}

/** The patient moved it: both hear the new time; the old reminders are dropped (the slot changed) and new ones queued. */
export async function appointmentMoved(tx: Tx, appointmentId: number, from: { slotDate: string; startTime: string }): Promise<Id[]> {
  const a = await appointment(tx, appointmentId);
  if (!a) return [];
  const name = await firstName(tx, a.patient_id);
  const when = spokenSlot(a.slot_date, a.start_time);
  const base = { appointmentId: a.id, slotId: a.slot_id, links: [String(a.id)] };
  const key = `appt:${a.id}:s${a.slot_id}`;
  return [
    await queueMessage(tx, { ...base, patientId: a.patient_id, kind: "APPT_MOVED", values: [name, a.doctor, when], dedupeKey: `${key}:moved` }),
    await queueMessage(tx, { ...base, patientId: a.doctor_id, kind: "DR_MOVED", values: [spokenSlot(from.slotDate, from.startTime), when], dedupeKey: `${key}:dr-moved` }),
    ...(await reminders(tx, a, name)),
  ];
}

/** Someone opened the room: the other one hears it, once, if they are not in yet (lib/notify.ts checks again). */
export async function joined(appointmentId: number, who: "doctor" | "patient"): Promise<Id[]> {
  const a = await appointment(sql, appointmentId);
  if (!a) return [];
  const base = { appointmentId: a.id, slotId: a.slot_id, links: [String(a.id)] };
  const key = `appt:${a.id}:s${a.slot_id}`;
  return [who === "doctor"
    ? await queueMessage(sql, { ...base, patientId: a.patient_id, kind: "DOCTOR_WAITING", values: [await firstName(sql, a.patient_id), a.doctor], dedupeKey: `${key}:doctor-in` })
    : await queueMessage(sql, { ...base, patientId: a.doctor_id, kind: "DR_PATIENT_WAITING", values: [clockWords(a.start_time)], dedupeKey: `${key}:patient-in` })];
}

/** The call ended: the doctor is reminded to sign the note an hour later, unless it is signed by then. */
export async function callEnded(appointmentId: number): Promise<Id[]> {
  const a = await appointment(sql, appointmentId);
  if (!a) return [];
  return [await queueMessage(sql, {
    patientId: a.doctor_id, kind: "DR_NOTE_TO_SIGN", values: [clockWords(a.start_time)], appointmentId: a.id,
    dedupeKey: `appt:${a.id}:note`, sendAfter: new Date(Date.now() + HOUR),
  })];
}

/** A paid home collection: the confirmation, and a reminder the evening before (6 pm) when that is still ahead. */
export async function labBooked(tx: Tx, bookingId: string): Promise<Id[]> {
  const [b] = await tx`select id, user_id, status, to_char(slot_date, 'YYYY-MM-DD') as slot_date, slot_start, slot_end from lab_bookings where id = ${bookingId}`;
  if (!b || b.status !== "BOOKED" || !b.slot_date || !b.slot_start) return [];
  const name = await firstName(tx, b.user_id);
  const window = b.slot_end ? `${clockWords(b.slot_start)} to ${clockWords(b.slot_end)}` : clockWords(b.slot_start);
  const day = spokenSlot(b.slot_date, b.slot_start).replace(/, [^,]+$/, "");
  const evening = new Date(atIst(b.slot_date, "18:00").getTime() - 24 * HOUR);
  const base = { patientId: b.user_id, labBookingId: b.id, links: [b.id], slotDate: b.slot_date };
  return [
    await queueMessage(tx, { ...base, kind: "LAB_BOOKED", values: [name, `${day}, ${window}`], dedupeKey: `lab:${b.id}:booked` }),
    evening.getTime() > Date.now() + HOUR
      ? await queueMessage(tx, { ...base, kind: "LAB_TOMORROW", values: [name, window], dedupeKey: `lab:${b.id}:${b.slot_date}:tomorrow`, sendAfter: evening })
      : null,
  ];
}

/** What the lab told us that the patient needs to hear: the report, or a cancelled collection. */
export async function labEvent(bookingId: string, event: string): Promise<Id[]> {
  if (event !== "REPORT_READY" && event !== "CANCELLED") return [];
  const [b] = await sql`select id, user_id, to_char(slot_date, 'YYYY-MM-DD') as slot_date, slot_start from lab_bookings where id = ${bookingId}`;
  if (!b) return [];
  const name = await firstName(sql, b.user_id);
  if (event === "REPORT_READY")
    return [await queueMessage(sql, { patientId: b.user_id, kind: "REPORT_READY", values: [name], labBookingId: b.id, dedupeKey: `lab:${b.id}:report` })];
  const day = b.slot_date ? spokenSlot(b.slot_date, b.slot_start ?? "09:00").replace(/, [^,]+$/, "") : "your chosen day";
  return [await queueMessage(sql, { patientId: b.user_id, kind: "LAB_CANCELLED", values: [name, day], labBookingId: b.id, dedupeKey: `lab:${b.id}:cancelled` })];
}

/** The medical team's decision on the blood tests: book now, or read the note. A later decision is a new message. */
export async function reviewDecided(tx: Tx, patientId: number, decision: "APPROVED" | "NOT_APPROVED"): Promise<Id[]> {
  const name = await firstName(tx, patientId);
  return [await queueMessage(tx, {
    patientId, kind: decision === "APPROVED" ? "REVIEW_APPROVED" : "REVIEW_NOTE", values: [name],
    dedupeKey: `review:${patientId}:${decision}:${new Date().toISOString().slice(0, 16)}`,
  })];
}

/** The doctor wrote up the next steps (a plan recommendation). */
export async function carePlanWritten(patientId: number, doctorName: string, planId: number): Promise<Id[]> {
  return [await queueMessage(sql, {
    patientId, kind: "CARE_PLAN", values: [await firstName(sql, patientId), doctorName],
    dedupeKey: `plan:${patientId}:${planId}:${ist(new Date()).date}`,
  })];
}

/** A chat message: the other side hears there is one, at most once an hour per conversation. The words stay in the app. */
export async function chatMessage(s: { id: number; patient_id: number; doctor_id: number }, from: "PATIENT" | "DOCTOR"): Promise<Id[]> {
  const hour = new Date().toISOString().slice(0, 13);
  if (from === "PATIENT")
    return [await queueMessage(sql, { patientId: s.doctor_id, kind: "DR_PATIENT_MESSAGE", values: [], links: [String(s.patient_id)], dedupeKey: `chat:${s.id}:dr:${hour}` })];
  const [d] = await sql`select full_name from doctors where id = ${s.doctor_id}`;
  return [await queueMessage(sql, {
    patientId: s.patient_id, kind: "DOCTOR_REPLIED", values: [await firstName(sql, s.patient_id), d?.full_name ?? "Your doctor"],
    links: [String(s.doctor_id)], dedupeKey: `chat:${s.id}:pt:${hour}`,
  })];
}

const PAID_FOR: Record<string, string> = {
  CONSULTATION_FEE: "your consultation", LAB_BOOKING: "your blood tests", PLAN: "your plan", MEDICINE_ORDER: "your medicines order",
};

/**
 * Razorpay said a payment failed. It is not final (a UPI retry can still be captured), so the message waits
 * a quarter of an hour and is dropped if the payment went through by then.
 */
export async function paymentFailed(o: { id: string; user_id: number; purpose: string }): Promise<Id[]> {
  return [await queueMessage(sql, {
    patientId: o.user_id, kind: "PAYMENT_FAILED", values: [await firstName(sql, o.user_id), PAID_FOR[o.purpose] ?? "your order"],
    paymentOrderId: o.id, cartId: null, dedupeKey: `pay:${o.id}:failed`, sendAfter: new Date(Date.now() + 15 * MIN),
  })];
}
