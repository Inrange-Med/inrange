/**
 * How a lab booking reads on screen: its status in words and its collection window. Shared by the
 * bookings list and a booking's own page.
 */

import { clockTime, spokenDay } from "@/lib/format/dateTime";
import { checkoutHref } from "@/lib/payments/checkoutHref";
import type { LabBooking, LabBookingStatus } from "@/types/labTest";

export const LAB_STATUS_WORDS: Record<LabBookingStatus, string> = {
  PAYMENT_PENDING: "Waiting for payment",
  BOOKED: "Booked",
  COLLECTOR_ASSIGNED: "Collector assigned",
  SAMPLE_COLLECTED: "Sample collected",
  PROCESSING: "At the lab",
  REPORT_READY: "Report ready",
  CANCELLED: "Cancelled",
  EXPIRED: "Not paid in time",
};

/**
 * What is happening now and what comes next, in one or two plain sentences, for a booking that is
 * paid. Says only what the lab has told us; never promises a time the lab has not given.
 */
export function labStatusLine(booking: LabBooking): string | null {
  const who = booking.collector?.name ?? "The collector";
  switch (booking.status) {
    case "BOOKED":
      return "Your test is booked with our partner lab, Redcliffe Labs. When they assign a collector, their name and number appear here.";
    case "COLLECTOR_ASSIGNED":
      if (booking.collector?.journey === "ARRIVED")
        return `${who} has reached your address.`;
      if (booking.collector?.journey === "ON_THE_WAY")
        return `${who} is on the way to you.`;
      return `${who} will come to your home at the booked time.`;
    case "SAMPLE_COLLECTED":
      return "Your sample has been collected and is on its way to the lab. We will tell you when the report is ready.";
    case "PROCESSING":
      return "The lab is testing your sample. We will tell you when the report is ready.";
    case "REPORT_READY":
      return booking.forEligibility
        ? "Your report is ready and is in Reports. Your doctor reviews it next."
        : "Your report is ready. A copy is in Reports.";
    default:
      return null;
  }
}

/** Still to happen or under way: everything but a ready report, a cancellation or an unpaid hold. */
export const isOngoing = (booking: LabBooking) =>
  !["REPORT_READY", "CANCELLED", "EXPIRED"].includes(booking.status);

/** "Tomorrow, 7 am to 8 am" or "Thursday 3 Oct, 7 am to 8 am" */
export function collectionWindow(booking: LabBooking) {
  const start = new Date(booking.collectionStartsAt);
  const day = spokenDay(start);
  const end = booking.collectionEndsAt
    ? ` to ${clockTime(new Date(booking.collectionEndsAt))}`
    : "";
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${clockTime(start)}${end}`;
}

/** The checkout for a held booking; it comes back to the booking's page once paid. */
export const labCheckoutHref = (booking: LabBooking) =>
  checkoutHref({
    purpose: "LAB_BOOKING",
    referenceId: booking.id,
    returnTo: `/patient-dashboard/lab-tests/${booking.id}`,
  });
