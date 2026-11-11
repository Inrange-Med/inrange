# Lab reports

## Purpose

The reports in a patient's record: ones the patient uploads, and ones Redcliffe sends for a home
blood test booked through InRange.

- Screens: `/patient-dashboard/reports`, the onboarding "I have a report" step (path `OWN_REPORT`),
  and "Yes, I have a Report" on `/pricing`.
- Service: `src/services/reportService.ts`. Types: `src/types/report.ts`. Upload form:
  `src/components/ui/LabReportUpload.tsx`.

## Endpoints

| Method | Path | Status | Service function | Screen |
| --- | --- | --- | --- | --- |
| GET | `/api/reports` | PROPOSED | `reportService.listMyReports` | Reports ("Your reports") |
| POST | `/api/reports` | PROPOSED | `reportService.uploadReport` | Reports, onboarding, `/pricing` |
| GET | `/api/labs/bookings/:labBookingId/report` | PROPOSED | `labTestService.getLabReportUrl` | Reports (opens a lab report; lab-tests-redcliffe.md) |

Until they exist, the list says "Reports are not available yet" and an upload says "Uploading
reports is not available yet."

## Requests and responses

### POST `/api/reports` (PROPOSED)

Patient Bearer token, `multipart/form-data`:

| Field | Value |
| --- | --- |
| `file` | PDF, PNG or JPEG, at most 10 MB. The type is read from the file's bytes, not its name |
| `title` | the file name without its extension (the app has no title field) |
| `purpose` | optional; `ELIGIBILITY` for the onboarding upload: it goes to the back office (`reviewStatus: UNDER_REVIEW`, eligibility stage `UNDER_REVIEW`) |

There is no date field: a typed date proves nothing. The admin reads the date printed on the report
(it must be from the last 3 months), helped by what the backend reads from the file (below).

```json
{
  "success": true,
  "data": {
    "id": 88,
    "title": "Lipid profile",
    "source": "UPLOADED",
    "file": "/api/files/reports/88",
    "labBookingId": null,
    "addedAt": "2026-10-28T10:15:00+05:30",
    "reviewStatus": "UNDER_REVIEW",
    "reviewNote": null
  }
}
```

Errors: 422 with a sentence in `message` for a file that is not really a PDF, PNG or JPEG, a file
over 10 MB, or a PDF carrying scripts, launch actions or attached files.

### GET `/api/reports` (PROPOSED)

Every report in the patient's record, newest first.

```json
{
  "success": true,
  "data": [
    { "id": 91, "title": "Smart Full Body Checkup", "source": "LAB_BOOKING", "file": "/api/files/reports/91", "labBookingId": "LB1042", "addedAt": "2026-10-31T09:02:00+05:30", "reviewStatus": "UNDER_REVIEW", "reviewNote": null },
    { "id": 88, "title": "Lipid profile", "source": "UPLOADED", "file": "/api/files/reports/88", "labBookingId": null, "addedAt": "2026-10-28T10:15:00+05:30", "reviewStatus": null, "reviewNote": null }
  ]
}
```

## Notes

- **Files are never linked.** Buckets are private with no access rules, and only the API holds the
  storage key. `GET /api/files/...` (routes/files.ts) checks who is asking (the patient, a doctor
  treating them, or an admin for reports) and streams the file; the app shows it from memory, so
  there is nothing to forward. A doctor or admin opening a file is written to `audit_log`.
- **What the backend reads from each file** (`reports.sha256`, `reports.file_meta`, lib/fileCheck.ts):
  its fingerprint (the same file under another patient, or one already marked not approved, is a
  warning for the admin) and, for a PDF, the app that made it and its created and changed dates
  (an editing app, a change long after creation, or a file made over 3 months before it was sent
  is a warning). These help the admin look closely; they never decide.
- **Lab rows** (`source: "LAB_BOOKING"`, `labBookingId` set) are added when Redcliffe says the report
  is ready (webhook, or a refresh when the patient or an admin opens the app): the PDF is fetched
  from the lab, checked to be a real PDF, and stored with `title` = the package name. When the
  booking came from the lab-and-consultation care package it is an eligibility report
  (`reviewStatus: UNDER_REVIEW`) and joins the admin's review list.
- `reviewStatus` (`UNDER_REVIEW`, `APPROVED`, `NOT_APPROVED`) and `reviewNote` are set by the back
  office on eligibility reports and are `null` on every other report. The same decision drives
  `GET /api/eligibility`.
- **`/pricing`, "Pay Doctor Consultation Fee & Book Slot"** uploads the report, then goes to
  `/patient-dashboard/appointments/book`, where the patient chooses a time and pays the
  `CONSULTATION_FEE` with `referenceId` = the slot id (payments-razorpay.md).
