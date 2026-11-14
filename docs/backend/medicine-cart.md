# Medicine cart after a prescription, and the other backend asks from the 12 Nov 2026 call

## Purpose

What the call with Shivam, Aamer and Sachchidanand (12 Nov 2026) decided for the backend, written as
the rules the app will follow once the endpoints exist. Nothing here is built in the app yet: the
patient app has the prescription card (`GET /api/care/prescription/current`) and deliveries, and no
cart. Sachchidanand is writing the full post-lead flow (his "master sheet"); where it differs, his
sheet wins and this doc is updated.

- Screens (to come): Care, the cart page opened from WhatsApp, the doctor's e-prescription.
- Services (to come): `carePlanService` (cart), `doctorPortalService` (inventory search).

## Endpoints

| Method | Path | Status | Used for |
| --- | --- | --- | --- |
| GET | `/api/pharmacy/inventory?query=` | PROPOSED | The doctor's e-prescription: a dropdown of what the PDPL warehouse stocks |
| GET | `/api/care/cart` | PROPOSED | The patient's prefilled cart, or `data: null` while it is held back |
| PATCH | `/api/care/cart` | PROPOSED | The patient adds or removes lines within the prescription |
| POST | `/api/care/cart/checkout` | PROPOSED | Starts payment (Razorpay, `purpose=MEDICINE_ORDER`, see payments-razorpay.md) |

## The rules

1. **The doctor prescribes from stock.** Typing in the e-prescription searches the warehouse's
   master data; each line is an inventory item. Signing the prescription creates a prefilled cart for
   the prescription's length (30 days, 60 days), with the default discount applied.
2. **First consultation (the nano plan): prescription only, cart later.** The prescription is
   valid for **one month**. The patient gets the prescription at once (WhatsApp and the app) with a
   call-back option. The cart, its quotation and the payment link are sent **24 to 48 hours later**,
   so the counsellors can explain the full programme first (Sachchidanand's data: moving medicine to 24
   hours raised programme conversion by 1 to 2 points, to 48 hours by 3 to 4). Make the delay a
   setting (`NANO_CART_DELAY_HOURS`, default 48) so it can be piloted. Until then
   `GET /api/care/cart` answers `{ "data": null, "availableAt": "<ISO time>" }`.
3. **Nobody calls a nano plan patient about medicine in the first 48 hours.** Any sales or
   pharmacy task created for them is scheduled after `availableAt`.
4. **Follow-up consultations (patients on a plan): cart at once.** The cart and quotation go out
   right after the consultation, with call-back and chat options. If nothing is bought within 24
   hours, a task asks an agent to call and guide the patient to check out themselves (the agent never
   places the order for them). After that, a reminder every 6 to 12 hours, with a cap and a stop the
   moment they buy or say no.
5. **Self-checkout everywhere.** The WhatsApp link opens the same cart page; card or UPI.
6. **Medicine prices never reach the public site.** Only the signed-in cart shows them.

## Other asks from the call

- **Care package lines without a length.** `GET /api/care-packages` `description` and `includes`
  still say "30-minute video consultation". The call runs about an hour (the doctor, then the health
  coach) and no screen shows a length any more. The app already strips the length
  (`src/lib/format/carePackage.ts`); please change the data too. Suggested `includes` for
  `LAB_AND_CONSULT`: `["Blood tests at home", "Video consultation with a doctor", "A call with your health coach"]`.
  Never list the tests by name in a package line: the app shows the marker count from
  `GET /api/labs/packages` (`testCount`) instead.
- **First-step price.** The nano plan fee stays indicative (₹1,499 / ₹1,599 discussed) until
  Redcliffe's final quote (₹950 now, ₹800 targeted). The app shows whatever `priceRupees` says.
- **Invoice after payment.** Send an invoice for the first-step payment as soon as Razorpay
  confirms it (email and WhatsApp), and list it in `GET /api/payments` with `invoiceUrl` so the
  Plans page's Invoices shows it.
- **Slow OTP.** The app now loads Firebase and connects to Google's sign-in hosts while the number
  is typed (`warmFirebaseSignIn` in `src/lib/auth/firebasePhone.ts`), which removes the wait before
  the text is sent. The text itself is Firebase's: check delivery times in the Firebase console and
  whether `/api/auth/send-otp` answers quickly.
- **Free check before sign-in.** `/assessment` asks gender, age, height, weight, conditions and
  past attempts before the mobile number, then onboarding saves them with the usual
  `PATCH /api/onboarding/step` (steps 2 to 7, one call each, in order) right after sign-in. Nothing
  new is needed; steps can now arrive before step 1, so do not assume they come in order.
- **`NEXT_PUBLIC_ASSESSMENT_URL`.** Leave it unset (or `/assessment`) on Vercel, or the booking
  links skip the free check.

## From the conversion research (14 Nov 2026)

Ranked by likely effect on people who start the free check and never pay. Sources are in the PR.

1. **OTP through an Indian SMS provider on DLT, with browser autofill.** Firebase sends Indian OTPs
   at about US$0.07 each, its template cannot be changed, and it cannot carry the line browsers need
   to fill the code. A DLT-registered provider (MSG91, Gupshup, 2Factor, Exotel) costs about ₹0.2 and
   lets the template end with `@inrangemed.com #123456`, which Android Chrome fills in one tap (the app
   already listens for it, WebOTP). Keep Firebase for the session if you like (`signInWithCustomToken`),
   and rate-limit `send-otp` on the server in place of reCAPTCHA. Register the template as a service
   message with the code tagged `#numeric#` (TRAI, Nov 2025).
2. **Truecaller one-tap on Android, OTP as the fallback.** Free; partners report +16 to 21% verified
   sign-ups. Needs a callback endpoint for the token; show the privacy line and keep only the number.
3. **WhatsApp OTP as a fallback** after about 20 seconds without a code (Meta authentication
   templates, from an India-registered WhatsApp business account).
4. **Prefill Razorpay** with the verified mobile and email (`prefill.contact`, `prefill.email`,
   `readonly.contact`), and keep UPI first. UPI collect is gone on Android since 28 Feb 2026, so intent
   (opening the UPI app) is the path; Razorpay's standard checkout already does this.
5. **Drop-off recovery.** Anyone who verified their number but did not pay is already a lead for
   pre-sales. If they ticked an optional WhatsApp updates box (to add), send one message linking back
   to their step, and a payment link after a failed payment.
6. **Safety questions the check cannot ask yet.** Pregnancy or breastfeeding, type 1 diabetes, an
   eating disorder (now or before), pancreatitis, and a personal or family history of medullary
   thyroid cancer are reasons a doctor must look first. They need new condition codes in
   `/api/onboarding/config` and step 7 (clinical sign-off from the medical team first). Tell me the
   codes and I add them to the bundled list the free check uses (`src/lib/onboarding/answerLists.ts`).
7. **Never send health answers to analytics or ad pixels** (the 2026 FTC case against Hims & Hers
   alleges exactly this). Only page views and step names, never answers.
