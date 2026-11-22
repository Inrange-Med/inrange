# Consultation to prescription to payment: one obvious step at a time

**PRD for Arhaan** · 18 Nov 2026

**Source:** call with Sachchidanand, 17 Nov 2026 (English transcript: `call-2026-11-17-transcript-en.md`).

**Focus:** the video call, the prescription and the medicines, end to end. Anything else in the doctor and patient apps that isn't part of this flow gets hidden. Admin, sales and website items from the call are in the transcript summary and are not part of this.

---

## The rules

Doctors and patients are not comfortable with software (Sachchidanand: *“lay everything out on the plate in front of them”*). So:

1. **One next step, one big button.** Every screen says what to do now, in words, with a single main button. Nothing else competes with it.
2. **Nothing to find.** No menus, no `...`, no icon-only buttons, no pop-ups on the main path.
3. **Always say what happened.** “Saved”, “Sent to patient, 7:42 pm”, “Paid”.
4. **Fill in what we know.** Never ask for something the system already has. Never lose what someone typed.
5. **Cut the rest.** If it isn't the call, the prescription, the medicines, lab tests or payment, it comes off these screens.

---

# Doctor

Three places only: **Today**, **History**, **Availability**.

## 1. Today (the schedule)

```
+--------------------------------------------------------------------------+
| Do this now                                                              |
|  7:00 pm  Riya Sharma, 34 F, first consultation                          |
|  The call is open.     [ Join video call -> ]  [ Write prescription ]    |
|                                                                          |
|  Yesterday 6:30 pm  Amit Verma, 41 M, follow-up                          |
|  Prescription not written yet.          [ Write prescription -> ]        |
|                                                                          |
| Consultations   [ < ]  Tuesday 17 November  [ > ]   [ Pick date ]        |
|  5:00 pm  Neha Gupta    Not sent to patient yet     [ Send ]             |
|  6:00 pm  Rahul Jain    Sent 6:52 pm                [ View PDF ]         |
|  8:00 pm  Karan Mehra   Starts at 8:00 pm           [ Open ]             |
+--------------------------------------------------------------------------+
```

- **Do this now** pulls in anything waiting on the doctor, from any date: a call that's open, a prescription not written, a prescription not sent.
- **Below it, the day's consultations.** The arrows and date picker change only this list.
- Every consultation shows one status in words and one button:

| Status | Button |
|---|---|
| Starts at 8:00 pm | Open (read reports early) |
| Call open now (from 10 min before) | **Join video call** |
| Prescription not written yet | **Write prescription** |
| Not sent to patient yet | **Send to patient** |
| Sent 7:42 pm | View PDF |

- Show only start times, never how long a consultation lasts (house rule).

## 2. The call opens in a new tab

- **Join video call** opens the call in a **new browser tab**. The consultation page stays open in the first tab so the doctor writes while talking. This was Sachchidanand's first ask. Today the button replaces the page.
- Pressing Join again goes back to the call tab that's already open. It never starts a second call.
- When the call ends, the call tab says “Call ended. Finish the prescription in your other tab.” and has a **Close this tab** button.
- The doctor's WhatsApp reminder links straight to this consultation's page.

## 3. The consultation page (reports and prescription)

One page per consultation, top to bottom:

```
+--------------------------------------------------------------------------+
| Riya Sharma  34, Female  First consultation  Tue 17 Nov 7:00 pm          |
|                                              [ Join video call -> ]      |
| Reports                                                                  |
|  Blood test, 82 markers   15 Nov 2026                      [ Open ]      |
|  Thyroid (uploaded)        2 Sep 2026                      [ Open ]      |
| Last prescription (follow-ups)   18 Oct    [ Copy into today's ]         |
|                                                                          |
| Prescription                                             Saved 7:14 pm   |
|  Age 34  Sex F  Height 162 cm  Weight 82.6 kg  BMI 31.5   (filled in)    |
|  Allergies: none known                                    (filled in)    |
|  Diagnosis        [                                    ]                 |
|  Patient history  [                                    ]                 |
|  Remarks          [                                    ]                 |
|  Medicines        [ type to search...  ]  (see 4)                        |
|  Advice           [                                    ]                 |
|                                                                          |
|                             (fixed at the bottom) [ Create PDF -> ]      |
+--------------------------------------------------------------------------+
```

- **Reports come first:** every report on the account, any date, each one opening its PDF. Today they're buried in the patient's notes.
- **Filled in for the doctor:** age, sex, height, weight, BMI and allergies.
- **Only diagnosis is required.** The prescription saves as the doctor types.

## 4. Medicines

```
|  1  Metformin 500 mg tablet (metformin)                    [ Remove ]    |
|     Dose  [ 1 tablet ]                                                   |
|     How often  (1-0-0) (0-0-1) (1-0-1) (1-1-1) (Once a week) (Other)     |
|     For   [ 30 ] (days) (weeks) (months)                                 |
|     Take  (Before food) (After food) (Empty stomach)                     |
|  [ + Add another medicine ]                                              |
```

- **Search the PDPL master list** (medicines and supplements). Typing “rybelsus” must find “Tablet Rybelsus 3 mg”: ignore case, spaces and words like tab, tablet and cap.
- **Tap, don't type:** dose is pre-filled, and how often, for how long and with food are tap choices.
- **Copy into today's** fills the medicines from the last prescription.
- **Not on the list:** show “Did you mean...” first. If the doctor still adds it, it prints on the prescription but can't be ordered until admin matches it to a real item (this stops duplicates).

## 5. Create, view, send

1. **Create PDF**: the PDF appears **right there on the page**, exactly what the patient gets.
2. **Send to patient**: one press, no “are you sure”. The PDF above is the check. The patient gets it on WhatsApp and in their app, and the medicines go to their cart.
3. The page reads **“Sent to patient, 7:42 pm”** and offers **Send again** and **Edit and send new version**. A new version replaces the old one for the patient.

The PDF carries the doctor's name, qualifications, registration number and signature. **CONFIRM with counsel** (Telemedicine Practice Guidelines 2020).

**Done** means the prescription was sent. Sachchidanand parked this question, so confirm it with him.

## 6. History

All past consultations, newest first. It has a name search and a date range, and each row has the same status and button as Today. No patient phone numbers (Sachchidanand).

## 7. Availability

One page: weekly hours (a row per day: on or off, from, to) and **Add a day off**. It's today's Hours page, kept and simplified. The booking team books only into these hours.

## Cut from the doctor's view

Patients list, Notes (AI call notes), Messages, the month calendar, and the record panels (safety strip, trackers, photos, private notes, plan, activity). Remove them from the doctor's navigation, send old links to Today, and keep the code.

---

# Patient

One screen: **Home**. It shows **one card with the next step** and below it three plain rows: **Prescriptions**, **Lab reports**, **Payments**. Their name, top right, opens the profile.

```
+--------------------------------------+
| Hi Riya                              |
|  +--------------------------------+  |
|  | Your video call with           |  |
|  | Dr. Mehta is open              |  |
|  | Today, 7:00 pm                 |  |
|  |                                |  |
|  | [     Join video call  ->    ] |  |
|  +--------------------------------+  |
|                                      |
|  Prescriptions                    >  |
|  Lab reports                      >  |
|  Payments                         >  |
+--------------------------------------+
```

## The next-step card, stage by stage

| Stage | The card says | Button |
|---|---|---|
| Blood test needed | Book your home blood test, or upload a recent report | **Book home test** (Upload report, smaller) |
| Test booked | Sample collection Thu 19 Nov, 7 to 9 am | none |
| Waiting for report | Your report is being prepared | none |
| Report ready | Your report is ready. We'll call you to book your doctor. | **View report** |
| Call booked | Video call with Dr. Mehta, Tue 17 Nov, 7:00 pm. Join opens at 6:50 pm. | **Join video call** (live from 10 min before) |
| After the call | Your doctor is writing your prescription | none |
| Prescription sent | Your prescription is ready | **View prescription** |
| Payment due | Your plan and medicines: itemised bill on the card | **Pay ₹X** |
| Paid | Medicines on the way. Arriving Thu 26 Nov. | **Track delivery** |
| Follow-up booked | Same as “Call booked” | **Join video call** |

Whenever something costs money, the itemised bill sits on the card above the **Pay** button. One payment covers the plan and the medicines where possible. If the backend needs two payments, they show as two steps, one after the other.

## Each piece, kept simple

- **Call:** Join opens a camera check with one big **Join now**. When the call ends, the card moves on to “Your doctor is writing your prescription”.
- **Prescription:** opens the PDF with **Download** beside it. It also arrives on WhatsApp.
- **Lab tests:** book a home collection (date, time slot, address already filled in) or upload a PDF. Status is one line. When the report is ready it opens straight away.
- **Payments:** UPI first, with the bill above the button. Afterwards, “Paid” with the receipt, kept under Payments.

## Cut from the patient's view

The weight card and logging, the programme card, the care team cards, the doses tracker, Resources, and Messages (WhatsApp is the support channel). Remove them from the patient's navigation and keep the code. Confirm Messages with Shivam.

---

# Done when

- A doctor can go from Today to Join (in a new tab), write the prescription during the call, create the PDF, see it on the page and send it, with no navigation.
- Anything unwritten or unsent shows on Today until it's sent.
- A patient always sees exactly one next step on Home, from blood test to delivery, with one button.
- Every screen works at 390px, with buttons at least 48px tall and no icon-only controls.

# Where it lives in the code (`inrange/src/app/`)

| Change | Files |
|---|---|
| Doctor navigation (3 places) | `doctor-dashboard/components/DoctorShell.tsx` |
| Same-tab call bug | `doctor-dashboard/components/today/NextPatientCard.tsx` (a `<Link>` to `/consultation/<id>`) |
| Today | `doctor-dashboard/components/today/TodayView.tsx`, `components/AppointmentRow.tsx` |
| Consultation page (new) | `doctor-dashboard/consultations/[appointmentId]/`. Reuse `patients/[patientId]/components/LabsPanel.tsx` and the medicine search in `notes/[noteId]/components/AddMedicineSheet.tsx` |
| Call tab end screen | `consultation/[appointmentId]/components/ConsultationRoom.tsx`, `CallEnded.tsx` |
| Availability | `doctor-dashboard/hours/` |
| Patient Home and next step | `patient-dashboard/components/home/HomeView.tsx`, `NextStepStrip.tsx`, `components/PatientShell.tsx` |
| Patient prescription, labs, pay | `patient-dashboard/care/components/PrescriptionSheet.tsx`, `lab-tests/`, `checkout/`, `care/cart/`, `components/ItemisedBill.tsx` |

**Backend adds:** prescription `diagnosis`, `patientHistory`, `remarks`, per-medicine `intake`, and `sentAt`; create and send as two separate steps; the PDPL medicine list with forgiving search; a list of consultations waiting on the doctor; one next-step stage per patient.
