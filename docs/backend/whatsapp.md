# WhatsApp: every notice, to patients and doctors

## Purpose

Everything important that happens in inrange reaches the person on WhatsApp, with a button that opens the
exact page in the app: a booking opens the consultation (the 100ms video room is one tap from there), a
prescription opens the prescription, an order opens that order. Patients and doctors each opt in. The app
always shows everything too; WhatsApp only tells people there is something to see or do.

- Backend: `lib/messages.ts` (every template: name, wording, samples, buttons, deep links), `lib/notify.ts`
  (the queue: claim, re-check, send, retry), `lib/notices.ts` (consultations, blood tests, the review, chat,
  failed payments), `lib/medicineFlow.ts` (the medicine flow, [medicine-flow.md](medicine-flow.md)),
  `lib/replies.ts` (taps and messages back), `integrations/whatsapp.ts` (Meta's Cloud API, Graph v26.0),
  `routes/jobs.ts` (the tick and the webhook). Schema: `migrations/20261117000100_medicine_flow.sql`
  (`patient_messages`, which holds doctors' notices too), `20261117000200_tick_schedule.sql` (the tick).
- App: the patient's consent (onboarding, the free check, Profile > Updates on WhatsApp), the doctor's
  WhatsApp alerts (Hours), the deep links (`/patient-dashboard/care?rx=` and `?order=`), the admin's
  Medicine > Messages (every message, sent or not and why).

## What is sent, and when

| Event | Patient | Doctor | Opens |
| --- | --- | --- | --- |
| Consultation booked (paid, or prepaid with the blood tests) | Booked, with the doctor and time | New booking, first or follow-up, and time | `/consultation/<id>` |
| A day before (booked more than a day ahead) | Reminder | | `/consultation/<id>` |
| 15 minutes before | Starting soon | Starting soon | `/consultation/<id>` |
| The doctor opens the room first | The doctor is ready | | `/consultation/<id>` |
| The patient opens the room first | | The patient is waiting | `/consultation/<id>` |
| The patient moves it | Moved to the new time | Moved, from and to | `/consultation/<id>` |
| The call ends | | An hour later, if the note is not signed yet | `/doctor-dashboard/notes` |
| A chat message (at most once an hour per conversation; the words stay in the app) | The doctor replied | A patient wrote | the conversation |
| Home blood test paid | Booked, and a reminder at 6 pm the evening before | | `/patient-dashboard/lab-tests/<id>` |
| The lab cancels, or the report is ready | Cancelled (choose a new time), or Report ready | | Lab tests, Reports |
| The medical team's review | Book your consultation, or Read the note | | Book, Reports |
| A doctor writes up next steps (plan recommendation) | Next steps are in the app | | Plans |
| A payment fails (any purpose; not final, so 15 minutes later and only if still unpaid) | Did not go through | | Home |
| The prescription is signed | Ready, linked to it (the PDF never goes to WhatsApp) | | `/patient-dashboard/care?rx=<id>` |
| The medicine flow: check-ins, orders, deliveries, supply, doses | [medicine-flow.md](medicine-flow.md) | | the order, the prescription |

Reminders queue with their send time when the booking is made, and each one is checked again just before
it goes: a consultation that moved, was cancelled or has started, a patient already in the room, a note
already signed, a collection moved by the lab: the message is skipped and the reason recorded.

## The templates

Every template is **Utility**, English (`en`), created from `lib/messages.ts` by
`POST /api/admin/whatsapp/templates/sync` (so what Meta approves is exactly what the code sends). URL buttons
are `APP_URL` + the path; `{id}` is appended (percent-encoded) for the dynamic ones. Run the sync again
after changing `APP_URL` (the domain is part of each template; delete the old ones in WhatsApp Manager).
`deno run lib/messages.ts` checks every template against the rules below.

| Template (kind) | Body | Samples | Buttons | When |
| --- | --- | --- | --- | --- |
| `appointment_booked` (APPT_BOOKED) | Hi {{1}}, your video consultation with {{2}} is booked for {{3}}. You can join from the inrange app at that time. | Asha, Dr. Govind Singh, Wed, 18 Nov, 10:30 am | URL: See the booking (/consultation/{id}) | at once |
| `appointment_moved` (APPT_MOVED) | Hi {{1}}, your video consultation with {{2}} has moved to {{3}}. The link to join stays the same. | Asha, Dr. Govind Singh, Thu, 19 Nov, 4:00 pm | URL: See the booking (/consultation/{id}) | at once |
| `appointment_reminder` (APPT_REMINDER) | Hi {{1}}, a reminder that your video consultation with {{2}} is on {{3}}. You join from the inrange app. | Asha, Dr. Govind Singh, Wed, 18 Nov, 10:30 am | URL: See the booking (/consultation/{id}) | 9 am to 9 pm, reminder, expires 6 h |
| `appointment_starting` (APPT_SOON) | Hi {{1}}, your video consultation with {{2}} starts at {{3}}. Join a few minutes early from a quiet place. | Asha, Dr. Govind Singh, 10:30 am | URL: Join the call (/consultation/{id}) | reminder, expires 1 h |
| `doctor_waiting` (DOCTOR_WAITING) | Hi {{1}}, {{2}} is ready for your video consultation. Tap below to join the call. | Asha, Dr. Govind Singh | URL: Join the call (/consultation/{id}) | expires 1 h |
| `care_plan_ready` (CARE_PLAN) | Hi {{1}}, {{2}} has written up your next steps after your consultation. You can read them in the inrange app. | Asha, Dr. Govind Singh | URL: Read them (/patient-dashboard/plans) | at once |
| `doctor_replied` (DOCTOR_REPLIED) | Hi {{1}}, {{2}} has replied to your message in the inrange app. | Asha, Dr. Govind Singh | URL: Read the reply (/patient-dashboard/messages/{id}) | at once |
| `blood_test_booked` (LAB_BOOKED) | Hi {{1}}, your home blood test is booked for {{2}}. The preparation notes are in the inrange app. | Asha, Thu, 19 Nov, 7:00 am to 8:00 am | URL: See the booking (/patient-dashboard/lab-tests/{id}) | at once |
| `blood_test_tomorrow` (LAB_TOMORROW) | Hi {{1}}, your home blood test collection is tomorrow, {{2}}. Please read the preparation notes in the inrange app tonight. | Asha, 7:00 am to 8:00 am | URL: See the notes (/patient-dashboard/lab-tests/{id}) | 9 am to 9 pm, reminder, expires 12 h |
| `blood_test_cancelled` (LAB_CANCELLED) | Hi {{1}}, the lab has cancelled your home blood test for {{2}}. You can choose a new time in the inrange app. | Asha, Thu, 19 Nov | URL: Choose a time (/patient-dashboard/lab-tests) | at once |
| `blood_test_report_ready` (REPORT_READY) | Hi {{1}}, your blood test report is ready. You can see it in the inrange app, and your care team sees it too. | Asha | URL: See the report (/patient-dashboard/reports) | at once |
| `review_done_book` (REVIEW_APPROVED) | Hi {{1}}, the medical team has reviewed your blood tests. You can now book your video consultation with a doctor in the inrange app. | Asha | URL: Book a time (/patient-dashboard/appointments/book) | at once |
| `review_done_note` (REVIEW_NOTE) | Hi {{1}}, the medical team has reviewed your report and left you a note in the inrange app. | Asha | URL: See the note (/patient-dashboard/reports) | at once |
| `payment_not_completed` (PAYMENT_FAILED) | Hi {{1}}, your payment for {{2}} did not go through. If any amount left your account, your bank returns it. | Asha, your consultation | URL: Open the app (/patient-dashboard) | at once |
| `prescription_ready` (RX_READY) | Hi {{1}}, your prescription from {{2}} is ready. You can see it in the inrange app. | Asha, Dr. Govind Singh | URL: See the prescription (/patient-dashboard/care?rx={id}) | at once |
| `prescription_check_in` (CHECK_IN) | Hi {{1}}, checking in about the prescription from {{2}}. Your doctor's plan is in the inrange app. Is anything unclear? | Asha, Dr. Govind Singh | Quick: All clear; Quick: I have questions; Quick: Remind me later; Quick: I have them already; URL: See the prescription (/patient-dashboard/care?rx={id}) | 9 am to 9 pm, reminder |
| `care_team_link` (CARE_LINK) | Hi {{1}}, as we discussed on the call, your prescription and what comes next are in the inrange app. | Asha | URL: Open the app (/patient-dashboard/care/cart) | at once |
| `supply_running_low` (SUPPLY_LOW) | Hi {{1}}, by our records your current supply lasts until about {{2}}. Your next supply is in the inrange app when you need it. | Asha, 18 Dec | Quick: I have enough; URL: Open the app (/patient-dashboard/care/cart) | 9 am to 9 pm, reminder |
| `prescription_review_due` (RENEWAL_DUE) | Hi {{1}}, by our records your current supply lasts until about {{2}}. Your doctor reviews your prescription before the next one, and your care team will call to set it up. | Asha, 18 Dec | none | 9 am to 9 pm |
| `dose_reminder` (DOSE_REMINDER) | Hi {{1}}, it is time for your dose. Tap below once it is done. | Asha | Quick: Taken; Quick: Remind me in 1 hour; Quick: Skip this one | reminder, expires 2 h |
| `order_confirmed` (ORDER_CONFIRMED) | Hi {{1}}, we have your order {{2}}. We expect it to reach you by {{3}}, and we will message you when it leaves our pharmacy. | Asha, MED-00042, 20 Nov | URL: See your order (/patient-dashboard/care?order={id}) | at once |
| `order_packed` (ORDER_PACKED) | Your order {{1}} is packed and sealed, and leaves our pharmacy soon. | MED-00042 | none | at once |
| `order_dispatched` (ORDER_DISPATCHED) | Your order {{1}} is on its way with {{2}}, and we expect it by {{3}}. The tracking details are in the inrange app. | MED-00042, Delhivery, 20 Nov | URL: Track your order (/patient-dashboard/care?order={id}) | at once |
| `order_out_for_delivery` (ORDER_OUT_FOR_DELIVERY) | Your order {{1}} is out for delivery today. Please keep your phone close for the courier. | MED-00042 | none | at once |
| `order_delivered` (ORDER_DELIVERED) | Your order {{1}} has been delivered. Scan the seal on the pack to check where it came from. | MED-00042 | none | at once |
| `order_feedback` (ORDER_FEEDBACK) | Did your order {{1}} arrive as it should? | MED-00042 | Quick: All good; Quick: Something is wrong | 9 am to 9 pm |
| `order_delayed` (ORDER_DELAYED) | Your order {{1}} is running late, sorry. We now expect it by {{2}}. Reply here if you need it sooner and someone from your care team will call. | MED-00042, 21 Nov | none | at once |
| `order_cancelled` (ORDER_CANCELLED) | Your order {{1}} has been cancelled, and your payment is on its way back to how you paid. Refunds take 5 to 7 working days to show. | MED-00042 | none | at once |
| `doctor_new_booking` (DR_BOOKED) | A new {{1}} is booked with you for {{2}}. Open it from the link below. | first consultation, Wed, 18 Nov, 10:30 am | URL: See the consultation (/consultation/{id}) | at once |
| `doctor_booking_moved` (DR_MOVED) | A video consultation with you has moved from {{1}} to {{2}}. The link below stays the same. | Wed, 18 Nov, 10:30 am, Thu, 19 Nov, 4:00 pm | URL: See the consultation (/consultation/{id}) | at once |
| `doctor_call_starting` (DR_SOON) | Your video consultation at {{1}} starts soon. Open the room from the link below. | 10:30 am | URL: Open the room (/consultation/{id}) | expires 1 h |
| `doctor_patient_waiting` (DR_PATIENT_WAITING) | Your patient for the {{1}} consultation has joined and is waiting. Open the room from the link below. | 10:30 am | URL: Open the room (/consultation/{id}) | expires 1 h |
| `doctor_note_to_sign` (DR_NOTE_TO_SIGN) | The call note for your {{1}} consultation is ready to review and sign. The prescription reaches the patient once it is signed. | 10:30 am | URL: Open the notes (/doctor-dashboard/notes) | at once |
| `doctor_patient_message` (DR_PATIENT_MESSAGE) | A patient has sent you a message in the inrange app. You can read it from the link below. | none | URL: Read the message (/doctor-dashboard/messages?p={id}) | at once |

Replies inside WhatsApp's 24-hour window after the person writes or taps are session messages (`ACKS` in
`lib/messages.ts`; the skip reasons are an interactive list). Since 1 Oct 2026 Meta charges for these too.

### The rules every template follows

- **Utility only.** Each message is about something the person already has or asked for. Utility "should
  not promote, recommend, upsell or attempt to secure renewals"; anything that does is recategorised as
  Marketing (about 7.5 times the cost, and per-person caps).
- **No purchase prompts for medicine.** Prescription drugs are a Regulated Vertical in WhatsApp's Business
  Messaging Policy and may not be sold in the chat. The check-ins are care follow-ups ("Is anything
  unclear?"), the supply alert says when the supply runs out, and ordering and paying happen in the app.
- **No health details.** No medicine names, molecules, doses, diagnoses, lab values or prices in a message,
  and the prescription PDF is never uploaded: the button opens it in the signed-in app. Doctors' notices
  never name the patient.
- **Variables** never start or end the body; parameters are cleaned of newlines, tabs and runs of spaces
  (Meta refuses them) and never empty. Quick replies come before URL buttons; labels stay within 20
  characters. Reminders carry an expiry (TTL) so a late one is dropped by Meta rather than delivered late.

## Consent and opt-out

- **Patients:** the optional `WHATSAPP` consent (version `2026-11`): "Updates about my care from inrange on
  WhatsApp: bookings, blood tests, any prescription, orders and reminders." Unticked by default on the free
  check and in onboarding; Profile > Updates on WhatsApp records or revokes it and can always be turned off.
  "Enable reminders" off stops the reminder kinds (the "reminder" ones above); confirmations still go.
- **Doctors:** Hours > WhatsApp alerts records the doctor's own `WHATSAPP` consent (`doctor-2026-11`).
- **STOP** (also "stop.", "unsubscribe", "band karo", "बंद") from anyone revokes their consent and confirms.
  "Cancel" is not an opt-out: it goes to the care team like any other message.
- Without an active consent nothing is sent; the row is recorded as "Not opted in to WhatsApp".
- Test accounts (`TEST_MOBILES`: the seeded doctors and the `98000…` patients) are never sent a real
  message once WhatsApp is live: their numbers are made up and may belong to someone.

## Sending, retries and the webhook

- **Queue** (`lib/notify.ts`): a message is a `patient_messages` row with a unique `dedupe_key`; queuing the
  same trigger twice does nothing. `deliver` claims the row (status QUEUED and due, pushed 10 minutes on),
  so a request and the tick can never both send it, and nothing goes before its time.
- **Errors:** Meta's code decides. Rate limits and Meta's temporary errors (130429, 131000, 131016, 131056,
  133004, 5xx, timeouts) retry after 2, 4, 8, 16 minutes; anything final (bad number, template missing or
  paused, policy, 190 token) fails at once and shows as Not sent in Messages. A rejected token is logged as
  `WHATSAPP TOKEN REJECTED`.
- **Statuses** (sent, delivered, read, failed with its error) update the row by Meta's id or by our own
  (`biz_opaque_callback_data` = `pm:<id>`), so a status that arrives before our write still lands, and a
  timeout after Meta accepted a message never sends it twice.
- **Webhook** `POST /api/webhooks/whatsapp`: the signature (`X-Hub-Signature-256`, the app secret) over the
  raw body; only our phone number id; only Indian mobiles (`91` and 10 digits), so a foreign number can never
  act for a patient. Taps, list picks and text go to `lib/replies.ts`; photos and voice notes go to the team
  as a note; reactions, edits and system notices are ignored. A database failure answers 500 so Meta sends
  it again; replies are recorded once by Meta's event id, and a button acts once per message.

## Endpoints

| Method | Path | Who | Used for |
| --- | --- | --- | --- |
| POST | `/api/jobs/tick` | `x-jobs-secret` (pg_cron, every 5 minutes) | Everything due, then the queue |
| GET | `/api/webhooks/whatsapp` | Meta | The webhook's one-time verification (`WHATSAPP_VERIFY_TOKEN`) |
| POST | `/api/webhooks/whatsapp` | Meta, signed | Taps, picks, text, statuses |
| POST | `/api/admin/whatsapp/templates/sync` | admin | Submits the missing templates; returns each one's status |
| GET | `/api/doctor/whatsapp` | doctor | `{ on, mobile }` (`getWhatsAppAlerts`) |
| PUT | `/api/doctor/whatsapp` | doctor | `{ on }`: the opt-in recorded or revoked (`setWhatsAppAlerts`) |
| PATCH | `/api/patient/reminders` | patient | Only the switches sent change (`whatsappReminders` is the consent) |
| GET | `/api/admin/medicine/messages?patientId=&status=` | admin, coach | Every message, sent or not and why (a patient's list is logged) |
| POST | `/api/admin/medicine/messages/:id/reply` | admin, test mode only | Plays a reply (logged with who played it) |

## Turning it on (in order)

1. **Migrations** `20261117000100` and `20261117000200` (`supabase db push`). The second enables `pg_cron`
   and `pg_net` and schedules the tick; it does nothing until Vault has its two secrets.
2. **The tick:** `supabase secrets set JOBS_SECRET=<long random>`, then in SQL:
   `select vault.create_secret('<the same value>', 'jobs_secret');` and
   `select vault.create_secret('https://<ref>.supabase.co/functions/v1/api/jobs/tick?forceFunctionRegion=ap-south-1', 'tick_url');`
   The medicine queue shows "Checked x min ago".
3. **Meta** (WhatsApp Manager, inrange's verified business number), as function secrets:
   `WHATSAPP_TOKEN` (a system user's permanent token with `whatsapp_business_messaging` and
   `whatsapp_business_management`), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`,
   `WHATSAPP_APP_SECRET` (the Meta app's secret: the webhook signature) and `WHATSAPP_VERIFY_TOKEN` (any long
   word). Live needs the token, the number id and the app secret; `/api/health` says `whatsapp: live`.
4. **The webhook:** in the Meta app, `https://<ref>.supabase.co/functions/v1/api/webhooks/whatsapp?forceFunctionRegion=ap-south-1`
   with the verify token, subscribed to `messages` (and `message_template_status_update`,
   `template_category_update` to see approvals and recategorisations in the app's dashboard).
5. **The templates:** `POST /api/admin/whatsapp/templates/sync` as an admin. Approval usually takes minutes
   (up to 24 hours). Until a template is approved its sends fail as final and show as Not sent.
6. **Before live patients:** unset `TEST_OTP` or drop the pilot doctors from `TEST_MOBILES`.

## Notes

- **Test mode** (no token): every message is recorded as sent with a `mock-` id and nothing leaves; an
  admin plays replies from Medicine > Messages. The flows, the checks and the timings all run as live.
- **Privacy (DPDP Act 2023):** WhatsApp is a separate optional consent, Meta is a processor for message
  content (names, times, order numbers), and nothing clinical is sent. Every look at a patient's messages
  in the admin is logged.
- **Not built:** the WhatsApp authentication template for sign-in codes (Firebase sends them today), BSUIDs
  for people who hide their number behind a username (their replies are dropped until they are mapped),
  and alerts to the care team for critical tasks (the medicine queue shows them).
