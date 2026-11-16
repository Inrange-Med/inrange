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

## To build next, in order

Each item says what the patient or the team sees. Rough size in brackets.

1. **WhatsApp messages and a scheduler** (large; needs a Meta business account and templates). One
   service sends templates and records every send and button tap against the patient.
   - **T+0:** the prescription PDF and a short summary, with no purchase link for the nano plan, and
     with "Buy now" (the cart link) for patients on a plan.
   - **Nano plan, T+24:** a check-in with three buttons: "Already bought", "Help me buy", "Need more
     time". "Help me buy" sends the cart link (see conflict 1). "Need more time" moves the next
     check-in by a day.
   - **Nano plan, T+48:** the same buttons plus "I have questions", which opens a call-back task for the
     team due within 2 hours.
   - **No reply by T+48:** a call task for the next working day, with the prescription and the cart
     ready, so one call settles it. The agent guides the patient to pay themselves; they never order
     for them (12 Nov call).
   - **Plan patients, T+24:** one gentle reminder if nothing was bought.
   - **Before every automated message:** skip it if the cart is paid, the patient moved onto a plan,
     or said they bought elsewhere. A late tap is handled against the message it belongs to, and a
     repeated tap does nothing twice.
   - "Already bought" closes the flow with a kind line and tells the coach, so adherence follow-up
     still happens.
2. **Order updates to the patient** (medium; the statuses exist). An order number within seconds of
   paying, then packed, dispatched (with the tracking link), out for delivery and delivered, each on
   WhatsApp and in Your medicines. Two hours after delivery: "All good" or "Something is wrong", where
   the second opens an urgent ticket. A failed payment sends a retry link.
3. **A medicine queue in the admin panel** (medium). One list of tasks (no reply, questions, payment
   failed, dispatch overdue), each with a due time that turns amber, then red. One-tap actions: call,
   send the cart link, mark bought elsewhere, schedule a call-back, close with a reason. Every action is
   logged with who and when. Pharmacy staff move orders through packed and dispatched here, with the
   tracking number.
4. **The coach sees medicine status** (small). "Dispatched" and "Delivered" on the coach's patient card,
   and a note to the coach when each happens.
5. **Refills for plan patients** (medium). A daily job works out the run-out date (delivered + days
   supplied, less 7). Seven days before it, a reminder with the reorder link (a new cart at today's
   price and discount). No reminder if a cart is already open. A refill past the prescription's length
   goes to the doctor first.
6. **Adherence for plan patients** (later). Dose reminders with "Taken", "Remind me in an hour" and
   "Skipped" (with a reason). The coach is alerted after 2 skips in 7 days, or any "side effects".

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

## Conflicts to settle with Sachchidanand

1. **When the nano cart can be bought.** The PRD offers the quote at T+24 to anyone who taps "Help me
   buy". The 12 Nov call holds the cart for 48 hours (his data: 24 hours raised programme conversion by
   1 to 2 points, 48 hours by 3 to 4) and says nobody calls about medicine in that time. Proposal: keep
   48 hours by default, and let a patient who asks ("Help me buy") open their own cart early, since it
   is their request rather than a push.
2. **The plan discount.** The PRD gives plan members 5%; ours is 13% from 1 month and 14% from 6 for
   everyone. Confirm whether plan members get more.
3. **Delivery fee.** The PRD charges ₹50 under ₹1,000. Our medicines are all above that, so delivery
   is free; confirm it stays free.

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
