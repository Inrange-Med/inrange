-- The medicine flow after a prescription (docs/backend/medicine-flow.md; the PRD mapped in
-- docs/backend/medicine-flow-prd.md): messages to the patient (WhatsApp, with every send recorded),
-- the follow-up after a prescription, the medicine queue the team works from, delivery milestones and
-- feedback, refills, dose reminders and adherence, and the health coach. Everything a job does is
-- keyed so a repeated or late run never acts twice.

-- ---------------------------------------------------------------- the health coach
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('PATIENT', 'DOCTOR', 'ADMIN', 'COACH'));
-- the patient's health coach (a COACH user); the coach sees only their own patients
alter table public.patient_profiles add column coach_id integer references public.users(id);
create index on public.patient_profiles (coach_id) where coach_id is not null;

-- ---------------------------------------------------------------- deliveries
alter table public.medicine_orders drop constraint if exists medicine_orders_status_check;
alter table public.medicine_orders add constraint medicine_orders_status_check
  check (status in ('PLACED', 'PACKED', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'));
alter table public.medicine_orders
  add column flow text not null default 'NANO' check (flow in ('NANO', 'PLAN')),
  add column courier text,
  add column packed_at timestamptz,
  add column dispatched_at timestamptz,
  add column delivered_at timestamptz,
  add column cancelled_at timestamptz,
  add column cancel_reason text,
  add column refund_id text,
  add column refunded_paise integer,
  -- the days the order lasts: the shortest of its lines (quantity x the pack's days)
  add column supply_days integer,
  add column feedback text check (feedback in ('GOOD', 'ISSUE')),
  add column feedback_note text,
  add column feedback_at timestamptz;
create index on public.medicine_orders (status);

-- ---------------------------------------------------------------- carts: a refill is a second cart on the same prescription
alter table public.medicine_carts drop constraint if exists medicine_carts_prescription_id_key;
create unique index medicine_carts_one_open on public.medicine_carts (prescription_id) where status = 'OPEN';
alter table public.medicine_carts
  add column kind text not null default 'FIRST' check (kind in ('FIRST', 'REFILL')),
  -- the patient said they bought these elsewhere: no more reminders about this cart
  add column elsewhere_at timestamptz;

-- ---------------------------------------------------------------- messages to the patient
-- One row per message, sent or not. `dedupe_key` makes every trigger idempotent ("rx:41:ready",
-- "order:7:dispatched", "dose:310:reminder"). Template names and wording: lib/messages.ts.
create table public.patient_messages (
  id integer generated always as identity primary key,
  patient_id integer not null references public.users(id) on delete cascade,
  kind text not null,
  channel text not null default 'WHATSAPP' check (channel in ('WHATSAPP')),
  vars jsonb not null default '{}',
  dedupe_key text not null unique,
  status text not null default 'QUEUED' check (status in ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED')),
  skip_reason text,
  send_after timestamptz not null default now(),
  attempts integer not null default 0,
  provider_id text unique,
  error text,
  prescription_id integer references public.prescriptions(id),
  cart_id integer references public.medicine_carts(id),
  medicine_order_id integer references public.medicine_orders(id),
  dose_event_id integer,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz
);
create index on public.patient_messages (send_after) where status = 'QUEUED';
create index on public.patient_messages (patient_id, created_at desc);

-- What came back: button taps, list picks and free text. `provider_event_id` drops a webhook retry.
create table public.patient_message_replies (
  id integer generated always as identity primary key,
  patient_id integer not null references public.users(id) on delete cascade,
  message_id integer references public.patient_messages(id),
  provider_event_id text unique,
  action text,          -- the button's code ("HELP", "TAKEN", "GOOD"), null for free text
  text text,
  outcome text,         -- what the handler did, for the timeline
  received_at timestamptz not null default now()
);
create index on public.patient_message_replies (patient_id, received_at desc);

-- ---------------------------------------------------------------- the follow-up after a prescription
-- One per cart. The nano plan's check-ins are timed from when its cart opens, so the 48-hour hold and
-- the PRD's two check-ins both hold; a plan patient's cart opens at once.
create table public.medicine_followups (
  id integer generated always as identity primary key,
  cart_id integer not null unique references public.medicine_carts(id) on delete cascade,
  patient_id integer not null references public.users(id) on delete cascade,
  flow text not null check (flow in ('NANO', 'PLAN')),
  stage text not null default 'WAITING' check (stage in ('WAITING', 'CHECK_IN_1', 'CHECK_IN_2', 'CALL', 'DONE')),
  next_at timestamptz,
  check_ins integer not null default 0,
  closed_reason text check (closed_reason in ('PAID', 'ELSEWHERE', 'DECLINED', 'SUPERSEDED', 'EXPIRED', 'CALLED')),
  closed_at timestamptz,
  history jsonb not null default '[]',   -- [{ at, what }]
  created_at timestamptz not null default now()
);
create index on public.medicine_followups (next_at) where closed_at is null;

-- ---------------------------------------------------------------- the medicine queue
create table public.ops_tasks (
  id integer generated always as identity primary key,
  kind text not null check (kind in ('NO_REPLY', 'QUESTIONS', 'PLAN_CALL', 'PAYMENT_FAILED', 'DISPATCH_DUE',
    'DELIVERY_LATE', 'DELIVERY_ISSUE', 'RENEWAL', 'REFILL_GAP', 'ADHERENCE', 'RECONCILE')),
  priority text not null default 'NORMAL' check (priority in ('CRITICAL', 'HIGH', 'NORMAL')),
  patient_id integer references public.users(id) on delete cascade,
  prescription_id integer references public.prescriptions(id),
  cart_id integer references public.medicine_carts(id),
  medicine_order_id integer references public.medicine_orders(id),
  payment_order_id text references public.payment_orders(id),
  title text not null,
  detail text,
  due_at timestamptz not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'DONE')),
  outcome text,
  outcome_note text,
  assigned_to integer references public.users(id),
  done_by integer references public.users(id),
  done_at timestamptz,
  dedupe_key text unique,
  history jsonb not null default '[]',   -- [{ at, by, what }]
  created_at timestamptz not null default now()
);
create index on public.ops_tasks (status, due_at);
create index on public.ops_tasks (patient_id);

-- ---------------------------------------------------------------- doses (patients on a plan)
create table public.dose_schedules (
  id integer generated always as identity primary key,
  patient_id integer not null references public.users(id) on delete cascade,
  prescription_id integer references public.prescriptions(id),
  medicine_order_id integer references public.medicine_orders(id),
  medicine text not null,              -- "Mounjaro KwikPen 2.5 mg", in the app only, never in a message
  cadence text not null check (cadence in ('WEEKLY', 'DAILY', 'TWICE_DAILY')),
  weekday integer check (weekday between 1 and 7),   -- ISO, for WEEKLY
  times text[] not null default '{09:00}',            -- India time, HH:MM
  starts_on date not null,
  ends_on date,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  unique (medicine_order_id, medicine)
);
create index on public.dose_schedules (patient_id);

create table public.dose_events (
  id integer generated always as identity primary key,
  schedule_id integer not null references public.dose_schedules(id) on delete cascade,
  patient_id integer not null references public.users(id) on delete cascade,
  due_at timestamptz not null,
  status text not null default 'DUE' check (status in ('DUE', 'TAKEN', 'TAKEN_LATE', 'SKIPPED', 'MISSED')),
  skip_reason text check (skip_reason in ('UNWELL', 'FORGOT', 'SIDE_EFFECTS', 'OTHER')),
  snoozes integer not null default 0,
  responded_at timestamptz,
  unique (schedule_id, due_at)
);
create index on public.dose_events (patient_id, due_at desc);
create index on public.dose_events (due_at) where status = 'DUE';
alter table public.patient_messages add constraint patient_messages_dose_event_fk
  foreign key (dose_event_id) references public.dose_events(id) on delete set null;

-- ---------------------------------------------------------------- jobs
-- When each daily job last ran (the tick runs every few minutes; a daily job runs on its first tick of the day).
create table public.job_runs (
  name text primary key,
  last_run_at timestamptz not null,
  summary jsonb not null default '{}'
);

-- ---------------------------------------------------------------- lock down (lockdown.sql conventions)
alter table public.patient_messages enable row level security;
alter table public.patient_message_replies enable row level security;
alter table public.medicine_followups enable row level security;
alter table public.ops_tasks enable row level security;
alter table public.dose_schedules enable row level security;
alter table public.dose_events enable row level security;
alter table public.job_runs enable row level security;
revoke all on public.patient_messages, public.patient_message_replies, public.medicine_followups, public.ops_tasks,
  public.dose_schedules, public.dose_events, public.job_runs from anon, authenticated;
