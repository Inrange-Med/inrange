# Doctor dashboard

## Purpose

Every endpoint the doctor dashboard (`/doctor-dashboard/...`, `src/app/doctor-dashboard/`, after
Arhaan's clinician prototype) calls: the doctor's day, patients and their records, call notes and
chats. Until a PROPOSED endpoint exists the screen calls it anyway, gets a 404, and shows a calm
"not available yet" line in its place. Nothing is mocked.

- Services: `doctorPortalService`, `patientRecordService`, `clinicalNoteService`, `doctorChatService`,
  plus the shared `chatService` and `videoConsultationService`.
- Types: `src/types/doctor.ts`, `patientRecord.ts`, `clinicalNote.ts`, `chat.ts`, `appointment.ts`.

Every endpoint here:

- answers `{ "success": true, "message": "...", "data": ... }` (the shapes below are `data`);
- needs `Authorization: Bearer <access token>` of a user whose role is `DOCTOR`;
- only returns or changes patients the signed-in doctor treats (403 otherwise);
- uses ISO 8601 timestamps with an offset (`2026-10-28T10:30:00+05:30`) and camelCase fields;
- writes an audit entry (who, what, when) for every read of a record and every change, which
  `GET .../record` returns as `audit` (newest first).

## Endpoints

| Method   | Path                                                                  | Status                               | Service function                                  | Screen                                                                                                                                         |
| -------- | --------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| GET      | `/api/doctor/me`                                                      | exists                               | `doctorPortalService.getMyDoctorProfile`          | Rail (name, specialisation, photo), note signature                                                                                             |
| GET      | `/api/appointments/doctor?date=YYYY-MM-DD`                            | exists                               | `doctorPortalService.listAppointmentsOn`          | Today (day list, next patient)                                                                                                                 |
| GET      | `/api/appointments/doctor`                                            | exists                               | `doctorPortalService.listAllAppointments`         | Schedule, Patients, Record, Today (next working day)                                                                                           |
| GET      | `/api/doctor/patients`                                                | exists                               | `doctorPortalService.listMyPatients`              | Patients, Record header, Messages, Notes                                                                                                       |
| GET      | `/api/doctor/availability`                                            | exists                               | `doctorPortalService.getMyAvailability`           | Hours                                                                                                                                          |
| PUT      | `/api/doctor/availability`                                            | exists                               | `doctorPortalService.saveWeeklyHours`             | Hours, Weekly hours "Save hours"                                                                                                               |
| PUT      | `/api/doctor/days-off/:date`                                          | exists                               | `doctorPortalService.addDayOff`                   | Hours, Days off "Add"                                                                                                                          |
| DELETE   | `/api/doctor/days-off/:date`                                          | exists                               | `doctorPortalService.removeDayOff`                | Hours, Days off "Remove"                                                                                                                       |
| GET      | `/api/doctor/patients/:patientId/record`                              | PROPOSED                             | `patientRecordService.getPatientRecord`           | Record, Today "Next" brief, Messages, Notes                                                                                                    |
| GET      | `/api/doctor/patients/snapshots`                                      | PROPOSED                             | `patientRecordService.listPatientSnapshots`       | Patients columns, care-week tag in Messages and Notes                                                                                          |
| GET      | `/api/doctor/queue`                                                   | PROPOSED                             | `patientRecordService.listWaitingItems`           | Today "Waiting on you", Patients filter, Record                                                                                                |
| GET      | `/api/doctor/work-counts`                                             | PROPOSED                             | `patientRecordService.getWorkCounts`              | Rail and dock badges                                                                                                                           |
| GET      | `/api/doctor/patients/:patientId/photos`                              | PROPOSED                             | `patientRecordService.listProgressPhotos`         | Record, Progress photos                                                                                                                        |
| POST     | `/api/doctor/patients/:patientId/photos/viewed`                       | PROPOSED                             | `patientRecordService.recordPhotoViewing`         | Record, "Show photos"                                                                                                                          |
| POST     | `/api/doctor/patients/:patientId/symptoms/:symptomId/acknowledgement` | PROPOSED                             | `patientRecordService.acknowledgeSymptom`         | Record safety strip, Trackers, Messages                                                                                                        |
| DELETE   | `/api/doctor/patients/:patientId/symptoms/:symptomId/acknowledgement` | PROPOSED                             | `patientRecordService.undoSymptomAcknowledgement` | the toast's Undo                                                                                                                               |
| POST     | `/api/doctor/patients/:patientId/labs/:labId/review`                  | PROPOSED                             | `patientRecordService.reviewLabReport`            | Record, Labs "Mark reviewed"                                                                                                                   |
| POST     | `/api/doctor/patients/:patientId/prescriptions/:prescriptionId/sign`  | PROPOSED                             | `patientRecordService.signPrescription`           | Record, Prescriptions "Review and sign"                                                                                                        |
| POST     | `/api/doctor/patients/:patientId/private-notes`                       | PROPOSED                             | `patientRecordService.addPrivateNote`             | Record, Private notes                                                                                                                          |
| POST     | `/api/doctor/patients/:patientId/plan-recommendation`                 | live                                 | `patientRecordService.recommendPlan`              | Record, Programme plan "Recommend a plan" `{ planId, note }`; replaces this doctor's earlier suggestion, which the patient sees first on Plans |
| DELETE   | `/api/doctor/patients/:patientId/plan-recommendation`                 | live                                 | `patientRecordService.withdrawPlanRecommendation` | Record, Programme plan "Withdraw"                                                                                                              |
| GET      | `/api/doctor/notes`                                                   | PROPOSED                             | `clinicalNoteService.listClinicalNotes`           | Notes, Record "Visits", Note review                                                                                                            |
| GET      | `/api/doctor/notes/:noteId`                                           | PROPOSED                             | `clinicalNoteService.getClinicalNote`             | Note review                                                                                                                                    |
| PUT      | `/api/doctor/notes/:noteId`                                           | PROPOSED                             | `clinicalNoteService.saveClinicalNote`            | Note review (autosave)                                                                                                                         |
| POST     | `/api/doctor/notes/:noteId/sign`                                      | PROPOSED                             | `clinicalNoteService.signClinicalNote`            | Note review, Sign                                                                                                                              |
| POST     | `/api/doctor/notes/:noteId/addenda`                                   | PROPOSED                             | `clinicalNoteService.addClinicalNoteAddendum`     | Note review, signed note                                                                                                                       |
| GET      | `/api/chat/doctor/sessions`                                           | PROPOSED                             | `doctorChatService.listMyChatSessions`            | Messages list                                                                                                                                  |
| POST     | `/api/chat/sessions/:sessionId/read`                                  | PROPOSED                             | `doctorChatService.markChatRead`                  | Messages, opening a chat                                                                                                                       |
| POST     | `/api/chat/sessions/:sessionId/no-reply-needed`                       | PROPOSED                             | `doctorChatService.markNoReplyNeeded`             | Messages, "No reply needed"                                                                                                                    |
| DELETE   | `/api/chat/sessions/:sessionId/no-reply-needed`                       | PROPOSED                             | `doctorChatService.undoNoReplyNeeded`             | the toast's Undo                                                                                                                               |
| GET      | `/api/chat/sessions/:sessionId/messages`                              | PROPOSED (consultations-and-care.md) | `chatService.listChatHistory`                     | Messages, earlier messages                                                                                                                     |
| GET/POST | `/api/chat/sessions/:sessionId/messages`                              | pilot                                | `chatService.connectToChatSession` (polling)      | Messages (live; `senderRole: "DOCTOR"`)                                                                                                        |
| GET      | `/api/video/appointments/:appointmentId/join`                         | exists                               | `videoConsultationService.joinVideoConsultation`  | "Start consultation" opens `/consultation/:appointmentId`                                                                                      |

## Requests and responses

### The patient record

#### GET `/api/doctor/patients/:patientId/record` (PROPOSED)

Also returns `planRecommendation: { planId, planName, note, recommendedAt } | null` (the newest suggestion) and `activePlan: { planName, endsAt } | null`.

Screen: Patient record (`/doctor-dashboard/patients/:patientId`), the Today "Next" brief, and the
flagged-symptom tick in Messages. Reading it is itself an audit entry ("Opened the record").

```json
{
  "programme": "Weight care",
  "city": "Gurugram",
  "careStartedAt": "2026-08-04T10:00:00+05:30",
  "identityVerified": true,
  "heightCm": 162,
  "weights": [
    {
      "at": "2026-10-20T08:10:00+05:30",
      "kg": 81.4,
      "source": "Patient logged"
    }
  ],
  "waist": { "at": "2026-09-01T10:30:00+05:30", "cm": 96 },
  "hba1c": [{ "at": "2026-08-02T09:00:00+05:30", "value": 6.1 }],
  "conditions": ["Hypertension"],
  "allergies": "No known drug allergies",
  "outsideMedicines": ["Telmisartan 40 mg once a day"],
  "consents": [
    "Terms",
    "Privacy",
    "Health data",
    "Video consultation",
    "Call transcription"
  ],
  "plan": {
    "goals": [{ "label": "Protein a day", "value": "90 g" }],
    "reviewAt": "2026-11-15T00:00:00+05:30",
    "notes": "Protein first at every meal; walk after dinner."
  },
  "concern": "Hungrier in the evenings since the dose went up.",
  "screening": null,
  "labs": [
    {
      "id": "lab_31",
      "packageName": "Metabolic panel",
      "collectedAt": "2026-10-18T07:30:00+05:30",
      "reportedAt": "2026-10-19T18:00:00+05:30",
      "status": "DOCTOR_REVIEW_PENDING",
      "results": [
        {
          "test": "HbA1c",
          "value": 5.8,
          "unit": "%",
          "range": "4.0-5.6",
          "flag": "HIGH"
        }
      ],
      "doctorComment": null,
      "reviewedAt": null
    }
  ],
  "prescriptions": [
    {
      "id": "rx_12",
      "version": 3,
      "status": "SIGNED",
      "date": "2026-10-01T11:00:00+05:30",
      "items": [
        {
          "name": "Metformin",
          "strength": "500 mg",
          "dose": "1 tablet",
          "frequency": "Twice a day with food",
          "duration": "8 weeks"
        }
      ],
      "advice": "Take with meals."
    }
  ],
  "visits": [
    {
      "id": "visit_7",
      "at": "2026-10-01T10:30:00+05:30",
      "type": "FOLLOW_UP",
      "summary": "Steady progress; mild nausea in week one.",
      "assessment": "Tolerating well.",
      "noteId": "note_44",
      "plan": ["Continue the current dose", "Book labs before the next review"]
    }
  ],
  "symptoms": [
    {
      "id": "sym_9",
      "label": "Dizziness",
      "severity": "Moderate",
      "note": "After lunch",
      "at": "2026-10-27T14:05:00+05:30",
      "requiresReview": true,
      "acknowledged": false
    }
  ],
  "adherence": { "taken": 12, "due": 14 },
  "injections": {
    "name": "Wegovy",
    "strength": "0.5 mg",
    "taken": 2,
    "perStep": 4,
    "lastAt": "2026-10-24T08:00:00+05:30",
    "lastSite": "left thigh",
    "dueToday": false
  },
  "privateNotes": [
    {
      "id": "pn_3",
      "at": "2026-10-02T09:00:00+05:30",
      "text": "Prefers evening calls.",
      "by": "Dr. Govind Singh"
    }
  ],
  "audit": [
    {
      "at": "2026-10-28T09:12:00+05:30",
      "action": "Opened the record, Dr. Govind Singh"
    }
  ],
  "photosShared": true
}
```

Field notes: `screening` is the counsellor's call before a first consultation
(`{ by, byRole, at, minutes, goal, tried, mentioned, check: string[] }`) or `null`.
`outsideMedicines: null` means "never asked", `[]` means "asked, none". `labs`, `visits` and
`prescriptions` newest first; `weights` and `hba1c` in any order. The front end derives BMI,
care week and "since the last visit" itself.

#### GET `/api/doctor/patients/snapshots` (PROPOSED)

Screen: Patients list (Programme, BMI, HbA1c columns, the Diabetes filter, search by city and
condition) and the care-week tag in Messages and Notes.

```json
[
  {
    "patientId": "42",
    "programme": "Diabetes care",
    "city": "Noida",
    "conditions": ["Type 2 diabetes"],
    "careStartedAt": "2026-07-01T10:00:00+05:30",
    "bmi": 29.4,
    "latestHba1c": { "value": 7.2, "at": "2026-09-30T09:00:00+05:30" }
  }
]
```

#### GET `/api/doctor/queue` (PROPOSED)

Screen: Today "Waiting on you", the flags in Today's day list, the Patients "Waiting on you"
filter, and the Record's "Urgent message" action. Most pressing first: severe symptoms, moderate,
mild, urgent messages, reports to review, messages for the doctor, call notes to sign, draft
prescriptions to sign; oldest first within each.

```json
[
  {
    "id": "sym_9",
    "kind": "symptom",
    "patientId": "42",
    "patientName": "Aanya Kapoor",
    "title": "Dizziness, moderate",
    "detail": "After lunch",
    "at": "2026-10-27T14:05:00+05:30",
    "severity": "Moderate",
    "urgent": false
  }
]
```

`kind` is `symptom` | `message` | `lab` | `note` | `rx`. `id` is the symptom, lab, note or
prescription id (for `message`, any stable id). `severity` only for symptoms; `urgent` only for
messages with urgent words.

#### GET `/api/doctor/work-counts` (PROPOSED)

Screen: the badges on the rail and dock (Today, Notes, Messages).

```json
{ "waitingOnYou": 4, "notesToSign": 2, "messagesForYou": 1 }
```

#### GET `/api/doctor/patients/:patientId/photos` (PROPOSED)

Screen: Record "Progress photos". Answers only while the patient shares photos with this doctor
(403 otherwise). Image URLs should be short-lived signed URLs.

```json
[
  {
    "id": "set_1",
    "takenAt": "2026-08-04T08:00:00+05:30",
    "frontUrl": "https://...",
    "sideUrl": null,
    "weightKg": 86.2
  }
]
```

`weightKg`: the weight the patient logged nearest the photos (within 3 days), or `null`.

#### POST `/api/doctor/patients/:patientId/photos/viewed` (PROPOSED)

Screen: Record, when the doctor presses "Show photos". No body. Adds "Viewed the progress photos"
to the audit log.

#### POST `/api/doctor/patients/:patientId/symptoms/:symptomId/acknowledgement` (PROPOSED)

Screen: Record safety strip and Trackers ("Called the patient", "Advised by message", "Booked a
visit"), and Messages (a reply can mark the flagged symptom "Advised by message").

```json
{ "outcome": "Advised by message" }
```

#### DELETE `/api/doctor/patients/:patientId/symptoms/:symptomId/acknowledgement` (PROPOSED)

Screen: the toast's Undo after the above. No body.

#### POST `/api/doctor/patients/:patientId/labs/:labId/review` (PROPOSED)

Screen: Record, Labs "Mark reviewed". The comment is shown to the patient with the report.

```json
{
  "comment": "Your sugar is a little higher than we want. We will go through it on the call."
}
```

#### POST `/api/doctor/patients/:patientId/prescriptions/:prescriptionId/sign` (PROPOSED)

Screen: Record, Prescriptions "Review and sign". No body. The draft becomes the signed version;
the previous signed version becomes `SUPERSEDED`; the patient and the pharmacy see it.

#### POST `/api/doctor/patients/:patientId/private-notes` (PROPOSED)

Screen: Record, Private notes. Never shown to the patient.

```json
{ "text": "Prefers evening calls." }
```

### Call notes

The scribe drafts a note from each transcribed video consultation (transcription is a separate
consent). Nothing reaches the record or the patient's app before the doctor signs it, and medicine
changes only ever become a DRAFT prescription signed separately.

#### GET `/api/doctor/notes` (PROPOSED)

The doctor's drafts and the notes signed in the last 30 days, as `ClinicalNote[]` (the transcript
may be left empty here).

#### GET `/api/doctor/notes/:noteId` (PROPOSED)

```json
{
  "id": "note_44",
  "patientId": "42",
  "patientName": "Aanya Kapoor",
  "type": "FOLLOW_UP",
  "reason": "Monthly review",
  "callAt": "2026-10-28T10:30:00+05:30",
  "minutes": 18,
  "transcribed": true,
  "readyAt": "2026-10-28T10:50:00+05:30",
  "status": "DRAFT",
  "sections": [
    {
      "key": "summary",
      "draft": [
        {
          "id": "note_44-summary-1",
          "text": "Nausea settled after week one.",
          "evidence": [{ "segmentId": "a3", "quote": "nausea is gone" }],
          "by": "scribe",
          "flag": null
        }
      ],
      "current": [
        {
          "id": "note_44-summary-1",
          "text": "Nausea settled after week one.",
          "evidence": [{ "segmentId": "a3", "quote": "nausea is gone" }],
          "by": "scribe",
          "flag": null
        }
      ],
      "checked": false
    },
    { "key": "assessment", "draft": [], "current": [], "checked": false },
    { "key": "plan", "draft": [], "current": [], "checked": false },
    { "key": "patient", "draft": [], "current": [], "checked": false }
  ],
  "medicines": [
    {
      "id": "m1",
      "action": "CHANGE",
      "name": "Metformin",
      "strength": "1000 mg",
      "detail": "Once a day with dinner",
      "was": "500 mg twice a day",
      "evidence": [{ "segmentId": "a9", "quote": null }],
      "include": true
    }
  ],
  "followUps": [
    {
      "id": "f1",
      "text": "Send the protein guide",
      "owner": "Dietitian",
      "evidence": [],
      "include": true,
      "done": false
    }
  ],
  "recordUpdates": [
    {
      "id": "u1",
      "field": "allergies",
      "label": "Allergies",
      "from": "Not recorded",
      "to": "No known drug allergies",
      "include": true
    }
  ],
  "checks": {},
  "transcript": [
    {
      "id": "a3",
      "t": 95,
      "who": "patient",
      "text": "The nausea is gone now.",
      "english": null,
      "unsure": null,
      "missed": null
    }
  ],
  "signed": null,
  "addenda": [],
  "history": [
    { "at": "2026-10-28T10:50:00+05:30", "what": "Draft written by the scribe" }
  ]
}
```

Field notes:

- `sections` always has the four keys in order: `summary`, `assessment`, `plan`, `patient`
  (`patient` is the summary the patient sees in their app). `draft` is the scribe's original
  (kept for "Restore"); `current` is what the doctor edits.
- A sentence's `flag` (`{ kind: "unclear" | "conflict" | "unsaid", why, options: [{ label, text }], resolved }`)
  asks the doctor to check it; an option with `text: null` removes the sentence; `resolved` holds
  the chosen option's label.
- `transcript[].t` is seconds from the start of the call; `english` renders a mostly-Hindi line;
  `unsure` is the words the transcriber was unsure of; `missed` (`{ to: "summary" | "plan", text }`)
  marks a clinical moment the draft does not use, with the sentence to add.
- `medicines[].action`: `START` | `CHANGE` | `STOP` | `CONTINUE`. `followUps[].owner`: `You` |
  `Care team` | `Dietitian`. `recordUpdates[].field`: `allergies` | `identity_verified` | `outside_medicines`.
- `checks` holds which lists the doctor ticked: `{ "medicines": true, "followUps": false, "recordUpdates": true }`.
- `signed`: `{ at, by, byQualification, prescriptionVersion, prescriptionStatus, sentToApp }` once signed.
- While `now < readyAt` the scribe is still writing; the note shows a placeholder.

#### PUT `/api/doctor/notes/:noteId` (PROPOSED)

Saves the doctor's edits to a draft. Body (`ClinicalNoteChanges`): the editable parts and one line
for the note's history. Answers with the whole updated note. On a signed note, only
`followUps[].done` may change (follow-ups ticked off after the call); anything else is 409.

```json
{
  "sections": ["...the four sections, as in GET..."],
  "medicines": ["..."],
  "followUps": ["..."],
  "recordUpdates": ["..."],
  "checks": { "medicines": true },
  "change": "Edited the Visit summary"
}
```

#### POST `/api/doctor/notes/:noteId/sign` (PROPOSED)

```json
{ "sendToApp": true }
```

Rejects (422) while a sentence has an unresolved flag, or the summary or plan is empty. On sign:
the visit (summary, assessment, plan) goes into the record's `visits` with `noteId`; included
medicine changes become a new DRAFT prescription (next version); included record updates apply;
open flagged symptoms are marked "discussed on the call"; follow-ups go to their owners; with
`sendToApp` and a non-empty `patient` section, the patient's app shows the summary and next steps
under past consultations. Answers with the signed note. A signed note is final: corrections are
addenda.

#### POST `/api/doctor/notes/:noteId/addenda` (PROPOSED)

```json
{ "text": "Patient called back: the dizziness has settled." }
```

Signed under the doctor's name with the current time. Answers with the whole updated note.

### The doctor's chats

The live chat is the existing consultation socket; the backend has no way yet for a doctor to list
their chats.

#### GET `/api/chat/doctor/sessions` (PROPOSED)

```json
[
  {
    "sessionId": 118,
    "patientId": "42",
    "patientName": "Aanya Kapoor",
    "lastMessage": {
      "text": "Is it fine to take it after dinner?",
      "fromDoctor": false,
      "sentAt": "2026-10-28T09:40:00+05:30",
      "hasFile": false
    },
    "waitingSince": "2026-10-28T09:40:00+05:30",
    "urgent": false,
    "unread": true
  }
]
```

`waitingSince`: the first patient message since the doctor last replied or set the chat aside
(`null` when nothing waits). `urgent`: a waiting message contains urgent words (the same rule the
patient app uses). `unread`: a message arrived after the doctor last opened the chat.

#### POST `/api/chat/sessions/:sessionId/read` (PROPOSED)

The doctor opened the chat; clears `unread`. No body.

#### POST `/api/chat/sessions/:sessionId/no-reply-needed` (PROPOSED)

"No reply needed": clears `waitingSince` without a reply. No body.

#### DELETE `/api/chat/sessions/:sessionId/no-reply-needed` (PROPOSED)

Undo of the above (from the toast). No body.

## Notes

- Wishes on existing endpoints (no frontend change needed once added):
  - `GET /api/doctor/me`: add `qualification` ("MBBS, MD (Medicine)") for the signature line on
    signed notes; the dashboard uses `specialization` until then.
  - `GET /api/appointments/doctor`: add `visitType` (`FIRST_CONSULTATION` | `FOLLOW_UP`) to tell
    first consultations from follow-ups in the day list.
- The snapshot fields could instead be added to `GET /api/doctor/patients`; `doctorPortalService`
  would then map them.
