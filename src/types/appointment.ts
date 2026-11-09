/** Consultations: slots, bookings and the video room, shared by both dashboards. */

export type ConsultationType = "Virtual" | "Clinic";
export type AppointmentStatus = "BOOKED" | "COMPLETED" | "CANCELLED";

/** One bookable doctor slot (GET /api/schedule/slots/:doctorId/:date). */
export type DoctorSlot = {
  slotId: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  startsAt: string; // ISO, local time
};

/** A consultation, as both dashboards show it. */
export type Appointment = {
  id: string;
  doctorId: string | null;
  doctorName: string;
  doctorPhotoUrl: string | null;
  doctorSpecialization: string;
  patientId: string | null;
  patientName: string;
  patientAge: number | null;
  patientSex: string;
  patientMobile: string;
  startsAt: string; // ISO
  endsAt: string | null; // ISO
  consultationType: ConsultationType;
  status: AppointmentStatus;
  reason: string;
  /** FIRST or FOLLOW_UP when the backend says which; null for older rows */
  visitType: "FIRST" | "FOLLOW_UP" | null;
};

/** PUT /api/schedule/book body. */
export type BookSlotRequest = {
  slotId: number;
  consultationType: ConsultationType;
  reason: string;
};

/** The video call for a consultation (GET /api/video/appointments/:appointmentId/join). */
export type VideoRoom = { joinLink: string; role: "doctor" | "patient" };
