# Sales panel, coach panel, payment links and calls

Built from the client call of 23 Nov 2026. Code: `supabase/functions/api/routes/sales.ts`, `coach.ts`,
`adminSales.ts`, `lib/paymentLinks.ts`, `lib/callLinks.ts`; migration `20261123000400`. Deployed check:
`supabase/tests/sales_coach_journey.py`.

## Who reaches what

| Role | Signs in to | Reaches |
| --- | --- | --- |
| PATIENT | `/patient-dashboard` | their own data only |
| DOCTOR | `/doctor-dashboard` | patients on whose care team they are |
| SALES | `/sales` | the patients assigned to them (`patient_profiles.salesperson_id`): contact, doctor and coach names, calls, the current prescription's diagnosis and medicine names, the plan, payment links. Never reports, notes, PDFs or other patients |
| COACH | `/coach` | the patients they coach (`coach_id` or `fitness_coach_id`): the plan, the current prescription (read only), the diet chart or exercise plan, calls, remarks, their tasks. Never a sale, a payment or a prescription to write |
| ADMIN | `/admin` | everything, from the admin area |

- The API decides on every call (`requireUser` plus each route's own scope); the web shells (`StaffShell`) only keep
  the screens apart. A patient who is not yours answers 404, never 403, so nothing says they exist.
- A salesperson is a row in `salespeople` with a `users` row of role SALES (`salespeople.user_id`). Admin adds the
  mobile number; it must be nobody else's. Taken off the team: every session ends at once and the panel refuses them.
- Staff sessions last 12 hours. Every look at a patient is written to `audit_log`.

## Payment links

1. The salesperson (or admin) fills in the sales form: plan, discount, the coach asked for, remarks. A salesperson
   may take off up to `plans.max_sales_discount_percent`; admin up to 90%.
2. `createLink` makes a Razorpay Payment Link for that patient and amount (`payment_links`, id `plink_...`), good for
   7 days. Razorpay texts it to the customer (never to a test number); the team also copies and sends it. The
   patient's app shows it on Home (`/patient/next-step`, `payUrl`).
3. One link waits per patient: a new one cancels the last; putting the patient on a plan another way cancels it too.
4. Paid: `settle` starts the plan, writes the sale (who sold it, amount, Razorpay payment ID), adds the patient's
   payment with an invoice number, and queues the WhatsApp message `plan_payment_received`.
5. A payment reaches us three ways, and each only makes us ask Razorpay for the link's state (`check`): the webhook
   (`payment_link.paid`, `.cancelled`, `.expired`), the customer's return (`GET /payments/link-return`), and the
   scheduler every 5 minutes (`checkOpen`). Nothing in a webhook body or a return address is trusted for money.
6. Paid by someone already on a plan: the link is marked paid with `needs_attention` and a critical task opens.

Money that matches no order or link of ours (a link made in the Razorpay dashboard, a QR code) is kept in
`received_payments` from the `payment.captured` webhook and shown in admin's Payments with the patient whose mobile
paid it. Admin records it against a plan ("Paid another way"); a salesperson can enter a Razorpay payment ID, and
the plan starts only if Razorpay says that payment is captured, is at least the plan's lowest sales price, and was
never used before (`provePayment`).

**Razorpay dashboard:** add `payment_link.paid`, `payment_link.cancelled` and `payment_link.expired` to the webhook
that already sends `payment.captured`. Without them a payment is still found within 5 minutes.

Dry runs: `POST /admin/payment-links/:id/simulate-paid` plays the payment of a test patient's link (TEST_MOBILES
only). It stops working when `TEST_OTP` is unset.

## Plans

`plans.doctor_consults`, `coach_calls`, `fitness_calls`: what a plan includes (set to 1, 4 and 4 a month; admin edits
them under Patients, Plans). Admin's patient sheet and the coach's page count consultations done and calls logged
since the plan started against them.

## Coach

`coach_plans` (kind DIET or FITNESS; every save is a new version, the newest is current) and `coach_calls` (one row
per call made). The health coach writes the diet chart, the fitness coach the exercise plan. The patient reads both
on Care (`GET /care/coach-plans`); the doctor reads them, the calls and the remarks on the patient's page and beside
the prescription form (`coach` on the page).

## Calls

- Admin books a consultation and names the salesperson who joins after the doctor (`salespersonId` on the booking).
- `GET /admin/calls`: consultations coming up, and the follow-up sheet (last consultation 25 days ago or more,
  nothing booked).
- `GET /admin/consultations/:id/links`: the 100ms links for the patient, the doctor and the salesperson, to send by
  any means. The salesperson joins with the patient role's rights (cannot end the call). Links work until the doctor
  ends the call.
- A salesperson joins from their customer's page (`GET /sales/consultations/:id/join`).

## Also changed

- Every prescription is for one month, on a plan or not.
- A home blood test is booked for today or the next two days.
- The report-ready WhatsApp message says someone will call to book the consultation (template text changed: sync
  the templates with Meta before WhatsApp goes live).

## Blood tests: the patient's two days, and the team's bookings

Code: `routes/adminLabs.ts`, `routes/labs.ts` (`holdBooking`, `moveBooking`, `cancelBookingFor`, `checkPatientDay`),
migration `20261123000500`.

- A patient books their own test for tomorrow or the day after only. Any other day, and anyone who did not book,
  is handled by the team on a call.
- `GET /admin/pipeline` (admin, To call): who is stuck where: no blood test, a paid test to rebook, a report with
  no consultation, seen with no plan, on a plan with no coach. The follow-up after 25 days is under Calls.
- On the patient's sheet (Blood test) the team holds a time for them (today up to 4 days ahead, at a saved address
  or a new one found by search). The hold lasts 30 minutes and is booked once paid: in the app (Home shows it), on
  a payment link (`payment_links.purpose = 'LAB_BOOKING'`), or by a payment ID admin enters.
- Someone whose paid test was cancelled is rebooked on that payment, never charged again. The team can move a
  booked test (twice, the lab's limit) or cancel it.
- The lab is never named to a patient: its error text is logged and replaced by one calm line, and its tracking
  page is not linked. The report PDF itself is the lab's own file and carries its letterhead.

## Recording a call

The patient ticks "Record this call" on their Join screen, each call; unticked by default. `startRecording` asks
100ms with no body first and, when 100ms wants a `meeting_url` (composite recording not switched on in the
template), again with the room's own link, where the recorder joins as a guest named "Recording".
