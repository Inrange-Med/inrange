# Onboarding

## Purpose

What `/onboarding` sends: eight questions, each saved the moment the patient presses Continue, then
the finished profile, then the blood test step (upload a recent report, or buy a lab-and-consultation
package). The step after the questions decides the patient's eligibility path.

- Screen: `/onboarding` (`src/app/onboarding/`).
- Services: `onboardingService`, then `reportService`, `carePackageService`, `labTestService`.
- Types: `src/types/onboarding.ts`, `carePackage.ts`.

All requests send `Authorization: Bearer <accessToken>`. A non-2xx status or `success: false` shows
`message` under the answers, so make it a sentence a patient can read ("Enter a weight between 30
and 250 kg.").

## Endpoints

| Method | Path | Status | Service function | Used for |
| --- | --- | --- | --- | --- |
| GET | `/api/onboarding/config` | PROPOSED | `onboardingService.getOnboardingConfig` | answer lists and consent wording |
| GET | `/api/onboarding/status` | PROPOSED | `onboardingService.getOnboardingStatus` | resume where the patient left off |
| PATCH | `/api/onboarding/step` | exists; new fields PROPOSED | `onboardingService.saveOnboardingStep` | save one question's answer |
| POST | `/api/onboarding/complete` | exists; `ageYears` in place of `dateOfBirth` PROPOSED | `onboardingService.completeOnboarding` | finish the profile |
| GET | `/api/eligibility` | PROPOSED (patient-dashboard.md) | `eligibilityService.getMyEligibility` | skip the blood test step once a path is chosen |
| POST | `/api/reports` | PROPOSED (reports.md) | `reportService.uploadReport` | "yes": the report, `purpose=ELIGIBILITY` |
| GET | `/api/care-packages` | PROPOSED | `carePackageService.listCarePackages` | "no": the package with lab tests |
| POST | `/api/labs/bookings` | PROPOSED (lab-tests-redcliffe.md) | `labTestService.createLabBooking` | "no": hold the collection slot, with `carePackageCode` |

## Requests and responses

### PATCH `/api/onboarding/step` (exists; new fields PROPOSED)

Today the backend reads flat fields: `mobile`, `fullName`, `email`, `dateOfBirth`, `gender`
(`"Male" | "Female" | "Other"`), `weightKg`, `heightCm`. The app keeps those names and sends **one
step at a time**, so accept a partial body. Every body carries `step` (1 to 8) and `mobile`.

| Step | Question | Body | Already accepted? |
| --- | --- | --- | --- |
| 1 | Name and email | `{ "step": 1, "mobile": "9876543210", "fullName": "Asha Rao", "firstName": "Asha", "lastName": "Rao", "email": "asha@example.com" }` | `fullName`, `email` yes. **New:** `firstName`, `lastName` (last name may be `""`). |
| 2 | Gender | `{ "step": 2, "mobile": "9876543210", "gender": "Female" }` | yes |
| 3 | Age | `{ "step": 3, "mobile": "9876543210", "ageYears": 41 }` | **New:** `ageYears` (integer, 18 to 90). `dateOfBirth` is never sent. |
| 4 | Height | `{ "step": 4, "mobile": "9876543210", "heightCm": 165.1 }` | yes (one decimal; feet and inches converted to cm) |
| 5 | Weight | `{ "step": 5, "mobile": "9876543210", "weightKg": 82.6 }` | yes (one decimal; lb converted to kg). The baseline weight. |
| 6 | Tried before | `{ "step": 6, "mobile": "9876543210", "weightLossExperience": ["SELF_DIET", "PROGRAMME"] }` | **New.** Codes: `FIRST_TIME`, `SELF_DIET`, `PROGRAMME`, `DOCTOR_MEDS`, `SURGERY`. `FIRST_TIME` is never combined with another. |
| 7 | Conditions | `{ "step": 7, "mobile": "9876543210", "noConditions": false, "conditions": [{ "code": "T2D" }, { "code": "OTHER", "otherText": "Asthma" }] }` | **New.** Codes: `T2D`, `PREDIABETES`, `BP`, `PCOS`, `THYROID`, `FATTY_LIVER`, `LIPIDS`, `SLEEP_APNOEA`, `HEART`, `KIDNEY`, `OTHER`. "None of these" is `{ "noConditions": true, "conditions": [] }`. Saving replaces the previous list. |
| 8 | Consent | `{ "step": 8, "mobile": "9876543210", "consents": [{ "type": "TERMS", "version": "2026-09", "accepted": true }, { "type": "PRIVACY", ... }, { "type": "HEALTH_DATA", ... }, { "type": "TELECONSULT", ... }, { "type": "AI", ... }] }` | **New.** See Notes, consent storage. |

Response: `{ "success": true, "message": "Saved", "data": { "currentStep": 4 } }` (only a 2xx is
needed).

### POST `/api/onboarding/complete` (exists; change PROPOSED)

Sent once, after step 8 saves and before the blood test step. The flat shape the controller reads,
with `ageYears` in place of `dateOfBirth`:

```json
{ "mobile": "9876543210", "fullName": "Asha Rao", "email": "asha@example.com", "gender": "Female", "ageYears": 41, "heightCm": 165.1, "weightKg": 82.6 }
```

Response: `{ "success": true, "message": "Profile complete", "data": { "bmi": 30.3 } }` (only a 2xx
is needed).

### GET `/api/onboarding/status` (PROPOSED)

So "Save and exit" and a later return pick up at the right question. On 404 the screen starts at
question 1 with empty answers.

```json
{
  "success": true,
  "data": {
    "currentStep": 4,
    "lastCompletedStep": 3,
    "completed": false,
    "answers": {
      "firstName": "Asha", "lastName": "Rao", "email": "asha@example.com", "gender": "Female", "ageYears": 41,
      "heightCm": null, "weightKg": null, "weightLossExperience": [], "conditions": null, "noConditions": false,
      "consents": [{ "type": "TERMS", "version": "2026-09", "accepted": true }]
    }
  }
}
```

- `currentStep`: the first unanswered question (1 to 8); 8 when all are answered but not completed.
- `lastCompletedStep`: 0 if nothing is saved; above 0 the screen says "Welcome back. Your answers are saved."
- `answers` uses the PATCH names; `conditions` is `null` until step 7. `fullName` alone is also
  understood (split into first and last name) for older profiles.

### GET `/api/onboarding/config` (PROPOSED)

The answer lists and consent wording, so they can change without a release. On 404 (or a list left
out) the app uses its bundled copy, `BUNDLED_CONFIG` in `src/app/onboarding/onboardingOptions.ts`,
which is also the right starting content. Keep the codes `FIRST_TIME` (never combined), `OTHER`
(asks for `otherText`) and `PCOS` (hidden when gender is `Male`).

```json
{
  "success": true,
  "data": {
    "consentVersion": "2026-09",
    "genders": [{ "code": "Male", "label": "Male" }, { "code": "Female", "label": "Female" }, { "code": "Other", "label": "Other" }],
    "experiences": [{ "code": "FIRST_TIME", "label": "This is my first real attempt" }, { "code": "SELF_DIET", "label": "Diet and exercise on my own" }],
    "conditions": [{ "code": "T2D", "label": "Type 2 diabetes" }, { "code": "OTHER", "label": "Something else" }],
    "consents": [
      { "type": "TERMS", "title": "Terms of service", "line": "How InRange works, what it costs and how to cancel.", "more": "You are 18 or over and ...", "required": true },
      { "type": "AI", "title": "Call transcription", "line": "An AI scribe drafts your doctor's notes from your video calls.", "more": "If you agree, ...", "required": false }
    ]
  }
}
```

### GET `/api/care-packages` (PROPOSED)

Prices are the backend's; the app shows them as sent. On 404 the "no" path says booking a home blood
test is not available yet. `labPackageCode` must be a code `GET /api/labs/packages` also returns.

```json
{
  "success": true,
  "data": [
    { "code": "CONSULT_ONLY", "name": "Consultation", "description": "A video consultation with a doctor.", "priceRupees": 999, "includesLabTests": false, "labPackageCode": null, "includes": ["Video consultation with a doctor", "A call with your health coach"] },
    { "code": "LAB_AND_CONSULT", "name": "Lab tests and consultation", "description": "Home blood tests by Redcliffe Labs, then your consultation.", "priceRupees": 1499, "includesLabTests": true, "labPackageCode": "MD028", "includes": ["Blood tests at home", "Video consultation with a doctor", "A call with your health coach"] }
  ]
}
```

## Notes

- **Free check first (12 Nov 2026).** Signed-out visitors answer questions 2 to 7 on the public
  `/assessment` page. After sign-in, onboarding saves those answers with `PATCH /api/onboarding/step`
  (steps 2 to 7 in order) before showing anything, then asks only question 1 (name and email, unless
  already saved) and question 8 (consent). So steps 2 to 7 can arrive before step 1.
- **No consultation length anywhere (12 Nov 2026).** Package `description` and `includes` must not
  state a duration; the app strips one if it does. Never list lab tests by name in `includes`.

- **Order of calls.** (1) `status` and `config` together on open. When status says
  `completed: true`, or the URL is `/onboarding?step=report`, `GET /api/eligibility` decides: no path
  yet (`NOT_STARTED`, or a 404) opens the blood test question; otherwise the patient goes to
  `/patient-dashboard`. (2) `PATCH step` once per question. (3) `POST complete` right after step 8.
  (4) The blood test step.
- **Blood test step**, "Do you have a blood test report from the last 3 months?" (the answer itself
  is not saved):
  - Yes (`OWN_REPORT`): `POST /api/reports` with `purpose=ELIGIBILITY`. Nothing to pay. Suggested
    effect: eligibility `path: "OWN_REPORT"`, `stage: "UNDER_REVIEW"`.
  - No (`LAB_TEST`): `GET /api/care-packages` (those with `includesLabTests`), their Redcliffe tests
    (`GET /api/labs/packages/:labPackageCode`), then the lab booking ending in `POST /api/labs/bookings`
    with `carePackageCode` and checkout
    `/patient-dashboard/checkout?purpose=LAB_BOOKING&referenceId=<labBookingId>&returnTo=/patient-dashboard`.
    The backend charges the package price and marks the first consultation paid on payment.
    Suggested effect: `path: "LAB_TEST"`, `stage: "AWAITING_PAYMENT"`, then `LAB_SCHEDULED` once paid.
- **Validation** (the app checks too; the backend is the source of truth): first name not empty,
  email valid, `ageYears` 18 to 90, `heightCm` 120 to 220, `weightKg` 30 to 250, at least one
  `weightLossExperience` code, step 7 either `noConditions: true` or at least one known code (with
  `otherText` for `OTHER`), step 8 all four required consents present.
- **Complete.** Stop requiring `dateOfBirth`; accept `ageYears` (store it with the date recorded).
  Check steps 6 to 8 were saved and the four required consents are active, else 400 with a message.
  Suggested work: mark onboarding done (so `verify-otp` answers `nextScreen: "DASHBOARD"`), record
  `weightKg` as the first weight log (source `ONBOARDING`), work out BMI.
- **Consent storage.** `TERMS`, `PRIVACY`, `HEALTH_DATA` and `TELECONSULT` are required; `AI` (an AI
  scribe transcribing video calls) is optional and present only when ticked. A missing type means not
  given or withdrawn. Store one row per consent: `userId`, `consentType`, `version`, `acceptedAt`
  (server time), `revokedAt` (null while active). When a later step-8 save omits an active type, set
  its `revokedAt` instead of deleting it. `version` is `consentVersion` from config (bundled: `2026-09`).
