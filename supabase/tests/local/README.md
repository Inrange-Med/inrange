# The API on a laptop

`run.sh` builds a throwaway Postgres from `supabase/migrations`, starts a storage stand-in
(`storage_stub.py`, in memory) and the `api` function under Deno, then runs
`supabase/tests/medicine_flow_journey.py` against it. Nothing touches the deployed project.

```bash
brew install postgresql@17 deno     # once
supabase/tests/local/run.sh          # database, API, then the journey (about a minute)
supabase/tests/local/run.sh --serve  # database and API only; the web app can use it:
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

Every vendor runs in mock mode (no keys are set): sign-in takes `123456`, payments succeed without
Razorpay, and WhatsApp messages are recorded as sent. Replies are played from the admin panel's medicine
queue, or with the signed webhook the journey uses. The local secrets (`JOBS_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`, `WHATSAPP_APP_SECRET`) are set in `run.sh`.

What is stood in for: the Supabase API roles and storage tables the migrations expect, and Storage
itself (uploads, downloads and signed links, in memory). Everything else is the real code and schema.
