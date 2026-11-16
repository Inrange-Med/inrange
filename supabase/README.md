# InRange pilot backend (Supabase)

One edge function, `api`, serves every `/api/...` route the web app calls. Postgres holds the data, and
private Storage buckets (`reports`, `prescriptions`, `photos`) hold the files.

| | |
| --- | --- |
| Project | `inrange-pilot` (`wcsglsrjixfrobujchen`), Mumbai `ap-south-1` |
| API base URL (the app's `NEXT_PUBLIC_API_BASE_URL`) | `https://wcsglsrjixfrobujchen.supabase.co/functions/v1` |
| Health and vendor modes | `GET /api/health` → `{ integrations: { sms, razorpay, redcliffe, hms: "mock" or "live" } }` |
| Web app | https://inrange-pilot.vercel.app (Vercel project `inrange-pilot`) |

Code: `functions/api/index.ts` (router), `routes/` (one file per area), `lib/` (db, auth, http, storage,
eligibility, booking), `integrations/` (one file per vendor). Schema: `migrations/`.

## Turning a vendor on: add its keys, nothing else

Every vendor runs in mock mode until its secrets are set. Setting them switches it live on the next
request. No redeploy and no code change are needed.

```bash
supabase secrets set --project-ref wcsglsrjixfrobujchen NAME=value ...
```

| Vendor | Secrets | Mock behaviour until then |
| --- | --- | --- |
| Sign-in codes (MSG91, DLT template with `##OTP##`) | `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` | Every number signs in with `PILOT_OTP` (default `123456`); the sign-in screen says so |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Orders use key `rzp_mock`; checkout says "Pilot test payment. Nothing is charged." and succeeds |
| Redcliffe Labs | `REDCLIFFE_API_KEY`, `REDCLIFFE_WEBHOOK_SECRET` (and `REDCLIFFE_BASE_URL` for production; default is their QA host) | Mock catalogue (MD028 and 4 more), NCR locations and slots; a booking can be moved on with `POST /api/labs/bookings/:id/simulate {event: "SAMPLE_COLLECTED" or "REPORT_READY"}` |
| 100ms video | `HMS_ACCESS_KEY`, `HMS_SECRET`, `HMS_TEMPLATE_ID`, `HMS_SUBDOMAIN` (the template's Prebuilt subdomain, from the 100ms dashboard; no API returns it) | The call opens `pilot-video-room.html` (camera preview, "live video connects once the key is added") |
| WhatsApp (Meta Cloud API) | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | Messages are recorded as sent and nothing leaves; an admin plays the patient's replies from Medicine (docs/backend/medicine-flow.md) |

Pilot vendor accounts (PDPL's; test keys until go-live):
- Razorpay: test mode. Each order sets auto-capture itself; `/payments/verify` fulfils only after Razorpay
  reports the payment captured for that order's exact amount. Test card `4100 2800 0000 1007`, any future
  expiry, any CVV, OTP of 4 or more digits.
- 100ms: template `medistry.vc` (`6aba17dc8485531b71b6f024`), region `in` (media servers in India), roles
  `doctor` (can end the room and remove others) and `patient`, recording, streaming and transcription off.
  Rooms are created in `in`; ending a consultation ends the session and locks the room, so its links die.

Register these webhooks with the vendors once their keys are in:
- Razorpay (Dashboard, Accounts & Settings, Webhooks; once in Test mode and again in Live mode):
  `https://wcsglsrjixfrobujchen.supabase.co/functions/v1/api/webhooks/razorpay?forceFunctionRegion=ap-south-1`,
  secret = `RAZORPAY_WEBHOOK_SECRET`, events `payment.captured`, `order.paid`, `payment.failed`.
- WhatsApp (Meta app, Webhooks, `messages`): `https://wcsglsrjixfrobujchen.supabase.co/functions/v1/api/webhooks/whatsapp?forceFunctionRegion=ap-south-1`,
  verify token = `WHATSAPP_VERIFY_TOKEN`; calls are signed with `WHATSAPP_APP_SECRET`.
- Redcliffe: `https://wcsglsrjixfrobujchen.supabase.co/functions/v1/api/webhooks/redcliffe` with `auth_key: x-redcliffe-secret` and `auth_value` = `REDCLIFFE_WEBHOOK_SECRET`.

## The scheduler

`POST /api/jobs/tick` runs the medicine flow's timed steps (check-ins, order checks, doses, refills, the
nightly reconciliation, the message queue). Supabase cron calls it every 5 minutes with `JOBS_SECRET`;
the SQL to schedule it is in `docs/backend/medicine-flow.md`, "Turning it on". Without the secret it
answers 503 and nothing runs. `job_runs` records each run.

## Pilot switches

| Secret | Default | Effect |
| --- | --- | --- |
| `JOBS_SECRET` | unset | Lets Supabase cron call the tick (`x-jobs-secret`). |
| `PILOT_OTP` | `123456` | The sign-in code while SMS is mocked. |
| `APP_URL` | `https://inrange-pilot.vercel.app` | Links the API hands out (the mock video room). |
| `DB_POOLER_URL` | set | Postgres through the transaction pooler (port 6543). |
| `APP_JWT_SECRET` | set | Signs sign-in tokens (14 days). Changing it signs everyone out. |
| `NANO_CART_DELAY_HOURS` | `48` | Hours between a first consultation's prescription and its cart (pilot 24 or 48). |
| `PRACTICE_ADDRESS` | placeholder | The registered office, printed on prescriptions (CONFIRM first). Each doctor's practice address and contact are `doctors.practice_address` and `doctors.contact`. |
| `PHARMACY_LICENCE` | placeholder | The pharmacy's drug licence numbers (Forms 20, 21), printed on prescriptions (CONFIRM first). |
| `SUPPORT_PHONE` | placeholder | The support number on prescriptions (header and the grievance line); there is no care@ inbox. |
| `ESIGN_METHOD` | placeholder | How prescriptions are signed ("Aadhaar eSign" or "DSC"), printed beside "Digitally signed". |

## Doctors

Three pilot doctors are seeded: `9000000001` (Dr. Ananya Iyer), `9000000002` (Dr. Rohan Mehta), `9000000003`
(Dr. Kavita Sharma). Each signs in with their mobile like anyone else. To add a real doctor, run in the SQL editor
(their slots appear automatically, Mon to Sat, 10:00 to 13:00 and 15:00 to 19:00 India time):

```sql
with u as (
  insert into users (mobile, role, full_name) values ('98XXXXXXXX', 'DOCTOR', 'Dr. Full Name')
  on conflict (mobile) do update set role = 'DOCTOR', full_name = excluded.full_name returning id
)
insert into doctors (id, full_name, specialization, qualification, registration_no, consultation_fee_rupees)
select id, 'Dr. Full Name', 'Endocrinology', 'MBBS, MD', 'DMC/R/00000', 499 from u;
```

Writing a prescription: in the note after the call, "Add a medicine" and pick it from the pharmacy list (or
write a Plan sentence such as "Start Metformin 500 mg, twice a day after meals." for something not stocked),
then sign the note. The one signature signs the prescription: the PDF, the patient's copy and a prefilled
cart (held back `NANO_CART_DELAY_HOURS` for a first consultation without a plan). The delivery order is
created when the patient pays. Prices and internal costs: `docs/backend/medicine-cart.md`.

## Security

- `public` is only the schema name. Every table has RLS on with no policies, and the `anon` and `authenticated`
  roles have no privileges at all (`migrations/20261103000900_lockdown.sql`). Only the `api` function, connected
  as the owner, reads or writes data.
- Files are in private buckets, opened only through 5 to 10 minute signed links.
- Vendor keys exist only as function secrets (encrypted, readable only by the function); never in git, `.env`
  files or Vercel. The browser gets only the Razorpay key id, inside each order.
- Everything runs in Mumbai: the database and Storage (`ap-south-1`), the function (the app sends
  `x-region: ap-south-1`, webhooks use `?forceFunctionRegion=ap-south-1`), the web app's functions (Vercel
  `bom1`, `vercel.json`), 100ms media (`in`) and Razorpay.
- Sign-in codes are hashed, single use, 5 minutes, 5 tries, 30 s between sends, 5 sends an hour.
- Pilot shortcuts, not for public launch: tokens live in `localStorage`, the auto-approve switch, mock vendors,
  no refunds, no admin console (use the Supabase dashboard).

## Deploying and checking

```bash
supabase db push --linked          # migrations
supabase functions deploy api --use-api
python3 supabase/tests/journey.py  # the whole patient and doctor journey against the deployed API
JOURNEY_OTP=<TEST_OTP> python3 supabase/tests/journey.py; python3 supabase/tests/cart_journey.py <TEST_OTP> /tmp  # the medicine cart
```

`journey.py` creates a test patient whose number starts `98000`. Delete test patients afterwards with
`supabase db query --remote -f supabase/tests/cleanup_test_patients.sql` so doctors' lists stay clean.
