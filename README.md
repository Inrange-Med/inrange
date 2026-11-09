# InRange

The InRange web app: the public homepage, sign-in, onboarding, the patient and doctor dashboards
and the video consultation (Next.js App Router). The backend is the `api` Supabase
Edge Function in `supabase/` (base URL `.../functions/v1`); vendor integrations run in mock mode until
their keys are set as function secrets.

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev                  # http://localhost:3001
```

Read `ARCHITECTURE.md` first: it says where every kind of code goes and which rules lint enforces.

Checks before a pull request: `npm run lint`, `npx tsc --noEmit -p .`, `npm run format:check`,
`npm run check:redcliffe` (a no-network self-check of the Redcliffe Labs reference client) and
`npm run check:sign-in` (where sign-in may send someone back to).
