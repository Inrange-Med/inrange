// Slot holds and bookings, shared by the schedule routes (routes/care.ts) and payments
// (a paid CONSULTATION_FEE books its held slot). Both take a postgres.js transaction.
// Eligibility rules live in the calling route, not here: these only move slots and appointments.
import type { TransactionSql } from "postgres";
import { fail } from "./http.ts";

const DEFAULT_FEE_RUPEES = 499;
const HOLD_MINUTES = 15;

/** A slot that can be taken by `patientId`: free, held by them, or held by someone whose hold ran out. Future only. */
const takeable = (tx: TransactionSql, patientId: number) => tx`
  (s.status = 'Available' or (s.status = 'Held' and (s.held_by = ${patientId} or s.held_until < now())))
  and (s.slot_date + s.start_time) > (now() at time zone 'Asia/Kolkata')`;

export async function holdSlot(tx: TransactionSql, patientId: number, slotId: number): Promise<{
  slotId: number; doctorId: number; slotDate: string; startTime: string; endTime: string; feeRupees: number;
}> {
  const [row] = await tx`
    update doctor_slots s set status = 'Held', held_by = ${patientId},
      held_until = now() + make_interval(mins => ${HOLD_MINUTES})
    from doctors d
    where s.id = ${slotId} and d.id = s.doctor_id and d.active and ${takeable(tx, patientId)}
    returning s.id, s.doctor_id, to_char(s.slot_date, 'YYYY-MM-DD') as slot_date,
      to_char(s.start_time, 'HH24:MI') as start_time, to_char(s.end_time, 'HH24:MI') as end_time,
      d.consultation_fee_rupees`;
  if (!row) fail(409, "That time was just booked. Choose another.");
  return {
    slotId: row.id, doctorId: row.doctor_id, slotDate: row.slot_date, startTime: row.start_time,
    endTime: row.end_time, feeRupees: row.consultation_fee_rupees ?? DEFAULT_FEE_RUPEES,
  };
}

/** Books the slot for the patient. `prepaid` is informational (payments pass true); checks belong to the caller. */
export async function bookAppointment(tx: TransactionSql, args: {
  patientId: number; slotId: number; reason?: string | null; consultationType?: string; prepaid?: boolean;
}): Promise<{ appointmentId: number }> {
  const [slot] = await tx`
    update doctor_slots s set status = 'Booked', held_by = null, held_until = null
    where s.id = ${args.slotId} and ${takeable(tx, args.patientId)}
    returning s.id, s.doctor_id`;
  if (!slot) fail(409, "That time was just booked. Choose another.");
  const [{ count }] = await tx`
    select count(*)::int as count from appointments where patient_id = ${args.patientId} and status <> 'Cancelled'`;
  const [appt] = await tx`
    insert into appointments (patient_id, doctor_id, slot_id, consultation_type, visit_type, reason)
    values (${args.patientId}, ${slot.doctor_id}, ${slot.id}, ${args.consultationType === "Clinic" ? "Clinic" : "Virtual"},
      ${count > 0 ? "FOLLOW_UP" : "FIRST"}, ${args.reason?.trim() || null})
    returning id`;
  return { appointmentId: appt.id };
}
