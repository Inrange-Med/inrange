/*
  What a consultation's state says, in words, and the one thing to press (doctor portal v2 PRD, "Today").
  Today, History and the consultation page all read these, so a state never reads two ways.
*/

import { clockTime, relativeDayName, shortDate } from "@/lib/format/dateTime";
import type { ConsultationRow, ConsultationState } from "@/types/consultation";

/** "Today 7 pm", "Yesterday 6:30 pm", "Sun 15 Nov 5 pm" */
export function whenWords(iso: string, now = Date.now()) {
  const day = relativeDayName(iso);
  const yesterday =
    new Date(iso).getTime() < now &&
    relativeDayName(new Date(new Date(iso).getTime() + 86_400_000).toISOString()) === "Today";
  const name = yesterday
    ? "Yesterday"
    : day === "Today" || day === "Tomorrow"
      ? day
      : `${day} ${shortDate(iso)}`;
  return `${name} ${clockTime(new Date(iso))}`;
}

/** "Sent 7:42 pm", or with its day when it was not today. */
export function sentWords(iso: string) {
  const day = relativeDayName(iso);
  return `Sent ${day === "Today" ? "" : `${shortDate(iso)}, `}${clockTime(new Date(iso))}`;
}

const sexLetter = (sex: string) => (/^f/i.test(sex) ? "F" : /^m/i.test(sex) ? "M" : "");

/** "34 F, first consultation" */
export function factsLine(row: Pick<ConsultationRow, "age" | "sex" | "visitType">) {
  const who = [row.age, sexLetter(row.sex)].filter(Boolean).join(" ");
  const visit = row.visitType === "FOLLOW_UP" ? "follow-up" : "first consultation";
  return who ? `${who}, ${visit}` : visit.charAt(0).toUpperCase() + visit.slice(1);
}

/** The status, one sentence. */
export function statusWords(row: ConsultationRow): string {
  switch (row.state) {
    case "UPCOMING":
      return `Starts at ${clockTime(new Date(row.startsAt))}`;
    case "CALL_OPEN":
      return "The call is open";
    case "TO_WRITE":
      return row.revising ? "New version not sent yet" : "Prescription not written yet";
    case "TO_SEND":
      return row.revising ? "New version not sent yet" : "Not sent to patient yet";
    case "SENT":
      return row.sentAt ? sentWords(row.sentAt) : "Sent";
    case "NO_CALL":
      return "No one joined the call";
    case "CANCELLED":
      return "Cancelled";
  }
}

export type RowAction = "OPEN" | "JOIN" | "WRITE" | "SEND" | "VIEW_PDF" | null;

/** The one button a state gets. */
export const ACTION_OF: Record<ConsultationState, RowAction> = {
  UPCOMING: "OPEN",
  CALL_OPEN: "JOIN",
  TO_WRITE: "WRITE",
  TO_SEND: "SEND",
  SENT: "VIEW_PDF",
  NO_CALL: "WRITE",
  CANCELLED: null,
};

export const ACTION_LABEL: Record<Exclude<RowAction, null>, string> = {
  OPEN: "Open",
  JOIN: "Join video call",
  WRITE: "Write prescription",
  SEND: "Send to patient",
  VIEW_PDF: "View PDF",
};

export const consultationHref = (id: string) => `/doctor-dashboard/consultations/${id}`;
