// Every message anyone can get from inrange on WhatsApp, in one place: the template name, the wording,
// the variables with sample values, the buttons and the deep link each button opens. The templates are
// submitted to Meta from this file (POST /admin/whatsapp/templates/sync), so what is approved is what the
// code sends. docs/backend/whatsapp.md lists them.
//
// Rules for every line here (Meta's utility rules and its Business Messaging Policy; also the review notes):
// - Utility only: each message is about something the person already has (a booking, an order, a report,
//   a prescription) or asked for. No persuasion and no purchase prompts: prescription medicine is a
//   Regulated Vertical, so ordering happens in the app and never in the chat.
// - No medicine names, molecules, doses, diagnoses, lab values or prices. "Your prescription", "your
//   report", "your consultation", and a button into the signed-in app, which is where those live.
// - A variable never starts or ends the body, and parameters carry no newlines (lib/notify.ts cleans them).
// - Deep links: our own domain, the fixed path in the template, one id appended ({{1}}), never a token.
// - Quick replies come before URL buttons (Meta wants them grouped); labels stay within 20 characters.

export type Action =
  | "CLEAR" | "ELSEWHERE" | "LATER" | "QUESTIONS"   // the check-in after a prescription
  | "GOOD" | "ISSUE"                                // after a delivery
  | "ENOUGH"                                        // the supply alert
  | "TAKEN" | "SNOOZE" | "SKIP"                     // a dose reminder
  | "SKIP_UNWELL" | "SKIP_FORGOT" | "SKIP_SIDE_EFFECTS" | "SKIP_OTHER";

export type Button =
  | { kind: "QUICK"; code: Action; label: string }
  /** a page in the web app: APP_URL + path, plus the message's link id when `dynamic` */
  | { kind: "URL"; label: string; path: string; dynamic?: boolean };

export type Template = {
  /** the template's name at Meta */
  name: string;
  /** {{1}}, {{2}} ... in order */
  body: string;
  /** a sample for each variable, in order (Meta needs one per variable to review the template) */
  examples: string[];
  buttons?: Button[];
  /** waits for daytime (9 am to 9 pm India time); updates the person is waiting on go at once */
  daytime?: boolean;
  /** a reminder the patient can turn off (Profile, Enable reminders); confirmations and changes still go */
  reminder?: boolean;
  /** seconds Meta keeps trying before dropping it (30 s to 12 h): a late reminder is worse than none */
  ttl?: number;
};

const CARE = "/patient-dashboard/care";
const CONSULT = "/consultation/";
/** the doctor's consultation page (doctor portal v2): reports, the prescription, and Join, which opens the call in a new tab */
const DR_CONSULT = "/doctor-dashboard/consultations/";
const RX = "/patient-dashboard/prescriptions";
const HOUR = 3600;

export const TEMPLATES = {
  // ---------------------------------------------------------------- consultations (patient)
  APPT_BOOKED: {
    name: "appointment_booked",
    body: "Hi {{1}}, your video consultation with {{2}} is booked for {{3}}. You can join from the inrange app at that time.",
    examples: ["Asha", "Dr. Govind Singh", "Wed, 18 Nov, 10:30 am"],
    buttons: [{ kind: "URL", label: "See the booking", path: CONSULT, dynamic: true }],
  },
  APPT_MOVED: {
    name: "appointment_moved",
    body: "Hi {{1}}, your video consultation with {{2}} has moved to {{3}}. The link to join stays the same.",
    examples: ["Asha", "Dr. Govind Singh", "Thu, 19 Nov, 4:00 pm"],
    buttons: [{ kind: "URL", label: "See the booking", path: CONSULT, dynamic: true }],
  },
  APPT_REMINDER: {
    name: "appointment_reminder",
    body: "Hi {{1}}, a reminder that your video consultation with {{2}} is on {{3}}. You join from the inrange app.",
    examples: ["Asha", "Dr. Govind Singh", "Wed, 18 Nov, 10:30 am"],
    buttons: [{ kind: "URL", label: "See the booking", path: CONSULT, dynamic: true }],
    daytime: true, reminder: true, ttl: 6 * HOUR,
  },
  APPT_SOON: {
    name: "appointment_starting",
    body: "Hi {{1}}, your video consultation with {{2}} starts at {{3}}. Join a few minutes early from a quiet place.",
    examples: ["Asha", "Dr. Govind Singh", "10:30 am"],
    buttons: [{ kind: "URL", label: "Join the call", path: CONSULT, dynamic: true }],
    reminder: true, ttl: HOUR,
  },
  DOCTOR_WAITING: {
    name: "doctor_waiting",
    body: "Hi {{1}}, {{2}} is ready for your video consultation. Tap below to join the call.",
    examples: ["Asha", "Dr. Govind Singh"],
    buttons: [{ kind: "URL", label: "Join the call", path: CONSULT, dynamic: true }],
    ttl: HOUR,
  },
  CARE_PLAN: {
    name: "care_plan_ready",
    body: "Hi {{1}}, {{2}} has written up your next steps after your consultation. You can read them in the inrange app.",
    examples: ["Asha", "Dr. Govind Singh"],
    buttons: [{ kind: "URL", label: "Read them", path: "/patient-dashboard/plans" }],
  },
  DOCTOR_REPLIED: {
    name: "doctor_replied",
    body: "Hi {{1}}, {{2}} has replied to your message in the inrange app.",
    examples: ["Asha", "Dr. Govind Singh"],
    buttons: [{ kind: "URL", label: "Read the reply", path: "/patient-dashboard/messages/", dynamic: true }],
  },

  // ---------------------------------------------------------------- blood tests and the review (patient)
  LAB_BOOKED: {
    name: "blood_test_booked",
    body: "Hi {{1}}, your home blood test is booked for {{2}}. The preparation notes are in the inrange app.",
    examples: ["Asha", "Thu, 19 Nov, 7:00 am to 8:00 am"],
    buttons: [{ kind: "URL", label: "See the booking", path: "/patient-dashboard/lab-tests/", dynamic: true }],
  },
  LAB_TOMORROW: {
    name: "blood_test_tomorrow",
    body: "Hi {{1}}, your home blood test collection is tomorrow, {{2}}. Please read the preparation notes in the inrange app tonight.",
    examples: ["Asha", "7:00 am to 8:00 am"],
    buttons: [{ kind: "URL", label: "See the notes", path: "/patient-dashboard/lab-tests/", dynamic: true }],
    daytime: true, reminder: true, ttl: 12 * HOUR,
  },
  LAB_CANCELLED: {
    name: "blood_test_cancelled",
    body: "Hi {{1}}, the lab has cancelled your home blood test for {{2}}. You can choose a new time in the inrange app.",
    examples: ["Asha", "Thu, 19 Nov"],
    buttons: [{ kind: "URL", label: "Choose a time", path: "/patient-dashboard/lab-tests" }],
  },
  REPORT_READY: {
    name: "blood_test_report_ready",
    body: "Hi {{1}}, your blood test report is ready. You can see it in the inrange app, and your care team sees it too.",
    examples: ["Asha"],
    buttons: [{ kind: "URL", label: "See the report", path: "/patient-dashboard/reports" }],
  },
  REVIEW_APPROVED: {
    name: "review_done_book",
    body: "Hi {{1}}, the medical team has reviewed your blood tests. You can now book your video consultation with a doctor in the inrange app.",
    examples: ["Asha"],
    buttons: [{ kind: "URL", label: "Book a time", path: "/patient-dashboard/appointments/book" }],
  },
  REVIEW_NOTE: {
    name: "review_done_note",
    body: "Hi {{1}}, the medical team has reviewed your report and left you a note in the inrange app.",
    examples: ["Asha"],
    buttons: [{ kind: "URL", label: "See the note", path: "/patient-dashboard/reports" }],
  },
  PAYMENT_FAILED: {
    name: "payment_not_completed",
    body: "Hi {{1}}, your payment for {{2}} did not go through. If any amount left your account, your bank returns it.",
    examples: ["Asha", "your consultation"],
    buttons: [{ kind: "URL", label: "Open the app", path: "/patient-dashboard" }],
  },

  // ---------------------------------------------------------------- the prescription and the follow-up (patient)
  RX_READY: {
    name: "prescription_ready",
    body: "Hi {{1}}, your prescription from {{2}} is ready. You can see it in the inrange app.",
    examples: ["Asha", "Dr. Govind Singh"],
    buttons: [{ kind: "URL", label: "See the prescription", path: `${RX}?rx=`, dynamic: true }],
  },
  CHECK_IN: {
    name: "prescription_check_in",
    body: "Hi {{1}}, checking in about the prescription from {{2}}. Your doctor's plan is in the inrange app. Is anything unclear?",
    examples: ["Asha", "Dr. Govind Singh"],
    daytime: true, reminder: true,
    buttons: [
      { kind: "QUICK", code: "CLEAR", label: "All clear" },
      { kind: "QUICK", code: "QUESTIONS", label: "I have questions" },
      { kind: "QUICK", code: "LATER", label: "Remind me later" },
      { kind: "QUICK", code: "ELSEWHERE", label: "I have them already" },
      { kind: "URL", label: "See the prescription", path: `${CARE}?rx=`, dynamic: true },
    ],
  },
  CARE_LINK: {
    name: "care_team_link",
    body: "Hi {{1}}, as we discussed on the call, your prescription and what comes next are in the inrange app.",
    examples: ["Asha"],
    buttons: [{ kind: "URL", label: "Open the app", path: `${CARE}/cart` }],
  },
  SUPPLY_LOW: {
    name: "supply_running_low",
    body: "Hi {{1}}, by our records your current supply lasts until about {{2}}. Your next supply is in the inrange app when you need it.",
    examples: ["Asha", "18 Dec"],
    daytime: true, reminder: true,
    buttons: [
      { kind: "QUICK", code: "ENOUGH", label: "I have enough" },
      { kind: "URL", label: "Open the app", path: `${CARE}/cart` },
    ],
  },
  RENEWAL_DUE: {
    name: "prescription_review_due",
    body: "Hi {{1}}, by our records your current supply lasts until about {{2}}. Your doctor reviews your prescription before the next one, and your care team will call to set it up.",
    examples: ["Asha", "18 Dec"],
    daytime: true,
  },
  DOSE_REMINDER: {
    name: "dose_reminder",
    body: "Hi {{1}}, it is time for your dose. Tap below once it is done.",
    examples: ["Asha"],
    reminder: true, ttl: 2 * HOUR,
    buttons: [
      { kind: "QUICK", code: "TAKEN", label: "Taken" },
      { kind: "QUICK", code: "SNOOZE", label: "Remind me in 1 hour" },
      { kind: "QUICK", code: "SKIP", label: "Skip this one" },
    ],
  },

  // ---------------------------------------------------------------- the order (patient; after paying in the app)
  ORDER_CONFIRMED: {
    name: "order_confirmed",
    body: "Hi {{1}}, we have your order {{2}}. We expect it to reach you by {{3}}, and we will message you when it leaves our pharmacy.",
    examples: ["Asha", "MED-00042", "20 Nov"],
    buttons: [{ kind: "URL", label: "See your order", path: `${CARE}?order=`, dynamic: true }],
  },
  ORDER_PACKED: {
    name: "order_packed",
    body: "Your order {{1}} is packed and sealed, and leaves our pharmacy soon.",
    examples: ["MED-00042"],
  },
  ORDER_DISPATCHED: {
    name: "order_dispatched",
    body: "Your order {{1}} is on its way with {{2}}, and we expect it by {{3}}. The tracking details are in the inrange app.",
    examples: ["MED-00042", "Delhivery", "20 Nov"],
    buttons: [{ kind: "URL", label: "Track your order", path: `${CARE}?order=`, dynamic: true }],
  },
  ORDER_OUT_FOR_DELIVERY: {
    name: "order_out_for_delivery",
    body: "Your order {{1}} is out for delivery today. Please keep your phone close for the courier.",
    examples: ["MED-00042"],
  },
  ORDER_DELIVERED: {
    name: "order_delivered",
    body: "Your order {{1}} has been delivered. Scan the seal on the pack to check where it came from.",
    examples: ["MED-00042"],
  },
  ORDER_FEEDBACK: {
    name: "order_feedback",
    body: "Did your order {{1}} arrive as it should?",
    examples: ["MED-00042"],
    daytime: true,
    buttons: [
      { kind: "QUICK", code: "GOOD", label: "All good" },
      { kind: "QUICK", code: "ISSUE", label: "Something is wrong" },
    ],
  },
  ORDER_DELAYED: {
    name: "order_delayed",
    body: "Your order {{1}} is running late, sorry. We now expect it by {{2}}. Reply here if you need it sooner and someone from your care team will call.",
    examples: ["MED-00042", "21 Nov"],
  },
  ORDER_CANCELLED: {
    name: "order_cancelled",
    body: "Your order {{1}} has been cancelled, and your payment is on its way back to how you paid. Refunds take 5 to 7 working days to show.",
    examples: ["MED-00042"],
  },

  // ---------------------------------------------------------------- the doctor's notices (no patient names or health details)
  DR_BOOKED: {
    name: "doctor_new_booking",
    body: "A new {{1}} is booked with you for {{2}}. Open it from the link below.",
    examples: ["first consultation", "Wed, 18 Nov, 10:30 am"],
    buttons: [{ kind: "URL", label: "See the consultation", path: DR_CONSULT, dynamic: true }],
  },
  DR_MOVED: {
    name: "doctor_booking_moved",
    body: "A video consultation with you has moved from {{1}} to {{2}}. The link below stays the same.",
    examples: ["Wed, 18 Nov, 10:30 am", "Thu, 19 Nov, 4:00 pm"],
    buttons: [{ kind: "URL", label: "See the consultation", path: DR_CONSULT, dynamic: true }],
  },
  DR_SOON: {
    name: "doctor_call_starting",
    body: "Your video consultation at {{1}} starts soon. Open it from the link below to see the reports and join.",
    examples: ["10:30 am"],
    buttons: [{ kind: "URL", label: "Open consultation", path: DR_CONSULT, dynamic: true }],
    ttl: HOUR,
  },
  DR_PATIENT_WAITING: {
    name: "doctor_patient_waiting",
    body: "Your patient for the {{1}} consultation has joined and is waiting. Open it from the link below to join.",
    examples: ["10:30 am"],
    buttons: [{ kind: "URL", label: "Open consultation", path: DR_CONSULT, dynamic: true }],
    ttl: HOUR,
  },
  // the prescription not sent an hour after the call (doctor portal v2; the key keeps its old name)
  DR_NOTE_TO_SIGN: {
    name: "doctor_prescription_to_send",
    body: "The prescription for your {{1}} consultation has not reached the patient yet. Finish it and send it from the link below.",
    examples: ["10:30 am"],
    buttons: [{ kind: "URL", label: "Open consultation", path: DR_CONSULT, dynamic: true }],
  },
  DR_PATIENT_MESSAGE: {
    name: "doctor_patient_message",
    body: "A patient has sent you a message in the inrange app. You can read it from the link below.",
    examples: [],
    buttons: [{ kind: "URL", label: "Read the message", path: "/doctor-dashboard/messages?p=", dynamic: true }],
  },
} satisfies Record<string, Template>;

export type MessageKind = keyof typeof TEMPLATES;

/** Replies inside WhatsApp's 24-hour window after the person writes or taps (session messages, no template). */
export const ACKS = {
  CLEAR: "Good to hear. Everything is in the inrange app whenever you need it.",
  ELSEWHERE: "Thanks for letting us know. We will not remind you about this order again. Your care team is here if you need anything.",
  LATER: "No rush. We will check in again tomorrow.",
  LATER_LAST: "No rush. Someone from your care team will call you to see how you are getting on.",
  QUESTIONS: "Thanks. Someone from your care team will call you {{when}}.",
  GOOD: "Thank you for telling us.",
  ISSUE: "Sorry about that. Someone from your care team will call you {{when}}.",
  ENOUGH: "Thanks. We will remind you again closer to the date.",
  TAKEN: "Logged. Thank you.",
  SNOOZE: "We will remind you in an hour.",
  SKIP_REASON: "Thanks. What got in the way?",
  SKIPPED: "Thanks. Your health coach will see this.",
  SIDE_EFFECTS: "Thanks for telling us. Your care team will call you {{when}}. If it feels severe, call 112.",
  STOP: "You will not get WhatsApp messages from inrange any more. You can turn them back on in the app, under Profile.",
  FREE_TEXT: "Thanks for your message. Someone from your care team will reply {{when}}.",
  HANDLED: "Thanks, we have this already.",
} as const;

/** The skip reasons, offered as a list after "Skip this one". */
export const SKIP_REASONS: { code: Action; label: string; reason: "UNWELL" | "FORGOT" | "SIDE_EFFECTS" | "OTHER" }[] = [
  { code: "SKIP_UNWELL", label: "Not feeling well", reason: "UNWELL" },
  { code: "SKIP_FORGOT", label: "Forgot", reason: "FORGOT" },
  { code: "SKIP_SIDE_EFFECTS", label: "Side effects", reason: "SIDE_EFFECTS" },
  { code: "SKIP_OTHER", label: "Something else", reason: "OTHER" },
];

/** {{1}}, {{2}} ... filled from `values`, for the test-mode log, the admin timeline and checks. */
export const fill = (text: string, values: string[]) => text.replace(/\{\{(\d+)\}\}/g, (_m, n) => values[Number(n) - 1] ?? "");

/** Meta's template definition for one of ours (POST /{waba}/message_templates). `appUrl` is the web app's origin. */
export function templateDefinition(t: Template, appUrl: string) {
  const components: Record<string, unknown>[] = [
    { type: "BODY", text: t.body, ...(t.examples.length ? { example: { body_text: [t.examples] } } : {}) },
  ];
  if (t.buttons?.length)
    components.push({
      type: "BUTTONS",
      buttons: t.buttons.map((b) =>
        b.kind === "QUICK" ? { type: "QUICK_REPLY", text: b.label }
        : b.dynamic ? { type: "URL", text: b.label, url: `${appUrl}${b.path}{{1}}`, example: [`${appUrl}${b.path}42`] }
        : { type: "URL", text: b.label, url: `${appUrl}${b.path}` }),
    });
  return {
    name: t.name, language: "en", category: "UTILITY", components,
    ...(t.ttl ? { message_send_ttl_seconds: t.ttl } : {}),
  };
}

if (import.meta.main) {
  // deno run lib/messages.ts: every template is well formed, within WhatsApp's limits, and free of health details
  const assert = (ok: boolean, what: string) => { if (!ok) throw new Error(what); };
  const banned = /mounjaro|wegovy|ozempic|tirzepatide|semaglutide|glp|injection|\bpen\b|dose of|mg\b|₹|rs\.?\s?\d|order now|buy\b|discount|offer/i;
  const names = new Set<string>();
  for (const [kind, t] of Object.entries(TEMPLATES) as [string, Template][]) {
    const count = (t.body.match(/\{\{\d+\}\}/g) ?? []).length;
    assert(count === t.examples.length, `${kind}: ${count} variables, ${t.examples.length} samples`);
    assert(!/^\s*\{\{/.test(t.body) && !/\{\{\d+\}\}[.!]?\s*$/.test(t.body), `${kind}: a variable starts or ends the body`);
    assert(/^[a-z0-9_]{1,512}$/.test(t.name) && !names.has(t.name), `${kind}: template name`);
    names.add(t.name);
    assert(t.body.length <= 1024, `${kind}: body over 1,024 characters`);
    assert(!banned.test(t.body), `${kind}: names a medicine, a price or a purchase prompt`);
    assert(!/[—–]/.test(t.body), `${kind}: dash`);
    const buttons = t.buttons ?? [];
    for (const b of buttons) assert(b.label.length <= 20, `${kind}: button "${b.label}" over 20 characters`);
    assert(buttons.length <= 10 && buttons.filter((b) => b.kind === "URL").length <= 2, `${kind}: too many buttons`);
    const firstUrl = buttons.findIndex((b) => b.kind === "URL");
    assert(firstUrl === -1 || buttons.slice(firstUrl).every((b) => b.kind === "URL"), `${kind}: quick replies must come before URL buttons`);
    assert(!t.ttl || (t.ttl >= 30 && t.ttl <= 12 * HOUR), `${kind}: ttl`);
  }
  for (const [k, line] of Object.entries(ACKS)) assert(!banned.test(line) && !/[—–]/.test(line), `ack ${k}`);
  assert(fill("{{1}} and {{2}}", ["a", "b"]) === "a and b", "fill");
  const def = templateDefinition(TEMPLATES.RX_READY, "https://inrangemed.com");
  assert(JSON.stringify(def).includes("https://inrangemed.com/patient-dashboard/prescriptions?rx={{1}}"), "dynamic url");
  console.log(`messages ok: ${names.size} templates`);
}
