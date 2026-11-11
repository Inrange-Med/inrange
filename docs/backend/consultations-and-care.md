# Consultations, Care, Messages and the video room

## Purpose

What the patient's consultation screens call: booking a time, changing it, the care team, the
Care tab's treatment, the chat and the video call (the video call and chat are shared with the
doctor dashboard).

- Screens: `/patient-dashboard/appointments`, `/patient-dashboard/appointments/book`,
  `/patient-dashboard/care`, `/patient-dashboard/messages`, `/patient-dashboard/messages/[doctorId]`,
  `/consultation/[appointmentId]`.
- Services: `appointmentService`, `careTeamService`, `carePlanService`, `chatService`,
  `videoConsultationService` (all in `src/services/`).
- Types: `src/types/appointment.ts`, `doctor.ts` (`CareTeam`), `carePlan.ts`, `chat.ts`.

## Endpoints

| Method | Path | Status | Service function | Screen |
| --- | --- | --- | --- | --- |
| GET | `/api/schedule/available-slots?date=YYYY-MM-DD` | PROPOSED | `appointmentService.listAvailableSlots` | Book a consultation |
| GET | `/api/schedule/slots/:doctorId/:date` (no auth) | exists | `appointmentService.listDoctorSlots` | Appointments, Change time |
| PUT | `/api/schedule/book` | exists | `appointmentService.bookSlot` | Book a consultation (prepaid) |
| GET | `/api/appointments/patient` | exists | `appointmentService.listMyAppointments` | Appointments, Care, Messages, Home |
| PATCH | `/api/appointments/:appointmentId/reschedule` | PROPOSED | `appointmentService.rescheduleAppointment` | Appointments, Change time |
| GET | `/api/care-team` | PROPOSED | `careTeamService.getMyCareTeam` | Care, Messages, chat header |
| GET | `/api/care/prescription/current` | PROPOSED | `carePlanService.loadCarePlan` | Care, "Your prescription" |
| GET | `/api/care/medicine-orders` | PROPOSED | `carePlanService.loadCarePlan` | Care, deliveries |
| POST | `/api/chat/init` | exists | `chatService.startChatSession` | Chat |
| GET | `/api/chat/sessions/:sessionId/messages` | PROPOSED | `chatService.listChatHistory` | Chat (both dashboards) |
| POST | `/api/chat/sessions/:sessionId/messages` | pilot | `chatService.connectToChatSession` (send) | Chat (both dashboards) |
| GET | `/api/chat/sessions/:sessionId/messages?afterId=` | pilot | `chatService.connectToChatSession` (polls every 3 s) | Chat (both dashboards) |
| GET | `/api/video/appointments/:appointmentId/join` | exists | `videoConsultationService.joinVideoConsultation` | Video room |
| POST | `/api/video/appointments/:appointmentId/end` (doctor) | exists | `videoConsultationService.endVideoConsultation` | Video room |

Also used here, documented elsewhere: `GET /api/eligibility` (patient-dashboard.md),
`POST /api/payments/orders` with `CONSULTATION_FEE` (payments-razorpay.md),
`GET /api/subscriptions/status` and `/plans` (patient-dashboard.md).

## Requests and responses

### GET `/api/schedule/available-slots?date=YYYY-MM-DD` (PROPOSED)

The times this patient may book on one day. The patient never chooses a doctor: before a
care-team doctor exists, return every doctor's free slots merged (one slot per time is enough);
after, only that doctor's. The backend maps the slot id back to its doctor when booking or paying.
Leave out slots held by another patient's open checkout.

```json
{
  "success": true,
  "data": [
    { "SlotId": 300, "StartTime": "09:30", "EndTime": "10:00", "Status": "Available" },
    { "SlotId": 301, "StartTime": "10:00", "EndTime": "10:30", "Status": "Available" }
  ]
}
```

### PUT `/api/schedule/book` (exists)

```json
{ "slotId": 300, "consultationType": "Virtual", "reason": "Tired after meals | Note: evenings suit me" }
```

`reason` is the patient's "Reason / Symptoms", plus ` | Note: <notes>` when they add notes. Refuse
(400 with a message) a patient who is not `APPROVED`, or has no unused prepaid consultation for a
first consultation.

### PATCH `/api/appointments/:appointmentId/reschedule` (PROPOSED)

The patient who owns the appointment moves a `BOOKED` consultation to an open slot of the same
doctor. Release the old slot and take the new one in one transaction.

```json
{ "slotId": 812 }
```

```json
{
  "success": true,
  "message": "Appointment moved",
  "data": { "AppointmentId": 341, "DoctorId": 7, "SlotDate": "2026-11-03", "StartTime": "17:30:00", "EndTime": "18:00:00", "Status": "Booked" }
}
```

Errors: 409 when the slot was just taken (`"That time was just booked. Choose another."`), 400 when
the appointment is not `BOOKED` or the slot belongs to another doctor. On 404 the sheet says
"Changing the time is not available yet. Message your doctor to move it."

### GET `/api/care-team` (PROPOSED)

The doctor of the first consultation, added after that consultation. `doctor: null` until then.
On 404 the screens use the doctors from `GET /api/appointments/patient`.

```json
{
  "success": true,
  "data": {
    "doctor": {
      "id": 1,
      "fullName": "Dr. Govind Singh",
      "photoUrl": null,
      "specialization": "Endocrinology",
      "qualifications": "MBBS, MD",
      "experience": "35 years",
      "languages": ["English", "Hindi"],
      "about": "",
      "consultationFee": null,
      "rating": null
    }
  }
}
```

### GET `/api/care/prescription/current` (PROPOSED)

The latest SIGNED prescription, or `data: null` when there is none. `pdf` is the API path that
streams the signed PDF to the patient or a treating doctor (`GET /api/files/prescriptions/:id`,
never a shareable link); `version` above 1 shows "updated after your follow-up".

```json
{
  "success": true,
  "data": {
    "id": "rx_118",
    "doctorName": "Dr. Asha Menon",
    "doctorQualification": "MD (Medicine)",
    "doctorRegistrationNo": "DMC/R/12345",
    "signedAt": "2026-10-02T11:20:00+05:30",
    "version": 2,
    "pdf": "/api/files/prescriptions/118",
    "items": [
      {
        "medicineName": "Metformin",
        "strength": "500 mg",
        "dose": "one tablet",
        "frequency": "twice a day, after meals",
        "route": "By mouth",
        "instructions": "Take with breakfast and dinner.",
        "reason": "Helps your body use insulin.",
        "genericName": null
      }
    ]
  }
}
```

### GET `/api/care/medicine-orders` (PROPOSED)

Newest first. `status` is `PLACED` | `PACKED` | `DISPATCHED` | `DELIVERED`; `history` holds each
status reached, oldest first.

```json
{
  "success": true,
  "data": [
    {
      "id": "ord_552",
      "status": "DISPATCHED",
      "placedAt": "2026-10-20T09:00:00+05:30",
      "expectedAt": "2026-10-23T18:00:00+05:30",
      "trackingNo": "BD123456789IN",
      "trackingUrl": "https://courier.example/track/BD123456789IN",
      "items": [{ "name": "Metformin 500 mg", "quantity": "60 tablets" }],
      "history": [
        { "status": "PLACED", "at": "2026-10-20T09:00:00+05:30", "note": "Order received" },
        { "status": "DISPATCHED", "at": "2026-10-21T10:30:00+05:30", "note": "Handed to the courier" }
      ]
    }
  ]
}
```

When either care endpoint answers 404 the card says "Your prescription and medicine deliveries will
show here. This is not available in the app yet."

### GET `/api/chat/sessions/:sessionId/messages` (PROPOSED)

Earlier messages when a chat opens (the socket only carries new ones), for the patient or doctor in
the session. Oldest first, the same shape as the socket's `receive_consultation_message`.

```json
{
  "success": true,
  "data": [
    { "sessionId": 91, "senderUserId": 204, "senderRole": "PATIENT", "messageType": "TEXT", "messageText": "Should I take it before food?", "fileUrl": null, "sentAt": "2026-10-27T10:02:00+05:30" },
    { "sessionId": 91, "senderUserId": 7, "senderRole": "DOCTOR", "messageType": "TEXT", "messageText": "After breakfast is best.", "fileUrl": null, "sentAt": "2026-10-27T10:09:00+05:30" }
  ]
}
```

On 404 the chat opens empty and says "Earlier messages are not shown here yet."

## Notes

- **Patients never pick a doctor.** `GET /api/doctors` is not called by the patient dashboard; Book
  lists times from `available-slots`, and Care, Messages and the chat use `/api/care-team`.
- **Paying for the first consultation.** With `consultationPaid: true` on `GET /api/eligibility`
  (the lab-and-consultation care package prepaid it), Book calls `PUT /api/schedule/book` directly
  and the backend uses up that consultation. With `consultationPaid: false` (the own-report path) the
  chosen slot goes to checkout as `CONSULTATION_FEE` with `referenceId` = the slot id
  (payments-razorpay.md); the backend books it once paid.
- **Socket.** Please stamp `sentAt` on every message emitted (the app stamps the arrival time when
  it is missing).
- **Not proposed:** cancelling a consultation (the design has no cancel action for consultations).
- **Design pieces left out** (no endpoint yet): past consultation notes under "Past consultations"
  (needs a signed consultation-summary endpoint); photos in chat (needs an upload returning a
  `fileUrl` for `messageType: "FILE"`); typing indicators and read receipts (socket events); the
  dietitian, diet plans and check-ins; the dose-step ladder beside the medicine.
