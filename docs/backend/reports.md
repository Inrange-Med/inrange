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
| `file` | PDF, PNG or JPEG, at most 10 MB |
| `reportDate` | `YYYY-MM-DD`, not in the future, at most 90 days ago |
| `title` | the file name without its extension (the app has no title field) |
| `purpose` | optional; `ELIGIBILITY` for the onboarding upload: it goes to the back office (`reviewStatus: UNDER_REVIEW`, eligibility stage `UNDER_REVIEW`) |

```json
{
  "success": true,
  "data": {
    "id": 88,
    "title": "Lipid profile",
    "reportDate": "2026-10-12",
    "source": "UPLOADED",
    "fileUrl": "https://files.inrange.in/reports/88.pdf?signature=...",
    "labBookingId": null,
    "addedAt": "2026-10-28T10:15:00+05:30",
    "reviewStatus": "UNDER_REVIEW",
    "reviewNote": null
  }
}
```

Errors: 422 with a sentence in `message` for a wrong type, a file over 10 MB, a future date or a
date over 90 days old ("Report is 120 days old (>90 days). Doctor consultation requires a report
under 3 months.").

### GET `/api/reports` (PROPOSED)

Every report in the patient's record, newest `reportDate` first.

```json
{
  "success": true,
  "data": [
    { "id": 91, "title": "Smart Full Body Checkup", "reportDate": "2026-10-30", "source": "LAB_BOOKING", "fileUrl": null, "labBookingId": "LB1042", "addedAt": "2026-10-31T09:02:00+05:30", "reviewStatus": "UNDER_REVIEW", "reviewNote": null },
    { "id": 88, "title": "Lipid profile", "reportDate": "2026-10-12", "source": "UPLOADED", "fileUrl": "https://files.inrange.in/reports/88.pdf?signature=...", "labBookingId": null, "addedAt": "2026-10-28T10:15:00+05:30", "reviewStatus": null, "reviewNote": null }
  ]
}
```

## Notes

- **90-day rule.** A report counts only if the date printed on it is within the last 90 days. The
  app checks before the file can be chosen; the backend must check again.
- Store files privately (S3 or similar); `fileUrl` is a signed link.
- **Lab rows** (`source: "LAB_BOOKING"`, `fileUrl: null`, `labBookingId` set) are added by the
  Redcliffe `consolidatereport` webhook (lab-tests-redcliffe.md, Notes) with `title` = the package
  name and `reportDate` = the collection date. When the booking came from the lab-and-consultation
  care package it is an eligibility report (`reviewStatus: UNDER_REVIEW`). The app opens it through
  `GET /api/labs/bookings/:labBookingId/report` (a fresh link each time).
- `reviewStatus` (`UNDER_REVIEW`, `APPROVED`, `NOT_APPROVED`) and `reviewNote` are set by the back
  office on eligibility reports and are `null` on every other report. The same decision drives
  `GET /api/eligibility`.
- **`/pricing`, "Pay Doctor Consultation Fee & Book Slot"** uploads the report, then goes to
  `/patient-dashboard/appointments/book`, where the patient chooses a time and pays the
  `CONSULTATION_FEE` with `referenceId` = the slot id (payments-razorpay.md).
