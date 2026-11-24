-- 24 Nov 2026: pay first and then book the blood test, coaches assigned when a plan starts, the three team desks,
-- and what a salesperson tracks for each lead.

-- ---------------------------------------------------------------- pay first, then book
-- The patient pays for the care package (blood tests and consultation) and then books the collection. `lab_credit`:
-- paid for, with no collection booked on it yet. A booking uses it; a cancelled booking gives it back; a refund ends
-- it. So nobody is ever charged twice, whoever books or rebooks. `lab_addons`: the optional tests paid for with it.
alter table public.eligibility
  add column if not exists lab_credit boolean not null default false,
  add column if not exists lab_addons jsonb not null default '[]',
  add column if not exists lab_paid_at timestamptz;
alter table public.payment_orders drop constraint if exists payment_orders_purpose_check;
alter table public.payment_orders add constraint payment_orders_purpose_check
  check (purpose in ('PLAN', 'LAB_BOOKING', 'CONSULTATION_FEE', 'MEDICINE_ORDER', 'CARE_PACKAGE'));
-- anyone whose paid collection was cancelled, or refused by the lab after the payment, holds the credit from now
update public.eligibility e set lab_credit = true, lab_paid_at = b.paid_at
from public.lab_bookings b
where b.id = e.lab_booking_id and b.paid_at is not null and b.care_package_code is not null
  and (b.status in ('CANCELLED', 'EXPIRED') or (b.status = 'PAYMENT_PENDING' and b.needs_attention is not null));

-- ---------------------------------------------------------------- coaches
-- A coach is a health coach, a fitness coach, or both. When a plan starts the patient gets the health coach with the
-- fewest patients, and a fitness coach who starts three weeks in (`fitness_starts_on`): the first month is the
-- health coach's.
alter table public.users add column if not exists coach_kind text check (coach_kind in ('HEALTH', 'FITNESS', 'BOTH'));
update public.users set coach_kind = 'HEALTH' where role = 'COACH' and coach_kind is null;
alter table public.patient_profiles add column if not exists fitness_starts_on date;
alter table public.ops_tasks drop constraint if exists ops_tasks_kind_check;
alter table public.ops_tasks add constraint ops_tasks_kind_check check (kind in ('NO_REPLY', 'QUESTIONS', 'PLAN_CALL',
  'PAYMENT_FAILED', 'DISPATCH_DUE', 'DELIVERY_LATE', 'DELIVERY_ISSUE', 'RENEWAL', 'REFILL_GAP', 'ADHERENCE', 'RECONCILE',
  'MATCH_MEDICINE', 'LAB_ADD_ON', 'COACH_FIRST_CALL', 'FITNESS_START'));

-- ---------------------------------------------------------------- the team desks
-- OPS: someone on the operations team. `desks` says which work they do: BLOOD_TESTS (books and moves blood tests),
-- CONSULTATIONS (books doctors' consultations and follow-ups), MEDICINE (the pharmacy: orders and deliveries).
-- An admin does all of it.
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('PATIENT', 'DOCTOR', 'ADMIN', 'COACH', 'SALES', 'OPS'));
alter table public.users add column if not exists desks text[] not null default '{}';

-- ---------------------------------------------------------------- sales
-- What a salesperson notes after each call to a lead: how the call went, a remark, and when to call again.
create table if not exists public.lead_updates (
  id integer generated always as identity primary key,
  patient_id integer not null references public.users(id) on delete cascade,
  author_id integer references public.users(id) on delete set null,
  author_name text not null,
  call_status text check (call_status in ('SPOKE', 'NO_ANSWER', 'CALL_BACK', 'INTERESTED', 'NOT_INTERESTED')),
  remark text,
  follow_up_on date,
  created_at timestamptz not null default now()
);
create index if not exists lead_updates_patient on public.lead_updates (patient_id, created_at desc);
alter table public.lead_updates enable row level security;
-- The sales form, filled in after the payment: the customer's condition and programme in the salesperson's words,
-- beside the coach asked for and the remarks already kept with the sale.
alter table public.plan_recommendations
  add column if not exists form_condition text,
  add column if not exists form_programme text,
  add column if not exists form_submitted_at timestamptz,
  add column if not exists form_by text;
