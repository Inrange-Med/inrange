-- What the 19 Nov 2026 client call asked for that was still missing (audit of 23 Nov 2026).

-- A prescription does not need a consultation ("Prescription and call should have no relation": a month's refill
-- when no call can happen). A doctor's draft without one: one per doctor and patient at a time.
create unique index if not exists prescriptions_one_draft_without_consultation
  on public.prescriptions (patient_id, doctor_id) where status = 'DRAFT' and appointment_id is null;
-- "Edit" and "new prescription" are two things: an edit is a new version of the one it corrects, so what the
-- patient already paid for on that one stays bought (lib/prescriptions.ts issueRx).
alter table public.prescriptions add column if not exists revises_id integer references public.prescriptions(id) on delete set null;

-- Coach remarks: how the patient's month went, written by their coach (or admin), read by the doctor at a follow-up.
create table if not exists public.coach_remarks (
  id integer generated always as identity primary key,
  patient_id integer not null references public.users(id) on delete cascade,
  author_id integer references public.users(id) on delete set null,
  author_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists coach_remarks_patient on public.coach_remarks (patient_id, created_at desc);
alter table public.coach_remarks enable row level security;

-- A fitness coach beside the health coach: the doctor sees both names. Any coach on the team can be either.
alter table public.patient_profiles add column if not exists fitness_coach_id integer references public.users(id) on delete set null;

-- The sales form: what the salesperson fills in when the sale closes. The plan, who sold it and the note were here
-- already; these are the kind of coach the customer asked for and, when the money was taken outside the app
-- (a payment link, a bank transfer), how much and its payment ID. With those two the plan starts at once.
alter table public.plan_recommendations
  add column if not exists coach_preference text,
  add column if not exists amount_paise integer check (amount_paise is null or amount_paise >= 0),
  add column if not exists payment_ref text;

-- Recording a consultation, only when the patient agreed to it for that call (a tick on their Join screen, asked
-- each time). What 100ms answered when the recording was asked for is kept, so admin can see why one is missing.
alter table public.appointments
  add column if not exists recording_consent_at timestamptz,
  add column if not exists recording_id text,
  add column if not exists recording_started_at timestamptz,
  add column if not exists recording_error text;
