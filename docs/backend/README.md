# Backend endpoints the app needs

## Purpose

The one index of what the frontend calls. The app calls existing endpoints as they are today. Where
a screen needs something the backend does not have yet, the app calls the **PROPOSED** path in these
docs and shows "not available yet" on 404. Nothing is mocked. The same word, PROPOSED, marks these
endpoints in every doc and at the top of every `src/services/*Service.ts` file.

Every doc has the same layout: **Purpose** (screens, service, types), **Endpoints** (method, path,
status, service function, screen), **Requests and responses** (examples), **Notes**.

| Doc | Covers |
| --- | --- |
| [patient-dashboard.md](patient-dashboard.md) | Home, Profile, Resources, Plans: profile, weight tracker, eligibility, subscriptions; designs not built yet |
| [consultations-and-care.md](consultations-and-care.md) | Booking a time, rescheduling, care team, prescription and deliveries, chat, video room |
| [onboarding.md](onboarding.md) | The eight questions, resume, consents, the blood test step and care packages |
| [reports.md](reports.md) | Lab report upload and list |
| [lab-tests-redcliffe.md](lab-tests-redcliffe.md) | Home blood tests: each route mapped to the Redcliffe client, the slot hold, webhooks, env vars |
| [payments-razorpay.md](payments-razorpay.md) | Razorpay orders, signature verification, fulfilment (plan, lab booking, consultation fee), webhooks |
| [doctor-dashboard.md](doctor-dashboard.md) | The doctor's day, patient record, call notes, doctor chat list |
| [medicine-cart.md](medicine-cart.md) | The cart after a prescription (nano plan: 24 to 48 hours later; follow-ups: at once), plus the other backend asks from the 12 Nov call |

## Conventions the app expects

- JSON envelope `{ "success": true, "message": "...", "data": ... }`; `success: false` with a
  readable `message` on failure (the app shows it as is).
- `Authorization: Bearer <accessToken>` from `/api/auth/verify-otp`; the JWT carries `role`
  (`PATIENT` or `DOCTOR`) and the user id.
- 404 means "endpoint not built". For a missing record (no such booking, plan or slot), answer 400,
  409 or 422 with a message instead, so the screen shows the real reason.
- Secrets (Redcliffe key, Razorpay secret) live only on the backend.
- Patients never choose a doctor; `GET /api/doctors` is not called by the app.

## Live backend check (28 Oct 2026, https://mediapi.unios.in)

Read-only requests without sign-in. "Live" = the route answers (protected routes reply
`{"success":false,"error":"NOT_AUTHORISED"}` with HTTP 200; the app treats that as signed out).

| Status | Endpoints |
| --- | --- |
| Live (GET, probed) | `/api/auth/me`, `/api/doctors`, `/api/doctors/dashboard-list`, `/api/subscriptions/plans`, `/api/schedule/slots/:doctorId/:date`, `/api/appointments/patient`, `/api/appointments/doctor`, `/api/video/appointments/:id/join` |
| Not probed (write routes the team's code already used) | `POST /api/auth/send-otp`, `POST /api/auth/verify-otp`, `PATCH /api/onboarding/step`, `POST /api/onboarding/complete`, `PUT /api/schedule/book`, `POST /api/chat/init`, `POST /api/video/appointments/:id/end`, `POST /api/subscriptions/activate` |
| Called by the app as existing, but **missing** on the live server (GET answered 404) | `GET /api/patient/profile`, `GET /api/address/my-addresses`, `GET /api/doctor/patients`, `GET /api/doctor/me`, `GET /api/subscriptions/status`. Their write routes (`PATCH /api/patient/*`, `POST /api/address/add`) were not probed; check them with the profile routes. |
| Missing (as expected) | every PROPOSED endpoint below |

Also seen: every plan from `/api/subscriptions/plans` has `"Price": null`. The plans screen shows
the team's original "Free" label for a null price, so set real prices before launch.

## Every proposed endpoint (the backend checklist)

| Method | Path | Screen | Doc |
| --- | --- | --- | --- |
| GET | `/api/trackers/weight` | Home, weight card | [patient-dashboard](patient-dashboard.md) |
| POST | `/api/trackers/weight` | Home, "Log weight" | [patient-dashboard](patient-dashboard.md) |
| DELETE | `/api/trackers/weight/:id` | Home, Undo | [patient-dashboard](patient-dashboard.md) |
| GET | `/api/eligibility` | Home, Book, Reports, onboarding | [patient-dashboard](patient-dashboard.md) |
| GET | `/api/subscriptions/recommended` | Plans | [patient-dashboard](patient-dashboard.md) |
| GET | `/api/schedule/available-slots?date=` | Book a consultation | [consultations-and-care](consultations-and-care.md) |
| PATCH | `/api/appointments/:appointmentId/reschedule` | Appointments, Change time | [consultations-and-care](consultations-and-care.md) |
| GET | `/api/care-team` | Care, Messages, chat header | [consultations-and-care](consultations-and-care.md) |
| GET | `/api/care/prescription/current` | Care | [consultations-and-care](consultations-and-care.md) |
| GET | `/api/care/medicine-orders` | Care | [consultations-and-care](consultations-and-care.md) |
| GET | `/api/chat/sessions/:sessionId/messages` | Chat (patient and doctor) | [consultations-and-care](consultations-and-care.md) |
| GET | `/api/onboarding/config` | Onboarding | [onboarding](onboarding.md) |
| GET | `/api/onboarding/status` | Onboarding | [onboarding](onboarding.md) |
| GET | `/api/care-packages` | Onboarding, blood test step | [onboarding](onboarding.md) |
| GET | `/api/reports` | Reports | [reports](reports.md) |
| POST | `/api/reports` | Reports, onboarding, `/pricing` | [reports](reports.md) |
| GET | `/api/labs/packages` | Lab booking, package step | [lab-tests-redcliffe](lab-tests-redcliffe.md) |
| GET | `/api/labs/packages/:code` | Lab booking, "What is tested" | [lab-tests-redcliffe](lab-tests-redcliffe.md) |
| GET | `/api/labs/locations/search?query=&latitude=&longitude=` | Lab booking, new address | [lab-tests-redcliffe](lab-tests-redcliffe.md) |
| GET | `/api/labs/locations/reverse?latitude&longitude` | Lab booking, Use my current location | [lab-tests-redcliffe](lab-tests-redcliffe.md) |
| GET | `/api/labs/locations/:eloc` | Lab booking, new address | [lab-tests-redcliffe](lab-tests-redcliffe.md) |
| GET | `/api/labs/serviceability?latitude&longitude` | Lab booking, address step | [lab-tests-redcliffe](lab-tests-redcliffe.md) |
| GET | `/api/labs/slots?date&addressId` | Lab booking, time step; Change time | [lab-tests-redcliffe](lab-tests-redcliffe.md) |
| POST | `/api/labs/bookings` | Lab booking, review | [lab-tests-redcliffe](lab-tests-redcliffe.md) |
| GET | `/api/labs/bookings` | Lab tests list | [lab-tests-redcliffe](lab-tests-redcliffe.md) |
| GET | `/api/labs/bookings/:id` | Booking page, Home | [lab-tests-redcliffe](lab-tests-redcliffe.md) |
| POST | `/api/labs/bookings/:id/reschedule` | Booking page, Change time | [lab-tests-redcliffe](lab-tests-redcliffe.md) |
| POST | `/api/labs/bookings/:id/cancel` | Booking page, Cancel | [lab-tests-redcliffe](lab-tests-redcliffe.md) |
| GET | `/api/labs/bookings/:id/report` | Booking page, Reports | [lab-tests-redcliffe](lab-tests-redcliffe.md) |
| POST | `/api/webhooks/redcliffe` | none (Redcliffe calls it) | [lab-tests-redcliffe](lab-tests-redcliffe.md) |
| POST | `/api/payments/orders` | Checkout | [payments-razorpay](payments-razorpay.md) |
| POST | `/api/payments/verify` | Checkout | [payments-razorpay](payments-razorpay.md) |
| GET | `/api/payments` | Plans, Invoices | [payments-razorpay](payments-razorpay.md) |
| POST | `/api/webhooks/razorpay` | none (Razorpay calls it) | [payments-razorpay](payments-razorpay.md) |
| GET | `/api/doctor/patients/:patientId/record` | Doctor: Record, Today, Messages, Notes | [doctor-dashboard](doctor-dashboard.md) |
| GET | `/api/doctor/patients/snapshots` | Doctor: Patients, Messages, Notes | [doctor-dashboard](doctor-dashboard.md) |
| GET | `/api/doctor/queue` | Doctor: Today, Patients, Record | [doctor-dashboard](doctor-dashboard.md) |
| GET | `/api/doctor/work-counts` | Doctor: navigation badges | [doctor-dashboard](doctor-dashboard.md) |
| GET | `/api/doctor/patients/:patientId/photos` | Doctor: Record, Progress photos | [doctor-dashboard](doctor-dashboard.md) |
| POST | `/api/doctor/patients/:patientId/photos/viewed` | Doctor: Record, "Show photos" | [doctor-dashboard](doctor-dashboard.md) |
| POST | `/api/doctor/patients/:patientId/symptoms/:symptomId/acknowledgement` | Doctor: Record, Messages | [doctor-dashboard](doctor-dashboard.md) |
| DELETE | `/api/doctor/patients/:patientId/symptoms/:symptomId/acknowledgement` | Doctor: Undo | [doctor-dashboard](doctor-dashboard.md) |
| POST | `/api/doctor/patients/:patientId/labs/:labId/review` | Doctor: Record, Labs | [doctor-dashboard](doctor-dashboard.md) |
| POST | `/api/doctor/patients/:patientId/prescriptions/:prescriptionId/sign` | Doctor: Record, Prescriptions | [doctor-dashboard](doctor-dashboard.md) |
| POST | `/api/doctor/patients/:patientId/private-notes` | Doctor: Record, Private notes | [doctor-dashboard](doctor-dashboard.md) |
| POST | `/api/doctor/patients/:patientId/plan-recommendation` | Doctor: Record, Programme plan | [doctor-dashboard](doctor-dashboard.md) |
| DELETE | `/api/doctor/patients/:patientId/plan-recommendation` | Doctor: Record, Programme plan | [doctor-dashboard](doctor-dashboard.md) |
| GET | `/api/doctor/notes` | Doctor: Notes, Record | [doctor-dashboard](doctor-dashboard.md) |
| GET | `/api/doctor/notes/:noteId` | Doctor: Note review | [doctor-dashboard](doctor-dashboard.md) |
| PUT | `/api/doctor/notes/:noteId` | Doctor: Note review | [doctor-dashboard](doctor-dashboard.md) |
| POST | `/api/doctor/notes/:noteId/sign` | Doctor: Note review | [doctor-dashboard](doctor-dashboard.md) |
| POST | `/api/doctor/notes/:noteId/addenda` | Doctor: Note review | [doctor-dashboard](doctor-dashboard.md) |
| GET | `/api/chat/doctor/sessions` | Doctor: Messages | [doctor-dashboard](doctor-dashboard.md) |
| POST | `/api/chat/sessions/:sessionId/read` | Doctor: Messages | [doctor-dashboard](doctor-dashboard.md) |
| POST | `/api/chat/sessions/:sessionId/no-reply-needed` | Doctor: Messages | [doctor-dashboard](doctor-dashboard.md) |
| DELETE | `/api/chat/sessions/:sessionId/no-reply-needed` | Doctor: Messages, Undo | [doctor-dashboard](doctor-dashboard.md) |

### Changes proposed to existing endpoints

| Method | Path | Change | Doc |
| --- | --- | --- | --- |
| PATCH | `/api/onboarding/step` | accept one step at a time; new fields `firstName`, `lastName`, `ageYears`, `weightLossExperience`, `conditions`, `noConditions`, `consents` | [onboarding](onboarding.md) |
| POST | `/api/onboarding/complete` | `ageYears` in place of `dateOfBirth`; check steps 6 to 8 and the required consents | [onboarding](onboarding.md) |
| PUT | `/api/schedule/book` | refuse a patient who is not `APPROVED` or has no unused prepaid first consultation | [consultations-and-care](consultations-and-care.md) |
| POST | `/api/subscriptions/activate` | restrict to staff once `PLAN` payments activate plans | [payments-razorpay](payments-razorpay.md) |
| GET | `/api/doctor/me` | add `qualification` | [doctor-dashboard](doctor-dashboard.md) |
| GET | `/api/appointments/doctor` | add `visitType` | [doctor-dashboard](doctor-dashboard.md) |

### For designs not built yet (the app does not call these)

| Method | Path | Design piece | Doc |
| --- | --- | --- | --- |
| GET | `/api/notifications` | Notifications bell and list | [patient-dashboard](patient-dashboard.md) |
| PATCH | `/api/notifications/:id/read` | Notifications | [patient-dashboard](patient-dashboard.md) |
| POST | `/api/trackers/symptoms` | "Log a symptom" on Home | [patient-dashboard](patient-dashboard.md) |
| GET | `/api/patient/prescriptions` | Weekly medicine card, device guides | [patient-dashboard](patient-dashboard.md) |
| POST | `/api/trackers/medication` | The medication log | [patient-dashboard](patient-dashboard.md) |
| GET | `/api/subscriptions/me` | Plan sheet: dates | [patient-dashboard](patient-dashboard.md) |
| POST | `/api/subscriptions/me/change` | Plan sheet: pause or cancel | [patient-dashboard](patient-dashboard.md) |
| POST | `/api/patient/data-export` | Download my data | [patient-dashboard](patient-dashboard.md) |
| POST | `/api/patient/delete-request` | Delete my account | [patient-dashboard](patient-dashboard.md) |
