# Doctor portal v2: the consultation, the prescription and the patient's one next step

## Purpose

The 17 Nov 2026 call with Sachchidanand (PRD: [doctor-portal-v2-prd.md](doctor-portal-v2-prd.md)) asked for a portal a
doctor who is not comfortable with software can use without help: "lay everything out on the plate". This doc is the
contract for what was built from it.

| Who     | Screens                                                                        | Service                                      | Types                   |
| ------- | ------------------------------------------------------------------------------ | -------------------------------------------- | ----------------------- |
| Doctor  | Today, the consultation page, History, Availability, the call tab's end screen | `consultationService.ts`                     | `types/consultation.ts` |
| Patient | Home (one next-step card, three rows), Prescriptions, Payments                 | `patientHomeService.ts`, `paymentService.ts` | `types/patientHome.ts`  |
| Admin   | The medicine queue's "Match a medicine" task                                   | `medicineOpsService.ts` (routes below)       | `types/medicineOps.ts`  |

Backend: `routes/consultations.ts`, `routes/home.ts`, `lib/prescriptions.ts`, `lib/medicineSearch.ts`, migration
`20261118000100_doctor_portal_v2.sql`. Journey: `supabase/tests/doctor_portal_journey.py` (66 checks, local API).

## What changed for the doctor

- **Three places only:** Today, History, Availability (the old Hours page). Schedule, Patients, Notes and Messages are
  off the navigation; `next.config.ts` sends their old links to Today (temporary redirects). Their code stays.
- **Today:** "Do this now" (an open call, a prescription not written, one not sent; any date in the last 60 days), then
  one day's consultations with arrows, Today and Pick date. Every row: the start time (never a length), the patient,
  their age, sex and visit, one sentence of state and one button.
- **Join video call opens a new tab.** Each consultation's call tab has a fixed name (`lib/consultations/callTab.ts`), so
  Join again brings the same tab forward and never loads a second call. Ending or leaving the call shows "Finish the
  prescription in your other tab" with Close this tab.
- **The consultation page:** the patient and Join, every report on the account (any date), then the prescription. A
  follow-up's prescription starts as a copy of the last one (diagnosis, history, medicines, advice; remarks are the
  visit's own), saved with the first change or at Create PDF, so the doctor changes only what is different (19 Nov
  2026). Age, sex, height, weight (with the change over the last month), BMI, allergies and the plan are filled in.
  Diagnosis is the only required field: "Choose from the list" opens the usual diagnoses as ticks (a dropdown, so the
  list can grow without filling the page; 19 Nov 2026 call) and the box takes anything else. Advice offers its usual
  words as taps. It saves as the doctor types. A bar fixed at the
  bottom holds the one next step: Create PDF, then Send to patient, then "Sent to patient, 7:42 pm" with Send again and
  Edit and send new version.
- **Medicines:** a forgiving search of the master list (case, spaces and words like tab, tablet, cap and inj are
  ignored: "rybelsus" finds "Tablet Rybelsus 3 mg"); the dose comes filled in; how often (every morning, every night,
  morning and night, three times a day, once a week, other: plain words, never "1-0-0", on the form and the PDF), for
  how long (1 week to 3 months, or other) and with food (not for an injection) are taps. A brand with several strengths
  shows them, so a step-up is one tap. Nothing found: "Did you mean" first,
  then "Add as typed", which prints but cannot be ordered until admin matches it.
- **WhatsApp:** the doctor's booking, moved, starting-soon and patient-waiting messages link to the consultation page.
  An hour after the call, if the prescription is not sent, the doctor gets "The prescription for your 7 pm
  consultation has not reached the patient yet" (template renamed `doctor_prescription_to_send`; templates are not yet
  submitted to Meta, so nothing to re-approve).

## Consultation states

One state per consultation, worked out on the server (`stateOf` in `routes/consultations.ts`), so Today, History and
the page always agree.

| State       | When                                                                                                | Words                                                   | Button             |
| ----------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------ |
| `UPCOMING`  | more than 10 minutes before the start                                                               | Starts at 8 pm                                          | Open               |
| `CALL_OPEN` | from 10 minutes before until the call ends (at most an hour past the end) and nothing sent          | The call is open                                        | Join video call    |
| `TO_WRITE`  | the call happened (or a draft exists) and there is no current PDF; also a new version being written | Prescription not written yet / New version not sent yet | Write prescription |
| `TO_SEND`   | the PDF is made and nothing changed since                                                           | Not sent to patient yet                                 | Send to patient    |
| `SENT`      | sent (`sent_at`, or `signed_at` for prescriptions signed from a call note)                          | Sent 7:42 pm                                            | View PDF           |
| `NO_CALL`   | its time passed and nobody joined                                                                   | No one joined the call                                  | Write prescription |
| `CANCELLED` | cancelled                                                                                           | Cancelled                                               | none               |

**Done means sent** (the PRD's reading of Sachchidanand's "Mark as done"; CONFIRM with him). Sending does not end the
appointment, so a patient whose call drops can still rejoin while the doctor sends.

## The prescription: draft, PDF, send

```
autosave (DRAFT, saved_at)  ->  Create PDF (pdf_made_at, pdf_path)  ->  Send (SIGNED, sent_at)
        ^                               |                                       |
        +---- any edit takes the PDF away (saved_at > pdf_made_at)               +-> Edit and send new version: a new DRAFT
```

- One draft per consultation (partial unique index). The first save creates it.
- **Create PDF** renders the patient's copy with the time it was made as its signature time; the PDF on the page is
  exactly what the patient gets. An edit after that makes it stale: Send refuses (409) until the PDF is made again.
- **Send** issues that same file (`issueRx` in `lib/prescriptions.ts`): the previous prescription is superseded, the
  patient's unpaid cart closes with its follow-ups, a new cart holds every line the pharmacy sells, payable at once (a first
  consultation without a plan carries one month), WhatsApp
  `RX_READY` goes (its button now opens `/patient-dashboard/prescriptions?rx=`), and the patient joins the doctor's
  care team.
- **Any time, never for a cancelled consultation** (19 Nov 2026 call: a prescription does not depend on the call, for
  example a month's refill when the doctor or the patient cannot make it): Create PDF and Send work before the call too.
- **An older consultation never replaces a newer one:** Send answers 409 when a later consultation of the patient
  already issued the current prescription, and such an older consultation drops off "Do this now".
- **The page keeps Join while the call is live** (`consultation.callOpen`), even after a mid-call Send, so a dropped
  call can be rejoined.
- **Send again** sends the WhatsApp message again. **Edit and send new version** copies the sent one into a new draft
  for the same consultation; sending it supersedes the old one. **Keep the version already sent** drops that draft.
- **Send is one send:** the draft is locked inside the transaction and must still be a DRAFT with a current PDF, so two
  presses at once send once (the other is told it was sent) and an edit that lands mid-send is refused.
- **A new version after the patient paid** does not bill again: the paid order moves to the new version (so refills
  follow it) and the new order carries only what is left to buy.
- **The doctor never chooses the plan** (19 Nov 2026 client call, reversing the plan picker of the same morning): a
  salesperson sells it on the same call, after the doctor, and admin records it. The page shows the patient's plan,
  read only ("Plan: none yet, so this prescription is for one month"); a `planId` sent to autosave is ignored and new
  carts never carry a plan. The record's "Recommend a plan" is gone for the same reason.
- **Names carry the form:** "Inj." for a pen or injection, "Tab.", "Cap.", "Syp." before the brand (compliance;
  `withForm` in `lib/medicineSearch.ts`), in the search, the lines, the record and the PDF. A name typed by hand prints
  as written.
- **Who sent it, beside it:** the record lists each version with the doctor and the time ("Edited and sent by" for a new
  version of the same consultation's), for every doctor who treats the patient. Only the current one has a PDF to
  open; replaced ones are read on the record. The PDF no longer carries the pharmacy licence (it goes on the invoice).
- **Without a plan** (the nano plan) the prescription is for one month: the page says "One month at most" above the
  medicines and Create PDF asks for 1 month or less, so the PDF never prescribes more than the order carries.
- Every Create PDF writes a new file (storage never overwrites), so the PDF can be made again after an edit.
- A consultation still to come stays UPCOMING on Today even if its prescription was written ahead. Signing a call note for a consultation whose page already holds a draft is refused (finish it on the page).
- A prescription may have no medicines (advice only): it sends with no cart.
- The PDF prints diagnosis, history (when written), the medicines (dose and how often, "For 1 month", with food), advice
  and the doctor's remarks. Signing from a call note (`signRx`, back office) is unchanged.

## The master list

`medicines` is the master list: PDPL's medicines and supplements. New columns: `kind` (`MEDICINE` or `SUPPLEMENT`),
`default_dose` ("1 tablet"), `sku` (PDPL's code). `mrp_paise` may now be empty: such an item is on the list (it prints,
and the search finds it so nobody types it again) but the pharmacy does not sell it yet, so it never reaches a cart or a
bill. Only the 14 pens are on the list today.

**Importing PDPL's list (when Ansh sends it):** load the sheet into a staging table, then upsert on `sku`:

```sql
insert into medicines (sku, brand, molecule, form, strength, pack, pack_days, route, default_frequency, default_dose, kind, mrp_paise)
select sku, brand, molecule, form, strength, pack, pack_days, coalesce(route, ''), coalesce(frequency, ''), coalesce(dose, ''),
       kind, mrp_paise from pdpl_master_staging
on conflict (sku) do update set brand = excluded.brand, molecule = excluded.molecule, form = excluded.form,
  strength = excluded.strength, pack = excluded.pack, pack_days = excluded.pack_days, mrp_paise = excluded.mrp_paise;
```

The internal cost of anything sold goes in `medicine_costs` (never in `medicines`). The search caches the list for five
minutes per API instance.

**A medicine typed by hand** is saved with `unlisted: true`. Sending opens one `MATCH_MEDICINE` task (HIGH, due within
4 working hours) in the medicine queue. Admin matches each line to a list item; the line takes the item, and while the
prescription is current and the item is sold, its packs join the open cart (or start one). The task closes when
nothing is left to match. The patient's PDF stays as it was signed. Matching is locked per prescription (two lines matched at once never undo each other),
carries one month for a patient without a plan, as Send does, and when it starts the prescription's first order it
starts that order's follow-up too.

## What changed for the patient

- **Home is the one place:** a greeting, one card with the next step and at most one button, and three rows:
  Prescriptions, Lab reports, Payments. Their name, top right, opens the profile. No tabs, no dock. The weight card,
  programme card, care team, doses, Resources and Messages are off Home and the navigation; their code stays.
- **Prescriptions:** the current one first, its medicines in plain words, View prescription and Download; the ones it
  replaced below.
- **Payments:** every payment, "Paid" with the date, receipt number and amount.
- **The call:** the camera check ends in one "Join now". When the call ends: "Your doctor is writing your
  prescription. It comes to you on WhatsApp and in the app."

## The next step

`GET /api/patient/next-step` answers one stage; the app words it (`NextStepCard.tsx`). The first that applies wins:

| Stage                                                                                                                                                      | Card                                                                     | Button                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `CALL_OPEN`                                                                                                                                                | Your video call with Dr. X is open                                       | Join video call                                                                            |
| `PAYMENT_DUE` (`payFor` MEDICINES; `withPlan` only for carts made before 19 Nov 2026 evening)                                                                        | Your plan and medicines, with the itemised bill                          | Pay ₹X (checkout; no address yet: the cart page)                                           |
| `CALL_BOOKED`                                                                                                                                              | Video call with Dr. X, Tue 17 Nov, 7 pm. Join opens at 6:50 pm.          | none                                                                                       |
| `AFTER_CALL`                                                                                                                                               | Your doctor is writing your prescription                                 | none                                                                                       |
| `ON_THE_WAY`                                                                                                                                               | Your medicines are on the way. Arriving Thu 26 Nov.                      | Track delivery                                                                             |
| `DELIVERED` (2 days)                                                                                                                                       | Your medicines arrived                                                   | View prescription                                                                          |
| `PRESCRIPTION_SENT` (30 days)                                                                                                                              | Your prescription is ready (and when the order opens, for the nano plan) | View prescription                                                                          |
| before the first consultation: `LAB_UNPAID`, `TEST_BOOKED`, `WAITING_FOR_REPORT`, `UNDER_REVIEW`, `NOT_APPROVED`, `BOOK_CONSULTATION`, `BLOOD_TEST_NEEDED` | from the eligibility review, as before                                   | Pay / none / none / View report / Upload a newer report / Book video call / Book home test |
| `IN_CARE`                                                                                                                                                  | You're all set                                                           | Book your review                                                                           |

One bill, one payment for the prescription's medicines. The plan is sold by a salesperson, not prescribed; carts made
before that change may still carry one as a line. A plan recommended earlier (`plan_recommendations`) is billed only
when there is no cart.

## Endpoints

| Method and path                                           | Who                      | Answer                                                                                    |
| --------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `GET /api/doctor/consultations?date=YYYY-MM-DD`           | doctor                   | `{ date, day: Row[], waiting: Row[] }`                                                    |
| `GET /api/doctor/consultations/history?from=&to=&q=`      | doctor                   | `{ from, to, consultations: Row[] }` (default: the last 30 days; 300 at most)             |
| `GET /api/doctor/consultations/:id`                       | doctor                   | `{ consultation, patient, reports, lastPrescription, prescription }` (audited)            |
| `PUT /api/doctor/consultations/:id/prescription`          | doctor                   | `{ diagnosis?, patientHistory?, remarks?, advice?, medicines? }` -> Prescription     |
| `POST /api/doctor/consultations/:id/prescription/pdf`     | doctor                   | Prescription with `pdf`; 422 with the first gap ("Write the diagnosis first.")            |
| `POST /api/doctor/consultations/:id/prescription/send`    | doctor                   | Prescription, `status: SENT`; 409 when the PDF is stale                                   |
| `POST /api/doctor/consultations/:id/prescription/resend`  | doctor                   | Prescription with `resentAt`                                                              |
| `POST /api/doctor/consultations/:id/prescription/revise`  | doctor                   | the new draft                                                                             |
| `POST /api/doctor/consultations/:id/prescription/discard` | doctor                   | "Keep the version already sent": drops the new draft; the sent Prescription               |
| `GET /api/medicines/search?q=`                            | doctor, admin            | `{ matches: ListItem[], didYouMean: ListItem[] }`                                         |
| `GET /api/patient/next-step`                              | patient                  | the stage above                                                                           |
| `GET /api/care/prescriptions`                             | patient                  | `{ prescriptions: [...] }`, newest first                                                  |
| `GET /api/admin/medicine/tasks/:taskId/unmatched`         | admin                    | `{ prescriptionId, current, lines }`                                                      |
| `POST /api/admin/medicine/tasks/:taskId/match`            | admin                    | `{ line, medicineId }` -> `{ left }`                                                      |
| `GET /api/files/prescriptions/:id`                        | patient, treating doctor | now also superseded ones (the patient's list), and a draft's PDF to its own doctor only   |

A Row: `{ id, patientId, patientName, age, sex, visitType, startsAt, state, revising, sentAt, resentAt, pdf }`. No row,
page or list carries a patient's phone number.

A medicine line as saved: `{ key, medicineId | null, unlisted, orderable, medicineName, genericName, form, strength,
dose, frequencyCode, frequencyOther, frequency (words), durationValue, durationUnit, duration ("1 month"),
durationDays, intake, instructions (intake words), route, quantity (packs: duration over pack days, at least 1),
quantityLabel }`. The older keys stay, so the care tab, the cart, refills and dose reminders read it unchanged.

## Turning it on

1. Apply `20261118000100_doctor_portal_v2.sql` (adds columns, voids any older duplicate draft per consultation, then
   the one-draft index; `mrp_paise` becomes nullable).
2. Deploy the `api` function. No new secrets.
3. Deploy the web app. Old doctor links redirect to Today at once.

## Open questions

- **"Done":** sent counts as done (PRD). CONFIRM with Sachchidanand.
- **Booking after the report:** the PRD's card says "We'll call you to book your doctor"; patients still book
  themselves today, so the card says "Book your video call" until the booking team books in the back office.
- **PDPL's master list:** waiting on Ansh (Shivam and Aamer). Until then the search finds only the pens, and anything
  else is added as typed and matched by admin.
- **Messages for patients:** off Home per the PRD; CONFIRM with Shivam (WhatsApp is the support channel).
- **The PDF's legal lines** (registration, signature method, practice address): CONFIRM with counsel (Telemedicine
  Practice Guidelines 2020), as before.
