# The medicine flow PRD, mapped to inrange

## Purpose

Sachchidanand shared Elevate Now's "PRD: Medicine Flow" (v0.1, 25 Oct 2025) on the 16 Nov 2026 call
for us to build from. This doc maps it to what inrange has today and puts what is left in build order.
It does not repeat the PRD: it keeps what applies, says where inrange already does it, and marks what
does not apply yet. Where the 12 Nov call or [medicine-cart.md](medicine-cart.md) says otherwise, those
win, and the conflicts are listed at the end for Sachchidanand.

Names: the PRD's **₹1799 plan** is our **nano plan** (the first consultation with blood tests, fee
indicative at ₹1,499 until Redcliffe's quote); its **Program** is our **plans** (3, 6, 9, 12 months).

- Screens involved: the doctor's Sign sheet, Care and Your medicines (`/patient-dashboard/care/cart`),
  the shared checkout, the admin panel (ops queue, to come), the coach's patient card (to come).
- Code today: `supabase/functions/api/lib/pharmacy.ts`, `routes/care.ts`, `routes/doctor.ts`,
  `routes/payments.ts`; tables `medicine_carts`, `medicine_orders`, `prescriptions`.

## Already built

| PRD | inrange today |
| --- | --- |
| The prescription reaches the patient at once on signing (T+0) | One signature makes the PDF, the patient's copy in the app and the cart (`POST /api/doctor/notes/:noteId/sign`). The WhatsApp copy is still to come (below) |
| ₹1799: no purchase push at T+0 | Nano plan: the cart opens `NANO_CART_DELAY_HOURS` (48) after signing; until then the app shows the date, the prescription and "Call me" |
| Program: instant "Buy now" with a ready quote | Patients on a plan get the cart at once, filled in (quantities, discount, address), so Pay is one tap |
| One system of record, no spreadsheets | Carts, orders and prescriptions live in Supabase; nothing is keyed in twice |
| Discount shown as its own line, before tax | `medicine_discounts` (13% from 1 month, 14% from 6), MRP struck through in the cart; a guard never sells below cost |
| Signed payment webhooks, processed once | Razorpay signature checked; `/payments/verify` and the webhook share one fulfilment, so whichever arrives second does nothing |
| Every order state change logged with time | `medicine_orders.status` (`PLACED`, `PACKED`, `DISPATCHED`, `DELIVERED`) with a `history` of `{ status, at, note }` |
| Immutable prescription, clinical words untouched | A signed prescription is not edited; a newer one closes the unpaid cart |

## Built (17 Nov 2026)

Everything below is live in the code, documented in [medicine-flow.md](medicine-flow.md) and covered by
`supabase/tests/medicine_flow_journey.py` (102 checks).

| PRD | inrange |
| --- | --- |
| 5.3, 7.2 WhatsApp conversation: T+0, T+24, T+48 with buttons, T+72 call | `lib/medicineFlow.ts` follow-ups, `lib/messages.ts` (18 utility templates), `integrations/whatsapp.ts`, `lib/replies.ts`. The nano check-ins are timed from when the order opens (conflict 1) |
| 7.2 BR1 pre-flight checks, EC1 duplicate taps, EC2 late replies, EC4 upgraded mid-flow | Every step re-reads the order; replies are recorded once by event id; a tap acts on the message it belongs to; a new plan moves the follow-up to the plan rhythm |
| 7.3 payment webhook: idempotent, failures handled | Already built; now a failed medicines payment messages the patient and opens a task |
| 5.2, 7.5 milestone notifications and delivery feedback 2 hours after | Pack, dispatch (with tracking), out for delivery, delivered, feedback; late and new-date messages |
| 9.1 medicine team dashboard: queue with SLA countdowns, one-click actions, order monitor, analytics | `/admin/medicine`: Queue, Orders, Patients, Messages, Numbers |
| 4.1, 7.6 the health coach: delivery and adherence visibility | `COACH` role, scoped to their patients; adherence and ran-out tasks go to them |
| 7.6 adherence: reminders, Taken / Snooze / Skipped with reasons, coach alerts | Dose schedules on delivery, WhatsApp and the app, alerts at 2 off in 7 days, 3 missed in a row, under 70% in 4 weeks, side effects at once |
| 7.7 refills: run-out date, reminder 7 days ahead, reorder, doctor review beyond the prescription | Refill orders on the same prescription; renewal tasks when it does not cover more; the refill gap |
| 11.3 consent for WhatsApp, opt-out on every channel | Optional WHATSAPP consent; the profile switch and STOP revoke it |
| 11.5 idempotency, retries, reconciliation | Keyed messages and tasks, backoff retries, the nightly Razorpay check |
| 14 success measures | The Numbers tab, same definitions |
| 6.2 audit trails | Task and order histories (who, when, what), every send and reply recorded, record views in `audit_log` |

## Not for now

- **Vendor routing, split shipments, a vendor portal and vendor acceptance times.** inrange dispenses
  from its own licensed pharmacy, so there is one stock and one dispatcher. Keep the idea as our own
  dispatch target: within 24 hours for plan patients, 48 hours otherwise (CONFIRM with operations).
- **Courier tracking feeds.** Until a courier is chosen, the tracking link is typed in on dispatch (item 3).
- **Delay compensation credits.** Needs a written policy first (CONFIRM with Shivam and counsel).
- **Saved-card one-tap reorder.** Later, with Razorpay tokenisation; the reorder link covers it now.

## Rules worth keeping from the PRD

- Never change a doctor's clinical words; the signed PDF stays as signed; every edit to operational
  data is logged with before and after.
- Anyone outside the care team (a courier, later a partner pharmacy) gets only what delivery needs:
  name, phone, address, items. Mask the phone once delivered.
- WhatsApp only with the patient's opt-in, and a stop honoured on every channel.
- Every webhook is processed once per payment or event id. A nightly job compares Razorpay
  settlements with paid carts and opens a task for any mismatch.

## How we will know it works

The PRD's definitions, kept so numbers compare:

| Measure | Target |
| --- | --- |
| Prescription to paid order within 7 days | 70% or more |
| Prescription message sent within 5 minutes of signing | 99% or more |
| Payment to order created | 5 seconds or less (p95) |
| Buttons answered at the first check-in | 60% or more |
| Escalations | Under 2 per 100 orders |
| Satisfaction after delivery | 4.5 of 5 or more |

## Conflicts to settle with Sachchidanand (the defaults built are in bold)

1. **When the nano cart can be bought.** The PRD offers the quote at T+24 to anyone who taps "Help me
   buy". The 12 Nov call holds the cart for 48 hours (his data: 24 hours raised programme conversion by
   1 to 2 points, 48 hours by 3 to 4) and says nobody calls about medicine in that time. **Built: the
   48-hour hold stays, the check-ins start when the order opens, and a patient who asks ("Order now")
   opens their own order early, since it is their request rather than a push.**
2. **The plan discount.** The PRD gives plan members 5%; ours is 13% from 1 month and 14% from 6 for
   everyone. **Built: our table, for everyone.** Confirm whether plan members get more.
3. **Delivery fee.** The PRD charges ₹50 under ₹1,000. Our medicines are all above that, so delivery
   is free. **Built: free.** Confirm it stays free.

## Also from the 16 Nov call: the prescription tool

Sachchidanand's notes on the doctor's side, for the next pass of Add a medicine and the PDF:

- Choose the form first (tablet, capsule, injection), then the medicine. He called it compliance.
- No quantity on the prescription. Keep it for the cart.
- Weight, age, height, BMI and sex on every prescription, filled in from onboarding for the doctor
  to confirm with the patient. The PDF's `vitals` is one optional line today.
- Diagnosis, patient history, medicines and advice as the sections, nothing more.
- A less white PDF.
- The nano plan's contents (one consultation, one blood test) shown in the patient's account; once the
  report is in, the consultation becomes bookable, with a salesperson and a doctor assigned (the
  salesperson free soonest first).
