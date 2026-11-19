# The medicine flow after a prescription

## Purpose

Everything that happens between a doctor signing a prescription and the patient taking their medicine:
the prescription on WhatsApp, the follow-up until the patient orders, the medicine queue the care team
works from, delivery milestones and feedback, refills and renewals, dose reminders and adherence, and
the health coach. It implements the shared medicine flow PRD ([medicine-flow-prd.md](medicine-flow-prd.md)
maps it); the cart, prices and the prescription PDF it builds on are in [medicine-cart.md](medicine-cart.md).

- Screens: Care (Your programme, Your doses, the delivery sheet), Your medicines (`/patient-dashboard/care/cart`),
  onboarding consent and the free check (the WhatsApp tick), Profile (Updates on WhatsApp), and the
  admin area's Medicine (`/admin/medicine`) for the care team and health coaches.
- Services: `carePlanService` (patient), `medicineOpsService` (admin and coach). Types: `types/carePlan.ts`,
  `types/medicineOps.ts`.
- Backend: `lib/medicineFlow.ts` (the steps), `lib/notify.ts` (the message queue), `lib/messages.ts` (every
  template), `lib/replies.ts` (what a tap does), `lib/hours.ts` (daytime and working hours),
  `integrations/whatsapp.ts` (Meta Cloud API), `routes/jobs.ts` (the tick, the WhatsApp webhook, the nightly
  reconciliation), `routes/medicines.ts` (patient), `routes/ops.ts` (the medicine queue). Schema:
  `migrations/20261117000100_medicine_flow.sql`.
- Tests: `supabase/tests/medicine_flow_journey.py` (102 checks, every path below), runnable on a laptop with
  `supabase/tests/local/run.sh`.

## How it works

Names: the **nano plan** is a first consultation without a plan (the PRD's ₹1799 plan); a **plan
patient** has an active subscription (the PRD's Program).

| When | Nano plan | Plan patient |
| --- | --- | --- |
| Signing | Prescription on WhatsApp, a button that opens it in the app. The order is ready at once in the app | The same |
| +24 h after signing | Check-in 1: All clear / I have questions / Remind me later / I have them already | Check-in: the same buttons |
| +24 h | Check-in 2: the same | Call task, critical, due in 2 working hours |
| +24 h | Call task, due within a working day | |
| Paying | Follow-up closes, call and payment tasks close, order confirmed on WhatsApp | The same |

Every order is payable the moment the prescription is sent, plan or not (19 Nov 2026: no waiting, no
friction; this replaces the 12 Nov call's 48-hour hold for patients without a plan). The nano plan keeps the
PRD's two check-ins and call: T+24 / T+48 / T+72.

- **Before every automated message** the step re-reads the state (PRD 7.2 BR1): a paid order, a newer
  prescription, "I have them", or an ended prescription closes the follow-up instead. A nano patient who
  buys a plan mid-way moves to the plan rhythm and the order opens at once (PRD 7.2 EC4).
- **No ordering in the chat.** Prescription medicine is a Regulated Vertical in WhatsApp's Business
  Messaging Policy: the check-ins are care follow-ups with no purchase button, and the patient orders and
  pays in the app ([whatsapp.md](whatsapp.md), "The rules every template follows").
- **Remind me later** pushes the next check-in a day, up to four check-ins in all, then the team calls.
- **All clear** is acknowledged; the rhythm carries on.
- **Order now instead** (the app only): on a held nano order it opens the order early, because the
  patient asked (decision on PRD conflict 1, below).
- **I have questions**: a high-priority call back due in 2 working hours; the reply says when ("within 2
  hours", "by 11:30 am tomorrow").
- **Free text** on WhatsApp goes to the team as a call back (one task and one acknowledgement a day).
  **STOP** revokes the WhatsApp consent and says how to turn it back on.
- The agent who calls guides the patient to pay themselves and never places the order for them (12 Nov call).

### Deliveries (we are the pharmacy)

Steps: `PLACED` (paid) → `PACKED` → `DISPATCHED` (needs the courier and a tracking link or number) →
`OUT_FOR_DELIVERY` → `DELIVERED`, or `CANCELLED` (a full refund). Never backwards; a step may be skipped
(packed and dispatched together) and still gets its time. Each step messages the patient once.

- **Dispatch target**: 24 hours after payment for plan patients, 48 for the nano plan. Past it, a task
  (critical for plan patients). CONFIRM the targets with operations.
- **Late**: 6 hours past the expected date while on the way, a task; the team gives a new date, and the
  patient hears it (once per date) with an apology.
- **Feedback**: 2 hours after delivery, "Did it arrive as it should?" (All good / Something is wrong). A
  problem is a critical task due within a working hour. Answered in the app, the WhatsApp question is
  not sent. The app asks for two weeks after delivery.
- **Cancel and refund**: the refund is started with Razorpay first; only then is the order cancelled, the
  patient told, and its upcoming dose reminders removed. If Razorpay refuses, nothing changes.
- **A failed payment** (Razorpay `payment.failed` on a medicines order): the patient hears how to try
  again, and a task checks in if it stays unpaid. Paying later closes it.

### Refills and renewals

A delivered order lasts `supply_days`: its shortest line, quantity × the pack's days (Wegovy and
Mounjaro packs are 28 days). A week before it runs out (daily job):

- **The prescription still covers more** (valid past the run-out date, packs left): a refill order opens
  on the same prescription, filled in with what is left, payable at once; the patient gets "Order
  medicines" and "I have enough". If not ordered within 2 days, the team calls (still before it runs out).
  "I have enough" reminds once more two days before.
- **It does not** (a one-month nano prescription, or everything bought): the doctor reviews first (PRD
  7.7 BR4). The patient is told the team will call, and a task asks the team to book the review.
- **A day after running out with nothing new on the way**: a high-priority task, and dose reminders stop
  (no reminders for doses there is no supply for).

### Doses and adherence (plan patients)

On delivery, one dose schedule per medicine whose frequency we can remind on (weekly, daily, twice a
day; "as needed" has none), from the delivery day to the run-out day, at 9 am India time (weekly: on the
delivery's weekday). A later delivery of the same medicine carries the patient's day and time over.

- The reminder comes on WhatsApp (Taken / Remind me in 1 hour / Skip this one) and in the app (Your
  doses: Taken / Skip this one). Skip asks why: not feeling well, forgot, side effects, something else.
- Two snoozes at most. A dose not logged 2 hours after its time (plus an hour per snooze) is missed;
  logged later it is "taken late".
- **The coach is told** (an adherence task, at most one a week per patient) when, over 7 days, two or more
  doses were skipped or missed; when the last three were missed; or when under 70% were taken over 4
  weeks. **Side effects** open a high-priority task at once ("call today and tell the doctor"), and the
  reply says when the team calls and to call 112 if it is severe.
- The patient changes the day and time in the app, or pauses reminders. Upcoming doses follow at once;
  logged ones never change.

### The health coach

A `COACH` user (added by an admin in Medicine, Patients, Health coaches) signs in with their mobile and
lands on `/admin/medicine`, seeing Queue and Patients for **their own patients only** (the API scopes
every query; another coach's patient is a 404). Adherence and ran-out tasks go to the patient's coach;
changing the coach moves the open ones. Coaches cannot run the pharmacy, refund, see messages for other
patients, or the numbers. Every look at a patient's medicines is written to `audit_log`.

## Endpoints

| Method | Path | Status | Service | Used for |
| --- | --- | --- | --- | --- |
| POST | `/api/jobs/tick` | LIVE, `x-jobs-secret` | (Supabase cron) | Every 5 minutes: follow-ups, order checks, doses, the daily refills and reconciliation, the message queue |
| GET | `/api/webhooks/whatsapp` | LIVE | (Meta) | The webhook's one-time verification |
| POST | `/api/webhooks/whatsapp` | LIVE, signed | (Meta) | Taps, picks, text, delivery statuses |
| GET | `/api/care/medicine-orders` | LIVE, extended | `loadCarePlan` | Adds `orderNumber`, `courier`, `dispatchedAt`, `deliveredAt`, `runOutOn`, `feedback`, `canGiveFeedback`, `cancelReason`, `refundedPaise`; statuses `OUT_FOR_DELIVERY`, `CANCELLED` |
| GET | `/api/care/cart` | LIVE, extended | `getCart` | Adds `kind` (`FIRST` or `REFILL`) and `boughtElsewhere` |
| POST | `/api/care/cart/elsewhere` | LIVE | `boughtElsewhere` | No more reminders about this order |
| POST | `/api/care/medicine-orders/:id/feedback` | LIVE | `rateDelivery` | `{ rating: GOOD \| ISSUE, note? }` |
| GET | `/api/care/doses` | LIVE | `getDoses` | Schedules and the last 35 days of doses |
| PATCH | `/api/care/doses/:scheduleId` | LIVE | `updateDoseReminder` | `{ weekday?, time?, paused? }` |
| POST | `/api/care/doses/events/:id` | LIVE | `logDose` | `{ status: TAKEN \| SKIPPED, reason? }` |
| PATCH | `/api/patient/reminders` | LIVE, extended | `updateReminderSettings` | `whatsappReminders` now records or revokes the WHATSAPP consent |
| GET | `/api/admin/medicine/summary` | LIVE, admin or coach | `getSummary` | Counts, WhatsApp live or test, last tick |
| GET | `/api/admin/medicine/tasks?status=` | LIVE, admin or coach | `listTasks` | The queue, soonest due first |
| POST | `/api/admin/medicine/tasks/:id/done` | LIVE, admin or coach | `finishTask` | `{ outcome, note, callBackAt? }`; a note is required |
| POST | `/api/admin/medicine/tasks/:id/assign` | LIVE, admin or coach | `assignTask` | `{ to: "me" \| userId \| null }` (others: admin) |
| POST | `/api/admin/medicine/tasks/:id/send-link` | LIVE, admin or coach | `sendOrderLink` | The order link on WhatsApp, three times at most |
| GET | `/api/admin/medicine/patients?q=` | LIVE, admin or coach | `listPatients` | Patients with a prescription or an order |
| GET | `/api/admin/medicine/patients/:id` | LIVE, admin or coach | `getPatient` | One patient's medicines, messages, replies, tasks, doses (logged) |
| PATCH | `/api/admin/medicine/patients/:id/coach` | LIVE, admin | `setCoach` | `{ coachId \| null }` |
| GET | `/api/admin/medicine/orders` | LIVE, admin | `listOrders` | Deliveries by step, with the dispatch-by time |
| POST | `/api/admin/medicine/orders/:id/move` | LIVE, admin | `moveOrder` | `{ to, courier?, trackingNo?, trackingUrl?, expectedAt?, note? }` |
| POST | `/api/admin/medicine/orders/:id/delay` | LIVE, admin | `delayOrder` | `{ expectedAt }` |
| POST | `/api/admin/medicine/orders/:id/cancel` | LIVE, admin | `cancelOrder` | `{ reason }`: a full refund |
| GET | `/api/admin/medicine/messages` | LIVE, admin or coach | `listMessages` | Every message, sent or not and why |
| POST | `/api/admin/medicine/messages/:id/reply` | LIVE, admin, test mode only | `playReply` | `{ code?, text? }`: plays the patient's reply |
| GET | `/api/admin/medicine/numbers?days=` | LIVE, admin | `getNumbers` | The PRD's measures |
| GET, POST | `/api/admin/coaches` | LIVE, admin | `listCoaches`, `addCoach` | `{ fullName, mobile }` |

## Requests and responses

```jsonc
// GET /api/care/medicine-orders -> data[0]
{ "id": "7", "orderNumber": "MED-00007", "status": "DISPATCHED", "placedAt": "2026-11-17T10:02:11+05:30",
  "expectedAt": "2026-11-19T19:00:00+05:30", "dispatchedAt": "2026-11-17T16:40:00+05:30", "deliveredAt": null,
  "courier": "Delhivery", "trackingNo": null, "trackingUrl": "https://www.delhivery.com/track/package/123",
  "items": [{ "name": "Wegovy FlexTouch 0.25 mg", "quantity": "1 x pen (4 weekly doses)" }],
  "history": [{ "status": "PLACED", "at": "...", "note": "Order received by the pharmacy" }],
  "feedback": null, "canGiveFeedback": false, "runOutOn": null, "cancelReason": null, "refundedPaise": null }

// POST /api/care/medicine-orders/7/feedback { "rating": "ISSUE", "note": "The seal was broken" }
{ "success": true, "message": "Sorry about that. Someone from your care team will call you within the hour.",
  "data": { "feedback": "ISSUE", "callBy": "2026-11-17T12:10:00.000Z" } }

// GET /api/care/doses
{ "data": { "schedules": [{ "id": "3", "medicine": "Wegovy FlexTouch 0.25 mg", "cadence": "WEEKLY", "weekday": 7,
    "times": ["20:30"], "paused": false, "startsOn": "2026-11-17", "endsOn": "2026-12-15" }],
  "events": [{ "id": "12", "scheduleId": "3", "medicine": "...", "dueAt": "2026-11-22T20:30:00+05:30", "status": "DUE", "skipReason": null }] } }

// POST /api/admin/medicine/tasks/31/done { "outcome": "CALL_BACK", "note": "Asked to call after 6", "callBackAt": "2026-11-17T12:30:00Z" }
{ "success": true, "message": "Moved to the call-back time", "data": { "id": "31", "status": "OPEN", "dueAt": "..." } }

// POST /api/admin/medicine/orders/7/move { "to": "DISPATCHED", "courier": "Delhivery", "trackingUrl": "https://...", "expectedAt": "2026-11-19T13:30:00Z" }
{ "success": true, "message": "Order updated", "data": { "id": "7", "status": "DISPATCHED" } }
// without courier and tracking: 400 "Add the courier and its tracking link or number to dispatch."
// backwards: 400 "This order is already dispatched."
```

Task outcomes: `WILL_PAY`, `PAID`, `ELSEWHERE` (stops reminders), `DECLINED` (closes the follow-up),
`RESOLVED`, and `CALL_BACK` (needs `callBackAt`) or `NO_ANSWER` (next working morning), which keep the task
open. Task kinds and who they go to:

| Kind | Opened by | Priority | Due |
| --- | --- | --- | --- |
| `NO_REPLY` | Nano follow-up after both check-ins | Normal | 8 working hours |
| `PLAN_CALL` | Plan patient not ordered a day after the reminder | Critical | 2 working hours |
| `QUESTIONS` | "I have questions", or text on WhatsApp | High | 2 working hours |
| `PAYMENT_FAILED` | Razorpay `payment.failed` | Normal | 4 working hours |
| `DISPATCH_DUE` | Not dispatched in 24 h (plan) or 48 h | Critical (plan), High | Now |
| `DELIVERY_LATE` | 6 h past the expected date | High | 1 working hour |
| `DELIVERY_ISSUE` | "Something is wrong" | Critical | 1 working hour |
| `RENEWAL` | Runs out in a week, prescription does not cover more | Normal | Next working morning |
| `REFILL_GAP` | Ran out a day ago, nothing new (to the coach) | High | 2 working hours |
| `ADHERENCE` | Doses slipping (to the coach); side effects | Normal; High | 8 working hours; 1 |
| `RECONCILE` | The nightly check | Critical, or Normal | Now |

Working hours are 10 am to 7 pm, Monday to Saturday, India time (`lib/hours.ts`). Check-ins, reminders
and feedback reach patients only from 9 am to 9 pm; order updates go when they happen.

## The messages

Every template, its wording, buttons and deep link, and how they are submitted to Meta: [whatsapp.md](whatsapp.md).
The code (`lib/messages.ts`) is the source.

## Turning it on

The migrations, the tick and WhatsApp: [whatsapp.md](whatsapp.md), "Turning it on". Then:

1. **Coaches**: an admin adds them in Medicine, Patients, Health coaches, and assigns each patient.
2. **Razorpay** already sends `payment.failed`; nothing new to register.

## Notes

- **Consent and privacy (DPDP Act 2023).** WhatsApp is a separate, optional consent (`WHATSAPP`), unticked
  by default, on the free check and in onboarding; the profile switch records and revokes it; STOP
  revokes it. Without it nothing is sent, every message is recorded as "Not sent: not opted in", and the
  app shows everything (orders, doses, refills). Messages carry no medicine names, doses or prices, and the
  prescription PDF never goes to WhatsApp: the message's button opens it in the app.
- **Idempotency.** Every message and task has a unique key ("rx:41:v1:ready", "order:7:DISPATCHED",
  "dose:310", "fu:12:c2"), and every inbound event is recorded once by its id, so Meta's and Razorpay's
  retries, double taps and overlapping ticks act once. Sends retry with backoff (2, 4, 8, 16 minutes) and
  then show as Not sent.
- **Reconciliation (daily).** A Razorpay order still "created" with a captured payment (its webhook never
  arrived) is fulfilled, as the webhook would have, and noted in a task; a paid medicines payment
  without a delivery order is a critical task.
- **The measures** (Numbers tab) use the PRD's definitions: prescriptions paid within 7 days (70%), the
  prescription on WhatsApp within 5 minutes (99%), payment to delivery order p95 (5 s), first check-ins
  answered (60%), dispatched in time and delivered on time (95%), delivery problems per 100 orders (under
  2), deliveries rated All good, doses taken, tasks overdue, and the median time to close a task.
- **Decisions taken** (from the PRD's conflicts, [medicine-flow-prd.md](medicine-flow-prd.md)): the nano
  check-ins are timed from when the order opens; a patient asking to order early is let through; the
  discount stays our table's (13%, 14% from 6 months) for everyone; delivery stays free. CONFIRM all four
  with Sachchidanand.
- **CONFIRM** with operations: the dispatch targets (24 h plan, 48 h nano), the 6-hour lateness line, the
  9 am default dose time, and who answers calls in working hours (10 am to 7 pm, Monday to Saturday).
- **Not built (does not apply yet)**: vendor routing, a vendor portal, courier tracking feeds, delay
  compensation credits, saved-card reorder (PRD; see the mapping doc for why).
