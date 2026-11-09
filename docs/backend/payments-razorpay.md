# Payments with Razorpay

## Purpose

Every payment in the app (a plan, a lab booking, the first consultation fee) goes through one
checkout. The backend creates every order and decides every amount; the browser only shows what the
order says and hands Razorpay's result back for verification. The frontend never sends an amount and
never activates anything itself. Until these endpoints exist, checkout shows "Online payment is not
available yet" (a 404) and nothing is activated.

- Screens: `/patient-dashboard/checkout` (`?purpose=PLAN|LAB_BOOKING|CONSULTATION_FEE&referenceId=..&returnTo=..`),
  `/patient-dashboard/plans` (invoices), and the pages that send a patient to checkout: Plans,
  `/pricing`, the lab booking, Book a consultation.
- Files: `src/services/paymentService.ts`, `src/types/payment.ts`, `src/lib/payments/razorpayCheckout.ts`,
  `src/app/patient-dashboard/checkout/`.

## Endpoints

| Method | Path | Status | Service function | Screen |
| --- | --- | --- | --- | --- |
| POST | `/api/payments/orders` | PROPOSED | `paymentService.createPaymentOrder` | Checkout, on load (review) |
| POST | `/api/payments/verify` | PROPOSED | `paymentService.verifyPayment` | Checkout, after Razorpay succeeds |
| GET | `/api/payments` | PROPOSED | `paymentService.listPayments` | Plans, "Invoices" |
| POST | `/api/webhooks/razorpay` | PROPOSED | none (Razorpay calls it) | none |

`referenceId` per purpose: `PLAN` = `SubscriptionPlans.PlanId`; `LAB_BOOKING` = the InRange lab
booking id (from `POST /api/labs/bookings`); `CONSULTATION_FEE` = the slot id the patient chose
(`SlotId` from `GET /api/schedule/available-slots`).

All endpoints answer `{ success, message, data }`. Errors use `success: false` with a `message` a
patient can read; the frontend shows it as is. **Do not answer 404 for a missing plan, booking or
slot**: 404 reads as "endpoint not built". Use 400 (or 422).

## Requests and responses

### POST `/api/payments/orders` (PROPOSED)

Creates (or reuses) a Razorpay order for something the patient wants to pay for.

- Auth: `Authorization: Bearer <access token>`, role PATIENT.
- Used by: `/patient-dashboard/checkout` on load (review screen).

Request:

```json
{ "purpose": "PLAN", "referenceId": "3" }
```

For `CONSULTATION_FEE` the body also carries `reason` (what the patient typed on Book); store it
on the booking made on verify.

Steps:

1. Validate `purpose` is one of `PLAN`, `LAB_BOOKING`, `CONSULTATION_FEE` and `referenceId` is
   present. Otherwise 400.
2. Work out the amount on the server from the reference. Never from the request.

   | purpose            | referenceId                       | Amount and checks                                                                                   |
   | ------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------- |
   | `PLAN`             | `SubscriptionPlans.PlanId`        | `Price * 100`. 400 if the plan is missing, `IsActive` is false, or `Price` is null or 0. 409 if the user already has an active plan. |
   | `LAB_BOOKING`      | InRange lab booking id (from `POST /api/labs/bookings`) | The booking's stored total (Redcliffe package price, plus any collection charge), in paise. 400 if the booking is not the user's, is cancelled, or the 30-minute slot hold has expired. 409 if already paid. |
   | `CONSULTATION_FEE` | The slot id the patient chose (`SlotId` from `GET /api/schedule/available-slots`) | The first-consultation fee (the "consultation only" care package price). 400 if the patient is not `APPROVED` (`GET /api/eligibility`), the slot is not one they may book, or it is taken. 409 if their first consultation is already paid. **Hold the slot** for this patient while the order is open (for example 15 minutes), so no one else can book it. |

3. If this user already has a `CREATED` order for the same `purpose` + `referenceId` and the same
   amount, return it instead of creating a new one (the review page can load more than once).
4. Otherwise create the Razorpay order with the Orders API:

   ```
   POST https://api.razorpay.com/v1/orders
   Authorization: Basic base64(RAZORPAY_KEY_ID:RAZORPAY_KEY_SECRET)
   Content-Type: application/json

   {
     "amount": 1799900,
     "currency": "INR",
     "receipt": "pay_418",
     "notes": { "userId": "57", "purpose": "PLAN", "referenceId": "3" },
     "payment": {
       "capture": "automatic",
       "capture_options": { "automatic_expiry_period": 12, "refund_speed": "normal" }
     }
   }
   ```

   (`receipt` is your own id, at most 40 characters. `payment.capture` makes the order auto-capture
   whatever the Dashboard's capture setting says; a payment authorised more than 12 minutes after it
   started is not auto-captured, so `/verify` captures it, else Razorpay refunds it.)
5. Store the row with `Status = CREATED` and return:

```json
{
  "success": true,
  "message": "Order created",
  "data": {
    "orderId": "order_PbX9q2mN7c1Ztr",
    "amountPaise": 1799900,
    "currency": "INR",
    "razorpayKeyId": "rzp_test_1DP5mmOlF5G5ag",
    "title": "Complete programme, 4 months",
    "lineItems": [
      { "label": "Complete programme, 4 months", "amountPaise": 1799900 }
    ]
  }
}
```

`lineItems` are what the review screen lists; `amountPaise` is the total it shows and the amount
Razorpay charges. Make sure the line items add up to the total: the frontend never adds them up.
For a lab booking, list each test package and any collection charge as separate lines.
For a consultation fee, name the held time in the title so the review screen reads on its own, for
example `"title": "Video consultation, Thu 30 Oct, 10:00 am"` with
`"lineItems": [{ "label": "First consultation, 30 minutes", "amountPaise": 99900 }]`. The checkout
page heads itself "Pay for your consultation" and offers "Choose another time" as its back link.

Errors:

```json
{ "success": false, "message": "This plan is not available any more." }
```

### POST `/api/payments/verify` (PROPOSED)

Called by the browser right after Razorpay's success callback.

- Auth: Bearer, role PATIENT. The order must belong to the signed-in user.
- Used by: `/patient-dashboard/checkout`. If this call fails, the page keeps the Razorpay result and offers
  "Confirm payment", which calls it again with the same body (never a second payment).

Request (field names as the frontend sends them):

```json
{
  "orderId": "order_PbX9q2mN7c1Ztr",
  "razorpayPaymentId": "pay_PbXA4kHcC1oQ2n",
  "razorpaySignature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d"
}
```

Steps:

1. Load the stored order by `orderId` for this user. Unknown: 400.
2. Compute `expected = HMAC_SHA256(key = RAZORPAY_KEY_SECRET, message = orderId + "|" + razorpayPaymentId)`
   as lowercase hex, using the **stored** order id. Compare with `razorpaySignature` using a
   constant-time comparison. Mismatch: 400 `"Payment could not be verified."`, and do not mark
   anything paid.
3. `GET https://api.razorpay.com/v1/payments/{razorpayPaymentId}` and check `order_id` matches,
   `amount` equals the stored `AmountPaise` and `currency` is `INR`. If `status` is `authorized`,
   capture it (`POST /v1/payments/{id}/capture` with `{ amount, currency }`). Fulfil only when it is
   `captured` (Razorpay refunds uncaptured payments); otherwise 409 "not confirmed yet", and the page
   offers to retry the confirmation (never a second payment).
4. In one transaction: set `Status = PAID`, `RazorpayPaymentId`, `PaidAt`, `InvoiceNumber`, then run
   fulfilment (below) if `FulfilledAt` is null, and set `FulfilledAt`.
5. If the order is already `PAID` (the webhook got there first), skip straight to the response.

Response:

```json
{
  "success": true,
  "message": "Payment verified",
  "data": { "status": "PAID", "purpose": "PLAN", "referenceId": "3" }
}
```

Node example for step 2:

```js
const crypto = require("crypto");
const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${order.RazorpayOrderId}|${razorpayPaymentId}`).digest("hex");
const ok = expected.length === razorpaySignature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpaySignature));
```

### POST `/api/webhooks/razorpay` (PROPOSED)

Set up in the Razorpay Dashboard (Accounts & Settings, Webhooks), once in Test mode and again in Live
mode, with the URL `https://<backend>/api/webhooks/razorpay?forceFunctionRegion=ap-south-1`, the secret
`RAZORPAY_WEBHOOK_SECRET`, and the events `payment.captured`, `order.paid` and `payment.failed`.
Razorpay retries a non-2xx answer for 24 hours, wants a 2xx within 5 seconds, and may send
`payment.failed` before a later `payment.captured` (UPI), so `payment.failed` is never final.

- Auth: none (Razorpay calls it). Trust comes only from the signature.
- Read the **raw** request body (before JSON parsing). Compute
  `HMAC_SHA256(key = RAZORPAY_WEBHOOK_SECRET, message = rawBody)` as hex and compare it, in constant
  time, with the `X-Razorpay-Signature` header. Mismatch: 400 and stop.
- Idempotent: Razorpay retries and can deliver an event more than once. Store the
  `X-Razorpay-Event-Id` header and ignore an id already seen; the `FulfilledAt` guard covers the rest.
- Answer 200 quickly (within a few seconds); do slow work after responding or in a job.

Example body (trimmed):

```json
{
  "entity": "event",
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_PbXA4kHcC1oQ2n",
        "order_id": "order_PbX9q2mN7c1Ztr",
        "amount": 1799900,
        "currency": "INR",
        "status": "captured",
        "error_description": null
      }
    }
  },
  "created_at": 1793174400
}
```

Handling:

- `payment.captured`: find the order by `order_id`; check `amount` equals `AmountPaise`; mark
  `PAID` and run `fulfilPayment` exactly as `/verify` does.
- `payment.failed`: if the order is still `CREATED`, store `error_description` in `FailureReason`.
  Do not set `FAILED` on the order itself: the patient may try again in the same window and succeed
  with the same order.

Response: `200` with `{ "success": true }`.

### GET `/api/payments` (PROPOSED)

The signed-in patient's paid orders, newest first: the "Invoices" list on `/patient-dashboard/plans`
(Arhaan's Plan and payments panel shows invoices). Until it exists the list says "Invoices are not
available yet."

- Auth: Bearer, role PATIENT.

```json
{
  "success": true,
  "message": "Payments",
  "data": [
    {
      "id": "418",
      "purpose": "PLAN",
      "title": "Complete programme, 4 months",
      "amountPaise": 1799900,
      "paidAt": "2026-10-28T09:41:12.000Z",
      "invoiceNumber": "MED-2026-000123",
      "invoiceUrl": "https://files.inrange.in/invoices/MED-2026-000123.pdf"
    }
  ]
}
```

`invoiceUrl` may be null; the View button only appears when it is set. Only `PAID` rows are
listed.

## Notes

### The flow

```
Patient                      Frontend                          Backend                         Razorpay
   | choose plan / test / fee  |                                  |                                |
   |-------------------------->| /patient-dashboard/checkout?purpose=..&referenceId=..&returnTo=..          |
   |                           | POST /api/payments/orders ------>| validate, price it, store      |
   |                           |                                  | POST /v1/orders -------------->|
   |                           |<--- orderId, amount, line items -|<------------- order_xxx -------|
   | review, tap Pay           | Checkout.js opens with order_id ------------------------------->  |
   | pays in Razorpay window   |<------------- razorpay_payment_id, razorpay_order_id, signature --|
   |                           | POST /api/payments/verify ------>| HMAC check, mark PAID, fulfil  |
   |                           |<--------- status PAID -----------|                                |
   |<-- returnTo --------------|                                  |<-- webhook payment.captured ---|
```

The webhook is the safety net: if the browser closes after paying but before `/verify`, the
webhook still marks the order paid and fulfils it. Fulfilment is idempotent, so whichever of
`/verify` and the webhook arrives second does nothing.

### Fulfilment (shared by /verify and the webhook)

One function, `fulfilPayment(payment)`, guarded by `FulfilledAt` so it runs once:

- `PLAN`: run the existing subscription activation logic (what `POST /api/subscriptions/activate`
  does today with `{ targetUserId, planId }`), with `targetUserId = payment.UserId` and
  `planId = ReferenceId`. After this ships, restrict the public `POST /api/subscriptions/activate`
  route to staff/admin use, so a plan can only be started by a verified payment.
- `LAB_BOOKING`: confirm the held slot with Redcliffe `center-confirm-booking` using the booking's
  Redcliffe booking id and `"is_confirmed": true`, then mark the InRange booking confirmed and
  paid. If Redcliffe refuses (the hold expired), keep the payment `PAID`, flag the booking for the
  care team and refund through `POST /v1/payments/{id}/refund`; do not silently drop it.
- `CONSULTATION_FEE`: book the held slot for this patient (what `PUT /api/schedule/book` does, with
  `consultationType: "Virtual"`), then set `consultationPaid: true` on their eligibility. The page
  then goes to `/patient-dashboard/appointments`, where the booking shows. If the hold expired and the slot
  was taken, keep the payment `PAID`, flag it for the care team and refund (as for `LAB_BOOKING`).

### Environment variables (backend)

| Name                      | What                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| `RAZORPAY_KEY_ID`         | Public key id, `rzp_test_...` / `rzp_live_...`. Returned to the browser in each order. |
| `RAZORPAY_KEY_SECRET`     | Secret. Basic-auth password for the Orders API and the HMAC key for `/verify`. Never sent to the browser. |
| `RAZORPAY_WEBHOOK_SECRET` | The secret set on the webhook in the Razorpay dashboard. HMAC key for `/api/webhooks/razorpay`. |

The browser gets the key id only from the order response, so the key and the order always come from
the same Razorpay account. The frontend has no Razorpay setting of its own.

### Suggested table: `Payments`

| Column              | Type          | Notes                                                    |
| ------------------- | ------------- | -------------------------------------------------------- |
| `PaymentId`         | int, PK       |                                                          |
| `UserId`            | int           | The signed-in patient (from the JWT, never from the body) |
| `Purpose`           | enum          | `PLAN`, `LAB_BOOKING`, `CONSULTATION_FEE`                |
| `ReferenceId`       | string        | Plan id, lab booking id or slot id (see below)           |
| `Title`             | string        | Shown on the review screen and the invoice               |
| `LineItems`         | json          | `[{ label, amountPaise }]`                               |
| `AmountPaise`       | int           | Integer paise. The only amount Razorpay is asked for     |
| `Currency`          | string        | `INR`                                                    |
| `RazorpayOrderId`   | string, unique| `order_...`                                              |
| `RazorpayPaymentId` | string, null  | `pay_...`, set when paid                                 |
| `Status`            | enum          | `CREATED`, `PAID`, `FAILED`                              |
| `FailureReason`     | string, null  | From `payment.failed`                                    |
| `FulfilledAt`       | datetime, null| Set once fulfilment has run (the idempotency guard)      |
| `InvoiceNumber`     | string, null  | Assigned when paid, e.g. `MED-2026-000123`               |
| `InvoiceUrl`        | string, null  | PDF, when invoices are generated                         |
| `CreatedAt`, `PaidAt` | datetime    |                                                          |

All endpoints answer the usual `{ success, message, data }`. Errors use `success: false` with a
`message` a patient can read; the frontend shows `message` as is.

**Do not answer 404 for a missing plan, booking or slot.** The frontend reads 404 as "this
endpoint is not built yet". Use 400 (or 422) with a message instead.
