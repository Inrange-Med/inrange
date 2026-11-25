/** The words the sales screens share: where a lead stands, and how a call went. */

import { clockTime, relativeDayName, shortDate } from "@/lib/format/dateTime";
import type { CallStatus, Lead, LeadStage } from "@/types/sales";

export const STAGE_WORDS: Record<LeadStage, string> = {
  NEW: "Signed up, not paid",
  PAID: "Paid, blood test to book",
  TEST_BOOKED: "Blood test booked",
  REPORT_IN: "Report in, consultation to book",
  CONSULT_BOOKED: "Consultation booked",
  CONSULTED: "Consultation done, no plan yet",
  LINK_SENT: "Payment link sent",
  ON_PLAN: "On a plan",
};

export const CALL_WORDS: Record<CallStatus, string> = {
  SPOKE: "Spoke",
  NO_ANSWER: "No answer",
  CALL_BACK: "Call back",
  INTERESTED: "Interested",
  NOT_INTERESTED: "Not interested",
};

/** "Today, 5:30 pm", "Tomorrow, 9 am", "Thu 26 Nov, 5:30 pm" */
export function callWhen(iso: string) {
  const day = relativeDayName(iso);
  return `${day === "Today" || day === "Tomorrow" ? day : `${day} ${shortDate(iso)}`}, ${clockTime(new Date(iso))}`;
}

const todayIso = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );

/** A day to call again that has come. */
export const followUpDue = (lead: Lead) =>
  Boolean(lead.followUpOn && lead.followUpOn <= todayIso());

/** The lists a salesperson works from. */
export const VIEWS = [
  { value: "todo", label: "To do" },
  { value: "calls", label: "Calls" },
  { value: "close", label: "To close" },
  { value: "plan", label: "On a plan" },
  { value: "all", label: "All" },
] as const;
export type View = (typeof VIEWS)[number]["value"];

export function inView(lead: Lead, view: View) {
  if (view === "all") return true;
  if (view === "calls") return Boolean(lead.nextCallAt);
  if (view === "close")
    return lead.stage === "CONSULTED" || lead.stage === "LINK_SENT";
  if (view === "plan") return lead.stage === "ON_PLAN";
  // to do: a follow-up that is due, a call today or tomorrow, a sale to close, a sales form to fill in
  return (
    followUpDue(lead) ||
    lead.formDue ||
    lead.stage === "CONSULTED" ||
    lead.stage === "LINK_SENT" ||
    Boolean(
      lead.nextCallAt &&
        ["Today", "Tomorrow"].includes(relativeDayName(lead.nextCallAt)),
    )
  );
}
