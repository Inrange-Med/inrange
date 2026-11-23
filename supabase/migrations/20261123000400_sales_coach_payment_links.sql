-- The 23 Nov 2026 client call: a salesperson's own panel, a coach's own panel, payment links whose payment
-- starts the plan by itself, what each plan includes, and the calls admin schedules.

-- A salesperson signs in (role SALES) and reaches only the sales panel: the patients assigned to them.
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('PATIENT', 'DOCTOR', 'ADMIN', 'COACH', 'SALES'));
alter table public.salespeople add column if not exists user_id integer unique references public.users(id) on delete set null;

-- Everyone already on the sales team with a number nobody else uses gets a sign-in (two people sharing a number:
-- only the first of them, since a number is one sign-in).
insert into public.users (mobile, role, full_name, onboarding_completed)
select distinct on (s.mobile) s.mobile, 'SALES', s.full_name, true from public.salespeople s
where s.mobile is not null and s.user_id is null and not exists (select 1 from public.users u where u.mobile = s.mobile)
order by s.mobile, s.id;
update public.salespeople s set user_id = u.id from public.users u
where s.user_id is null and u.mobile = s.mobile and u.role = 'SALES'
  and s.id = (select min(o.id) from public.salespeople o where o.mobile = s.mobile)
  and not exists (select 1 from public.salespeople t where t.user_id = u.id);

-- What a plan includes ("3 months: 3 doctor consultations, 12 coach calls, 12 fitness calls"), and how much off
-- its price a salesperson may give on a payment link without asking (admin may give any discount).
alter table public.plans
  add column if not exists doctor_consults integer check (doctor_consults is null or doctor_consults >= 0),
  add column if not exists coach_calls integer check (coach_calls is null or coach_calls >= 0),
  add column if not exists fitness_calls integer check (fitness_calls is null or fitness_calls >= 0),
  add column if not exists max_sales_discount_percent integer not null default 0
    check (max_sales_discount_percent between 0 and 100);
update public.plans set doctor_consults = duration_months, coach_calls = duration_months * 4, fitness_calls = duration_months * 4
where doctor_consults is null;

-- A payment link (Razorpay Payment Links): made for one patient and one plan at an agreed price. Its id is
-- Razorpay's (plink_...), so the webhook, the customer's return and the scheduled check all find the same row.
-- When it is paid the plan starts by itself and the sale is recorded from what the link carries.
create table if not exists public.payment_links (
  id text primary key,
  patient_id integer not null references public.users(id) on delete cascade,
  plan_id integer not null references public.plans(id),
  list_paise integer not null check (list_paise > 0),
  amount_paise integer not null check (amount_paise >= 100),
  short_url text not null,
  provider text not null default 'mock' check (provider in ('razorpay', 'mock')),
  status text not null default 'CREATED' check (status in ('CREATED', 'PAID', 'CANCELLED', 'EXPIRED')),
  salesperson_id integer references public.salespeople(id) on delete set null,
  salesperson text,
  coach_preference text,
  note text,
  created_by integer references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  paid_at timestamptz,
  provider_payment_id text,
  -- a payment that could not start the plan (the patient was already on one): the team refunds or sorts it out
  needs_attention text,
  checked_at timestamptz
);
create index if not exists payment_links_patient on public.payment_links (patient_id, created_at desc);
-- one link waiting per patient: a new one replaces it, so nobody pays twice
create unique index if not exists payment_links_one_open on public.payment_links (patient_id) where status = 'CREATED';
alter table public.payment_links enable row level security;

-- Money Razorpay captured that belongs to none of our orders or links (a link made in the Razorpay dashboard, a
-- QR code). Kept so admin can see who paid and put it against a patient's plan; `mobile` is the payer's number.
create table if not exists public.received_payments (
  id text primary key,                       -- Razorpay's payment id (pay_...)
  amount_paise integer not null,
  mobile text,
  email text,
  method text,
  description text,
  captured_at timestamptz not null default now(),
  used_for_patient integer references public.users(id) on delete set null,
  used_at timestamptz,
  set_aside_at timestamptz
);
alter table public.received_payments enable row level security;
-- a payment ID starts one plan only (test runs before today may have typed one twice: those keep the first)
update public.plan_recommendations r set payment_ref = r.payment_ref || ' (repeat ' || r.id || ')'
where r.payment_ref is not null and exists (
  select 1 from public.plan_recommendations o where o.payment_ref = r.payment_ref and o.id < r.id);
create unique index if not exists plan_recommendations_payment_ref on public.plan_recommendations (payment_ref) where payment_ref is not null;

-- The coach's side. A diet chart (the health coach) or an exercise plan (the fitness coach): each save is a new
-- version, and the newest of each kind is the current one. A call: one row per call made, counted against what
-- the plan includes.
create table if not exists public.coach_plans (
  id integer generated always as identity primary key,
  patient_id integer not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('DIET', 'FITNESS')),
  text text not null,
  author_id integer references public.users(id) on delete set null,
  author_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists coach_plans_patient on public.coach_plans (patient_id, kind, created_at desc);
alter table public.coach_plans enable row level security;

create table if not exists public.coach_calls (
  id integer generated always as identity primary key,
  patient_id integer not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('HEALTH', 'FITNESS')),
  called_on date not null,
  note text,
  author_id integer references public.users(id) on delete set null,
  author_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists coach_calls_patient on public.coach_calls (patient_id, called_on desc);
alter table public.coach_calls enable row level security;
