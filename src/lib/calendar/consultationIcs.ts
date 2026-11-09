/**
 * "Add to calendar" for a booked consultation: an .ics file the phone or laptop opens in whichever
 * calendar the patient uses. Built on the device; nothing is sent anywhere.
 */

import { consultationMinutes } from "@/lib/consultations/consultationTime";
import type { Appointment } from "@/types/appointment";

/** "20261028T143000Z", the UTC form calendars expect. */
const icsStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

function consultationIcs(appointment: Appointment) {
  const start = new Date(appointment.startsAt);
  const end = new Date(
    start.getTime() + consultationMinutes(appointment) * 6e4,
  );
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//InRange//Consultation//EN",
    "BEGIN:VEVENT",
    `UID:${appointment.id}@inrange.co`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:InRange consultation with ${appointment.doctorName}`,
    "DESCRIPTION:Video consultation. Join from your InRange account; the call opens 10 minutes before.",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:InRange consultation in 30 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Hands the .ics file to the browser as a download. */
export function downloadConsultationIcs(appointment: Appointment) {
  const url = URL.createObjectURL(
    new Blob([consultationIcs(appointment)], { type: "text/calendar" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "inrange-consultation.ics";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
