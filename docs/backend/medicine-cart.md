# Medicine cart after a prescription, and the other backend asks from the 12 Nov 2026 call

## Purpose

What the call with Shivam, Aamer and Sachchidanand (12 Nov 2026) decided for medicine after a
consultation, and how it is built (15 Nov 2026). Sachchidanand is writing the full post-lead flow (his
"master sheet"); where it differs, his sheet wins and this doc is updated.

- Screens: the call note's Add a medicine and Sign sheet (doctor), Care and Your medicines
  (`/patient-dashboard/care/cart`, the page the WhatsApp link opens), the shared checkout.
- Code: `supabase/functions/api/lib/pharmacy.ts` (search, pricing, when a cart opens),
  `lib/prescriptionPdf.ts` (the PDF), `routes/doctor.ts` (signing), `routes/care.ts` (the cart),
  `routes/payments.ts` (`MEDICINE_ORDER`). Schema: `migrations/20261115000100_medicine_cart.sql`.

## Endpoints

| Method | Path | Status | Used for |
| --- | --- | --- | --- |
| GET | `/api/pharmacy/inventory?query=` | LIVE (doctor) | Add a medicine: what the pharmacy stocks, matched on brand, molecule and strength. Customer MRP only |
| POST | `/api/doctor/notes/:noteId/sign` | LIVE, `{ sendToApp, rxMonths }` | One signature: the note, then the prescription (PDF, cart) |
| POST | `/api/doctor/patients/:patientId/prescriptions/:id/sign` | LIVE, `{ months }` | Fallback for a draft left when the PDF could not be made |
| GET | `/api/care/cart` | LIVE (patient) | The open cart, or `{ data: null, availableAt }` while held back, or `{ data: null }` |
| PATCH | `/api/care/cart` | LIVE (patient) | `{ lines: [{ medicineId, quantity }], addressId }`: 0 up to the prescribed quantity |
| POST | `/api/payments/orders` | LIVE, `purpose: "MEDICINE_ORDER"`, `referenceId`: the cart id | Checkout; paying creates the delivery (`medicine_orders`) |

`/api/care/cart/checkout` (proposed earlier) is not needed: the cart pays through the shared checkout.

## The rules, as built

1. **The doctor prescribes from stock.** Add a medicine searches `medicines` (14 items from the
   pricing sheet: Wegovy FlexTouch, Ozempic, Mounjaro KwikPen at each strength). A picked item carries its
   generic name, form, route, usual frequency and a pack quantity. A name typed that the pharmacy does not
   stock goes on the prescription only, never in the cart (the patient may fill it anywhere).
2. **One signature.** Signing the note signs the prescription too: the PDF, the patient's copy and a
   cart of every stocked item at its prescribed quantity, with the default discount. A newer prescription
   closes the unpaid cart. If the PDF fails, the prescription stays a draft the doctor signs from the record.
3. **First consultation without a plan (the nano plan): one month, cart later.** The prescription is
   one month whatever the doctor picked, valid one month, and the cart opens
   `NANO_CART_DELAY_HOURS` (secret, default 48) after signing. Until then `GET /api/care/cart` answers
   `availableAt`; Care and Your medicines show the date, the prescription and "Call me" (a support request).
4. **Patients on a plan: cart at once,** for the 1, 2, 3 or 6 months the doctor picked in the Sign sheet.
5. **Self-checkout.** Your medicines arrives filled in (quantities, discount, the default address), so
   Pay is the one required tap; it opens Razorpay straight away.
6. **Medicine prices never reach the public site.** Only the doctor's search (MRP) and the signed-in cart show them.

## Prices

| What | Where | Who sees it |
| --- | --- | --- |
| Medicine MRP | `medicines.mrp_paise` | Doctor (search), patient (cart, struck through) |
| Default discount | `medicine_discounts` (1+ months 13%, 6+ months 14%; edit rows to change) | Patient (cart) |
| Medicine cost (PTS incl. GST) | `medicine_costs` | **Nobody.** Read only by the guard that never sells a line below cost |
| Plan MRP and price | `plans.mrp_rupees`, `plans.price_rupees` (the sheet's floor; 3, 6, 9, 12 months) | Patient (Plans: MRP struck, price charged) |
| Plan service cost | `plan_costs` (the sheet's package value) | **Nobody.** For margin decisions in the database only |

Internal prices live in their own tables so no `select *` on `medicines` or `plans` can leak them; no
route returns them. Change prices in the Supabase SQL editor.

## The prescription PDF

Telemedicine Practice Guidelines 2020 format: the practice and the prescriber (name, qualification,
registration number), the patient (name, age, sex, ID, mobile, address, vitals), the consultation
(video, type, date, time, signed at), complaint, diagnosis (the note's assessment), history, allergies,
other medicines, the medicines (brand, GENERIC in capitals, form, strength, dose and frequency, route,
duration, quantity), advice (the patient summary, else the plan), follow-up, valid until, the digital
signature and the legal notes. inrange wordmark, Jost (function static files in `assets/`).
CONFIRM and set as secrets: `PRACTICE_ADDRESS` (the registered office) and `PHARMACY_LICENCE` (licence
numbers and holder); each line prints only once set. No drawn signature image is used: the TPG allow a
digital signature, and the PDF says "Digitally signed" with the prescriber's details and time.

## Not built yet

- WhatsApp (Meta Cloud API): the prescription and cart messages, the 24-hour agent call task and the
  6 to 12-hour reminders (rules 3 and 4 of the call) need the Meta integration and a scheduler. The cart
  already carries `available_at`, which is when the message should go.
- Program + medicine bundles (sheet Step 4): sales quotes, not an app purchase.

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
