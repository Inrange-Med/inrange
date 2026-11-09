/**
 * Consultations, from the patient's side. Doc: docs/backend/consultations-and-care.md
 *   GET   /api/schedule/available-slots?date=         PROPOSED. The slots this patient may book on a day, doctor hidden
 *   GET   /api/schedule/slots/:doctorId/:date         one doctor's open slots on a day (no auth)
 *   PUT   /api/schedule/book                          books a slot { slotId, consultationType, reason }
 *   GET   /api/appointments/patient                   the patient's consultations
 *   PATCH /api/appointments/:appointmentId/reschedule PROPOSED. Moves a booked consultation to another slot { slotId }
 * available-slots: before a care-team doctor is assigned, every doctor's free slots merged; after,
 * only that doctor's. The backend maps the chosen slot to its doctor.
 * toAppointment() is shared with doctorPortalService, so both dashboards read one shape.
 */

import { apiRequest, listFrom } from "@/lib/http/apiClient";
import { combineDateAndTime, toApiDate } from "@/lib/format/dateTime";
import type {
  Appointment,
  AppointmentStatus,
  BookSlotRequest,
  DoctorSlot,
} from "@/types/appointment";

type RawSlot = {
  SlotId: number;
  StartTime: string;
  EndTime: string;
  Status?: string;
};

/** The backend's appointment row. Fields differ a little between the patient and doctor lists. */
export type RawAppointment = {
  VisitType?: string | null;
  AppointmentId?: number | string;
  id?: number | string;
  DoctorId?: number | string;
  DoctorName?: string;
  DoctorPhoto?: string;
  Specialization?: string;
  PatientId?: number | string;
  FirstName?: string;
  PatientName?: string;
  PatientPhone?: string;
  Age?: number | string;
  Gender?: string;
  Status?: string;
  ConsultationType?: string;
  Reason?: string;
  SlotDate?: string;
  AppointmentDate?: string;
  StartTime?: string;
  EndTime?: string;
};

function toStatus(raw?: string): AppointmentStatus {
  const value = String(raw ?? "").toLowerCase();
  if (value === "completed") return "COMPLETED";
  if (value === "cancelled" || value === "canceled") return "CANCELLED";
  return "BOOKED";
}

/** Maps a raw appointment row. `fallbackDate` is used when the row carries only a time. */
export function toAppointment(
  raw: RawAppointment,
  fallbackDate?: string,
): Appointment {
  const date = (
    raw.SlotDate ??
    raw.AppointmentDate ??
    fallbackDate ??
    toApiDate(new Date())
  ).slice(0, 10);
  const patientName =
    raw.PatientName ??
    raw.FirstName ??
    (raw.PatientPhone ? `Patient ${raw.PatientPhone.slice(-4)}` : "Patient");
  return {
    id: String(raw.AppointmentId ?? raw.id ?? ""),
    visitType:
      raw.VisitType === "FIRST" || raw.VisitType === "FOLLOW_UP"
        ? raw.VisitType
        : null,
    doctorId: raw.DoctorId != null ? String(raw.DoctorId) : null,
    doctorName: raw.DoctorName ?? "Your doctor",
    doctorPhotoUrl: raw.DoctorPhoto ?? null,
    doctorSpecialization: raw.Specialization ?? "",
    patientId: raw.PatientId != null ? String(raw.PatientId) : null,
    patientName,
    patientAge: raw.Age != null && raw.Age !== "" ? Number(raw.Age) : null,
    patientSex: raw.Gender ?? "",
    patientMobile: raw.PatientPhone ?? "",
    startsAt: combineDateAndTime(date, raw.StartTime ?? "00:00"),
    endsAt: raw.EndTime ? combineDateAndTime(date, raw.EndTime) : null,
    consultationType: raw.ConsultationType === "Clinic" ? "Clinic" : "Virtual",
    status: toStatus(raw.Status),
    reason: raw.Reason ?? "",
  };
}

/** Slots on `date` that are still in the future, as the slot pickers read them. */
function toFutureSlots(slots: RawSlot[], date: string): DoctorSlot[] {
  return slots
    .map((slot) => ({
      slotId: Number(slot.SlotId),
      date,
      startTime: slot.StartTime.slice(0, 5),
      endTime: slot.EndTime?.slice(0, 5) ?? "",
      startsAt: combineDateAndTime(date, slot.StartTime),
    }))
    .filter(
      (slot) => slot.slotId && new Date(slot.startsAt).getTime() > Date.now(),
    );
}

/** The patient's bookable slots on a day, across doctors (the patient never picks a doctor). */
export async function listAvailableSlots(day: Date): Promise<DoctorSlot[]> {
  const date = toApiDate(day);
  const body = await apiRequest("/api/schedule/available-slots", {
    query: { date },
  });
  return toFutureSlots(listFrom<RawSlot>(body), date);
}

export async function listDoctorSlots(
  doctorId: number,
  day: Date,
): Promise<DoctorSlot[]> {
  const date = toApiDate(day);
  const body = await apiRequest(`/api/schedule/slots/${doctorId}/${date}`, {
    authenticated: false,
  });
  const openSlots = listFrom<RawSlot>(body).filter(
    (slot) => !slot.Status || slot.Status.toLowerCase() === "available",
  );
  return toFutureSlots(openSlots, date);
}

export async function bookSlot(request: BookSlotRequest): Promise<void> {
  await apiRequest("/api/schedule/book", { method: "PUT", body: request });
}

export async function listMyAppointments(): Promise<Appointment[]> {
  const body = await apiRequest("/api/appointments/patient");
  return listFrom<RawAppointment>(body, "appointments")
    .map((raw) => toAppointment(raw))
    .sort((first, second) => first.startsAt.localeCompare(second.startsAt));
}

/** A 404 means the backend does not offer it yet; the Change time sheet says so. */
export async function rescheduleAppointment(
  appointmentId: string,
  slotId: number,
): Promise<void> {
  await apiRequest(`/api/appointments/${appointmentId}/reschedule`, {
    method: "PATCH",
    body: { slotId },
  });
}
