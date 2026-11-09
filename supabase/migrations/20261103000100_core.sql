-- InRange pilot: core schema. Every table is reached only through the `api` edge function
-- (it connects as the database owner). RLS is on with no policies, so the public anon key reads nothing.
-- Ids are integers because the app stores numeric user ids. A doctor's id IS their user id.

create table public.users (
  id integer generated always as identity primary key,
  mobile text not null unique check (mobile ~ '^[6-9][0-9]{9}$'),
  role text not null default 'PATIENT' check (role in ('PATIENT', 'DOCTOR', 'ADMIN')),
  full_name text,
  email text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.otp_codes (
  mobile text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  sends_in_window integer not null default 1,
  window_started_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now()
);

create table public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.doctors (
  id integer primary key references public.users(id) on delete cascade,
  full_name text not null,
  specialization text,
  qualification text,
  registration_no text,
  experience text,
  languages text[] not null default '{English,Hindi}',
  about text not null default '',
  photo_url text,
  consultation_fee_rupees integer,
  active boolean not null default true
);

create table public.patient_profiles (
  user_id integer primary key references public.users(id) on delete cascade,
  first_name text,
  last_name text,
  gender text check (gender in ('Male', 'Female', 'Other')),
  age_years integer check (age_years between 18 and 90),
  age_recorded_at timestamptz,
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  weight_loss_experience text[] not null default '{}',
  conditions jsonb,
  no_conditions boolean not null default false,
  last_completed_step integer not null default 0,
  reminders jsonb not null default '{}',
  privacy jsonb not null default '{}',
  care_team_doctor_id integer references public.doctors(id),
  updated_at timestamptz not null default now()
);

create table public.consents (
  id integer generated always as identity primary key,
  user_id integer not null references public.users(id) on delete cascade,
  consent_type text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index on public.consents (user_id) where revoked_at is null;

create table public.weight_logs (
  id integer generated always as identity primary key,
  user_id integer not null references public.users(id) on delete cascade,
  weight_kg numeric(5,1) not null check (weight_kg between 30 and 250),
  source text not null default 'APP',
  logged_at timestamptz not null default now()
);
create index on public.weight_logs (user_id, logged_at);

create table public.eligibility (
  user_id integer primary key references public.users(id) on delete cascade,
  path text check (path in ('OWN_REPORT', 'LAB_TEST')),
  stage text not null default 'NOT_STARTED' check (stage in
    ('NOT_STARTED','AWAITING_PAYMENT','LAB_SCHEDULED','SAMPLE_COLLECTED','UNDER_REVIEW','APPROVED','NOT_APPROVED')),
  review_note text,
  lab_booking_id text,
  consultation_paid boolean not null default false,
  consultation_used boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.doctor_slots (
  id integer generated always as identity primary key,
  doctor_id integer not null references public.doctors(id) on delete cascade,
  slot_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'Available' check (status in ('Available', 'Held', 'Booked', 'Blocked')),
  held_by integer references public.users(id),
  held_until timestamptz,
  unique (doctor_id, slot_date, start_time)
);
create index on public.doctor_slots (slot_date, status);

create table public.appointments (
  id integer generated always as identity primary key,
  patient_id integer not null references public.users(id),
  doctor_id integer not null references public.doctors(id),
  slot_id integer references public.doctor_slots(id),
  status text not null default 'Booked' check (status in ('Booked', 'InProgress', 'Completed', 'Cancelled', 'NoShow')),
  consultation_type text not null default 'Virtual',
  visit_type text not null default 'FIRST' check (visit_type in ('FIRST', 'FOLLOW_UP')),
  reason text,
  video_room_id text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.appointments (patient_id);
create index on public.appointments (doctor_id);

create table public.plans (
  id integer generated always as identity primary key,
  name text not null,
  description text not null default '',
  duration_months integer not null,
  price_rupees integer not null,
  features jsonb not null default '[]',
  sort_order integer not null default 0,
  active boolean not null default true
);

create table public.subscriptions (
  id integer generated always as identity primary key,
  user_id integer not null references public.users(id) on delete cascade,
  plan_id integer not null references public.plans(id),
  status text not null default 'Active' check (status in ('Active', 'Paused', 'Cancelled', 'Expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  payment_order_id text,
  created_at timestamptz not null default now()
);
create index on public.subscriptions (user_id);

create table public.plan_recommendations (
  id integer generated always as identity primary key,
  patient_id integer not null references public.users(id) on delete cascade,
  doctor_id integer not null references public.doctors(id),
  plan_id integer not null references public.plans(id),
  note text,
  created_at timestamptz not null default now()
);

create table public.care_packages (
  code text primary key,
  name text not null,
  description text not null default '',
  price_rupees integer not null,
  includes_lab_tests boolean not null default false,
  lab_package_code text,
  includes jsonb not null default '[]',
  sort_order integer not null default 0
);

create table public.payment_orders (
  id text primary key,                      -- the Razorpay order id (or mock_order_...)
  user_id integer not null references public.users(id),
  purpose text not null check (purpose in ('PLAN', 'LAB_BOOKING', 'CONSULTATION_FEE')),
  reference_id text not null,
  amount_paise integer not null check (amount_paise >= 0),
  currency text not null default 'INR',
  title text not null,
  line_items jsonb not null default '[]',
  status text not null default 'CREATED' check (status in ('CREATED', 'PAID', 'FAILED')),
  provider text not null default 'mock' check (provider in ('razorpay', 'mock')),
  provider_payment_id text,
  meta jsonb not null default '{}',
  invoice_number text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index on public.payment_orders (user_id);
create sequence public.invoice_seq start 1001;

create table public.chat_sessions (
  id integer generated always as identity primary key,
  patient_id integer not null references public.users(id),
  doctor_id integer not null references public.doctors(id),
  doctor_last_read_at timestamptz,
  no_reply_needed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (patient_id, doctor_id)
);

create table public.chat_messages (
  id integer generated always as identity primary key,
  session_id integer not null references public.chat_sessions(id) on delete cascade,
  sender_user_id integer not null references public.users(id),
  sender_role text not null check (sender_role in ('PATIENT', 'DOCTOR')),
  message_type text not null default 'TEXT',
  message_text text,
  file_url text,
  sent_at timestamptz not null default now()
);
create index on public.chat_messages (session_id, id);

create table public.support_requests (
  id integer generated always as identity primary key,
  user_id integer not null references public.users(id),
  body jsonb not null,
  created_at timestamptz not null default now()
);

-- every table: RLS on, no policies (deny to anon/authenticated; the function connects as owner)
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;
