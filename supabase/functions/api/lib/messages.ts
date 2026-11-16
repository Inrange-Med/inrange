// Every message the patient can get on WhatsApp, in one place: the template name Meta approves, the
// wording, the variables and the buttons. docs/backend/medicine-flow.md lists them for submission.
//
// Rules for every line here (they are also the template review notes):
// - No medicine names, molecules, doses or prices. WhatsApp's commerce policy bars selling prescription
//   medicine in a chat, and the app is where those details live. Messages say "your medicines" and link
//   to the app, where the patient pays.
// - Utility templates only (no marketing), in English, short, in the site's plain voice.
// - Quick-reply codes are what the webhook reads back (lib/replies.ts); labels stay within 20 characters.

export type Action =
  | "ORDER" | "ELSEWHERE" | "LATER" | "QUESTIONS"   // the follow-up after a prescription
  | "GOOD" | "ISSUE"                                // after a delivery
  | "ENOUGH"                                        // a refill reminder
  | "TAKEN" | "SNOOZE" | "SKIP"                     // a dose reminder
  | "SKIP_UNWELL" | "SKIP_FORGOT" | "SKIP_SIDE_EFFECTS" | "SKIP_OTHER";

export type Button =
  | { kind: "QUICK"; code: Action; label: string }
  | { kind: "URL"; label: string; path: string };   // a path in the web app; Meta's button is APP_URL + path

export type Template = {
  /** the template's name in WhatsApp Manager */
  name: string;
  /** {{1}}, {{2}} ... in order; `vars` lists what fills each */
  body: string;
  vars: string[];
  buttons?: Button[];
  /** the prescription PDF as the header */
  document?: boolean;
  /** check-ins and reminders wait for daytime (9 am to 9 pm India time); order updates go when they happen */
  daytime?: boolean;
};

const CART = "/patient-dashboard/care/cart/";
const CARE = "/patient-dashboard/care/";

export const TEMPLATES = {
  RX_READY: {
    name: "rx_ready",
    body: "Hi {{1}}, your prescription from {{2}} is ready. It is attached here and in the inrange app.",
    vars: ["first name", "doctor's name"],
    document: true,
    buttons: [{ kind: "URL", label: "Open the app", path: CARE }],
  },
  RX_READY_ORDER: {
    name: "rx_ready_order",
    body: "Hi {{1}}, your prescription from {{2}} is ready. It is attached here and in the inrange app. Your medicines are ready to order, filled in from the prescription.",
    vars: ["first name", "doctor's name"],
    document: true,
    buttons: [{ kind: "URL", label: "Order medicines", path: CART }],
  },
  CHECK_IN_1: {
    name: "medicines_check_in",
    body: "Hi {{1}}, the medicines your doctor prescribed are ready to order whenever you are. How would you like to go ahead?",
    vars: ["first name"],
    daytime: true,
    buttons: [
      { kind: "QUICK", code: "ORDER", label: "Order now" },
      { kind: "QUICK", code: "ELSEWHERE", label: "I have them" },
      { kind: "QUICK", code: "LATER", label: "Need more time" },
    ],
  },
  CHECK_IN_2: {
    name: "medicines_check_in_2",
    body: "Hi {{1}}, checking in about the medicines your doctor prescribed. Your order is filled in and waiting in the app. We are here if anything is unclear.",
    vars: ["first name"],
    daytime: true,
    buttons: [
      { kind: "QUICK", code: "ORDER", label: "Order now" },
      { kind: "QUICK", code: "ELSEWHERE", label: "I have them" },
      { kind: "QUICK", code: "LATER", label: "Need more time" },
      { kind: "QUICK", code: "QUESTIONS", label: "I have questions" },
    ],
  },
  PLAN_REMINDER: {
    name: "medicines_reminder",
    body: "Hi {{1}}, your medicines are ready to order in the app, filled in from your prescription.",
    vars: ["first name"],
    daytime: true,
    buttons: [
      { kind: "URL", label: "Order medicines", path: CART },
      { kind: "QUICK", code: "ELSEWHERE", label: "I have them" },
    ],
  },
  ORDER_LINK: {
    name: "medicines_order_link",
    body: "Hi {{1}}, here is your medicines order. It is filled in from your prescription, so paying is one tap.",
    vars: ["first name"],
    buttons: [{ kind: "URL", label: "Order medicines", path: CART }],
  },
  ORDER_CONFIRMED: {
    name: "order_confirmed",
    body: "Hi {{1}}, we have your order {{2}}. We expect it to reach you by {{3}}, and we will message you when it leaves our pharmacy.",
    vars: ["first name", "order number", "expected date"],
    buttons: [{ kind: "URL", label: "See your order", path: CARE }],
  },
  ORDER_PACKED: {
    name: "order_packed",
    body: "Your order {{1}} is packed and sealed, and leaves our pharmacy soon.",
    vars: ["order number"],
  },
  ORDER_DISPATCHED: {
    name: "order_dispatched",
    body: "Your order {{1}} is on its way with {{2}}. Track it here: {{3}}. We expect it by {{4}}.",
    vars: ["order number", "courier", "tracking link", "expected date"],
  },
  ORDER_OUT_FOR_DELIVERY: {
    name: "order_out_for_delivery",
    body: "Your order {{1}} is out for delivery today. Please keep your phone close for the courier.",
    vars: ["order number"],
  },
  ORDER_DELIVERED: {
    name: "order_delivered",
    body: "Your order {{1}} has been delivered. Scan the seal on the pack to check where it came from.",
    vars: ["order number"],
  },
  ORDER_FEEDBACK: {
    name: "order_feedback",
    body: "Did your order {{1}} arrive as it should?",
    vars: ["order number"],
    daytime: true,
    buttons: [
      { kind: "QUICK", code: "GOOD", label: "All good" },
      { kind: "QUICK", code: "ISSUE", label: "Something is wrong" },
    ],
  },
  ORDER_DELAYED: {
    name: "order_delayed",
    body: "Your order {{1}} is running late, sorry. We now expect it by {{2}}. Reply here if you need it sooner and someone from your care team will call.",
    vars: ["order number", "new expected date"],
  },
  ORDER_CANCELLED: {
    name: "order_cancelled",
    body: "Your order {{1}} has been cancelled, and your payment is on its way back to how you paid. Refunds take 5 to 7 working days to show.",
    vars: ["order number"],
  },
  PAYMENT_FAILED: {
    name: "payment_failed",
    body: "Hi {{1}}, your payment for your medicines did not go through. If any amount left your account, your bank returns it. You can try again in the app.",
    vars: ["first name"],
    buttons: [{ kind: "URL", label: "Try again", path: CART }],
  },
  REFILL_DUE: {
    name: "refill_due",
    body: "Hi {{1}}, your medicines last until about {{2}}. Order your next supply now so there is no gap.",
    vars: ["first name", "run-out date"],
    daytime: true,
    buttons: [
      { kind: "URL", label: "Order medicines", path: CART },
      { kind: "QUICK", code: "ENOUGH", label: "I have enough" },
    ],
  },
  RENEWAL_DUE: {
    name: "renewal_due",
    body: "Hi {{1}}, your medicines last until about {{2}}. Your doctor reviews your prescription before the next supply, and your care team will call to set it up.",
    vars: ["first name", "run-out date"],
    daytime: true,
  },
  DOSE_REMINDER: {
    name: "dose_reminder",
    body: "Hi {{1}}, it is time for your dose. Tap below once it is done.",
    vars: ["first name"],
    buttons: [
      { kind: "QUICK", code: "TAKEN", label: "Taken" },
      { kind: "QUICK", code: "SNOOZE", label: "Remind me in 1 hour" },
      { kind: "QUICK", code: "SKIP", label: "Skip this one" },
    ],
  },
} satisfies Record<string, Template>;

export type MessageKind = keyof typeof TEMPLATES;

/** Replies sent inside WhatsApp's 24-hour window after the patient taps (plain session messages, no template). */
export const ACKS = {
  ELSEWHERE: "Thanks for letting us know. We will not remind you about this order again. Your care team is here if you need anything.",
  LATER: "No rush. We will check in again tomorrow.",
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
} as const;

/** The skip reasons, offered as a list after "Skip this one". */
export const SKIP_REASONS: { code: Action; label: string; reason: "UNWELL" | "FORGOT" | "SIDE_EFFECTS" | "OTHER" }[] = [
  { code: "SKIP_UNWELL", label: "Not feeling well", reason: "UNWELL" },
  { code: "SKIP_FORGOT", label: "Forgot", reason: "FORGOT" },
  { code: "SKIP_SIDE_EFFECTS", label: "Side effects", reason: "SIDE_EFFECTS" },
  { code: "SKIP_OTHER", label: "Something else", reason: "OTHER" },
];

/** {{1}}, {{2}} ... filled from `values`, for the mock log, the admin timeline and checks. */
export const fill = (text: string, values: string[]) => text.replace(/\{\{(\d+)\}\}/g, (_m, n) => values[Number(n) - 1] ?? "");

if (import.meta.main) {
  // deno run lib/messages.ts: every template is well formed, within WhatsApp's limits, and free of medicine words
  const assert = (ok: boolean, what: string) => { if (!ok) throw new Error(what); };
  const banned = /mounjaro|wegovy|ozempic|tirzepatide|semaglutide|glp|injection|pen\b|dose of|mg\b|₹|rs\.?\s?\d/i;
  const names = new Set<string>();
  for (const [kind, t] of Object.entries(TEMPLATES) as [string, Template][]) {
    const count = (t.body.match(/\{\{\d+\}\}/g) ?? []).length;
    assert(count === t.vars.length, `${kind}: ${count} variables, ${t.vars.length} described`);
    assert(/^[a-z0-9_]{1,512}$/.test(t.name) && !names.has(t.name), `${kind}: template name`);
    names.add(t.name);
    assert(t.body.length <= 1024, `${kind}: body over 1,024 characters`);
    assert(!banned.test(t.body), `${kind}: names a medicine or a price`);
    assert(!/[—–]/.test(t.body), `${kind}: dash`);
    for (const b of t.buttons ?? []) assert(b.label.length <= 20, `${kind}: button "${b.label}" over 20 characters`);
    assert((t.buttons ?? []).length <= 10, `${kind}: too many buttons`);
  }
  for (const [k, line] of Object.entries(ACKS)) assert(!banned.test(line) && !/[—–]/.test(line), `ack ${k}`);
  assert(fill("{{1}} and {{2}}", ["a", "b"]) === "a and b", "fill");
  console.log(`messages ok: ${names.size} templates`);
}
