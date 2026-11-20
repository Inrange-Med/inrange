/** The medicine queue's words, said once: kinds, outcomes, statuses and due times. */

import { clockTime, relativeDayName, shortDate } from "@/lib/format/dateTime";
import type {
  MessageStatus,
  OpsOrder,
  TaskKind,
  TaskOutcome,
} from "@/types/medicineOps";

export const KIND_WORDS: Record<TaskKind, string> = {
  NO_REPLY: "No reply",
  QUESTIONS: "Questions",
  PLAN_CALL: "Plan patient, not ordered",
  PAYMENT_FAILED: "Payment failed",
  DISPATCH_DUE: "Dispatch overdue",
  DELIVERY_LATE: "Delivery late",
  DELIVERY_ISSUE: "Delivery problem",
  RENEWAL: "Review before next supply",
  REFILL_GAP: "Ran out",
  ADHERENCE: "Doses",
  RECONCILE: "Payment check",
  MATCH_MEDICINE: "Match a medicine",
  LAB_ADD_ON: "Add a test to a lab booking",
};

/** Tasks about an order the patient has not paid for: the call can end in these. */
export const CART_KINDS: TaskKind[] = [
  "NO_REPLY",
  "QUESTIONS",
  "PLAN_CALL",
  "PAYMENT_FAILED",
];

export const OUTCOME_WORDS: Record<TaskOutcome, string> = {
  WILL_PAY: "Will order in the app",
  PAID: "Has paid",
  ELSEWHERE: "Bought them elsewhere",
  DECLINED: "Does not want them",
  RESOLVED: "Sorted",
  CALL_BACK: "Call back later",
  NO_ANSWER: "No answer",
};

export const outcomesFor = (kind: TaskKind): TaskOutcome[] =>
  CART_KINDS.includes(kind)
    ? [
        "WILL_PAY",
        "ELSEWHERE",
        "DECLINED",
        "RESOLVED",
        "CALL_BACK",
        "NO_ANSWER",
      ]
    : ["RESOLVED", "CALL_BACK", "NO_ANSWER"];

export const ORDER_WORDS: Record<OpsOrder["status"], string> = {
  PLACED: "To pack",
  PACKED: "Packed",
  DISPATCHED: "On the way",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/** The one next step for an order, as its button says it. */
export const NEXT_STEP: Partial<
  Record<
    OpsOrder["status"],
    {
      to: "PACKED" | "DISPATCHED" | "OUT_FOR_DELIVERY" | "DELIVERED";
      label: string;
    }
  >
> = {
  PLACED: { to: "PACKED", label: "Mark packed" },
  PACKED: { to: "DISPATCHED", label: "Dispatch" },
  DISPATCHED: { to: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  OUT_FOR_DELIVERY: { to: "DELIVERED", label: "Mark delivered" },
};

/** Every WhatsApp message kind (supabase/functions/api/lib/messages.ts), to patients and to doctors. */
export const MESSAGE_WORDS: Record<string, string> = {
  APPT_BOOKED: "Consultation booked",
  APPT_MOVED: "Consultation moved",
  APPT_REMINDER: "Consultation tomorrow",
  APPT_SOON: "Consultation starting",
  DOCTOR_WAITING: "Doctor in the room",
  CARE_PLAN: "Next steps written up",
  DOCTOR_REPLIED: "Doctor replied",
  LAB_BOOKED: "Blood test booked",
  LAB_TOMORROW: "Blood test tomorrow",
  LAB_CANCELLED: "Blood test cancelled by the lab",
  REPORT_READY: "Report ready",
  REVIEW_APPROVED: "Review done: book",
  REVIEW_NOTE: "Review done: note",
  PAYMENT_FAILED: "Payment failed",
  RX_READY: "Prescription",
  CHECK_IN: "Prescription check-in",
  CARE_LINK: "App link after a call",
  SUPPLY_LOW: "Supply running low",
  RENEWAL_DUE: "Review before next supply",
  DOSE_REMINDER: "Dose reminder",
  ORDER_CONFIRMED: "Order confirmed",
  ORDER_PACKED: "Packed",
  ORDER_DISPATCHED: "Dispatched",
  ORDER_OUT_FOR_DELIVERY: "Out for delivery",
  ORDER_DELIVERED: "Delivered",
  ORDER_FEEDBACK: "Delivery feedback",
  ORDER_DELAYED: "New delivery date",
  ORDER_CANCELLED: "Cancelled, refunded",
  DR_BOOKED: "Doctor: new booking",
  DR_MOVED: "Doctor: booking moved",
  DR_SOON: "Doctor: call starting",
  DR_PATIENT_WAITING: "Doctor: patient waiting",
  DR_NOTE_TO_SIGN: "Doctor: note to sign",
  DR_PATIENT_MESSAGE: "Doctor: patient wrote",
  REPLY: "Reply",
};

/** The quick replies a message carries, to play while WhatsApp is in test mode. */
export const REPLIES_FOR: Record<string, { code: string; label: string }[]> = {
  CHECK_IN: [
    { code: "CLEAR", label: "All clear" },
    { code: "QUESTIONS", label: "I have questions" },
    { code: "LATER", label: "Remind me later" },
    { code: "ELSEWHERE", label: "I have them already" },
  ],
  ORDER_FEEDBACK: [
    { code: "GOOD", label: "All good" },
    { code: "ISSUE", label: "Something is wrong" },
  ],
  SUPPLY_LOW: [{ code: "ENOUGH", label: "I have enough" }],
  DOSE_REMINDER: [
    { code: "TAKEN", label: "Taken" },
    { code: "SNOOZE", label: "Remind me in 1 hour" },
    { code: "SKIP", label: "Skip this one" },
  ],
};

/** What a patient's tap said, in the button's own words. */
export const ACTION_WORDS: Record<string, string> = {
  ...Object.fromEntries(
    Object.values(REPLIES_FOR)
      .flat()
      .map((r) => [r.code, r.label]),
  ),
  SKIP_UNWELL: "Skipped: not feeling well",
  SKIP_FORGOT: "Skipped: forgot",
  SKIP_SIDE_EFFECTS: "Skipped: side effects",
  SKIP_OTHER: "Skipped: something else",
};

/** "20:30" as "8:30 pm" */
export const clockWords = (hhmm: string) =>
  clockTime(new Date(`2026-01-01T${hhmm}:00+05:30`));

export const STATUS_WORDS: Record<MessageStatus, string> = {
  QUEUED: "Waiting to send",
  SENT: "Sent",
  DELIVERED: "Delivered",
  READ: "Read",
  FAILED: "Not sent",
  SKIPPED: "Not sent",
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "Overdue 2 h", "Due in 40 min", "Due 4:30 pm", "Due tomorrow 10 am", "Due Mon 23 Nov" */
export function dueWords(
  iso: string,
  now: number,
): { text: string; late: boolean } {
  const at = new Date(iso);
  const ms = at.getTime() - now;
  if (ms < 0) {
    const minutes = Math.round(-ms / 6e4);
    const text =
      minutes < 60
        ? `Overdue ${Math.max(1, minutes)} min`
        : minutes < 48 * 60
          ? `Overdue ${Math.round(minutes / 60)} h`
          : `Overdue ${Math.round(minutes / 1440)} days`;
    return { text, late: true };
  }
  if (ms < 60 * 6e4)
    return {
      text: `Due in ${Math.max(1, Math.round(ms / 6e4))} min`,
      late: false,
    };
  const day = relativeDayName(iso);
  if (day === "Today") return { text: `Due ${clockTime(at)}`, late: false };
  if (day === "Tomorrow")
    return { text: `Due tomorrow ${clockTime(at)}`, late: false };
  return { text: `Due ${day} ${shortDate(iso)}`, late: false };
}

/** "14 Nov, 4:30 pm" */
export const when = (iso: string) =>
  `${shortDate(iso)}, ${clockTime(new Date(iso))}`;
