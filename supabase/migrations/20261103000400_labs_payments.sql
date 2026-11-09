-- Lab bookings (Redcliffe) and payments (Razorpay): the columns the booking page and checkout need,
-- the webhook event logs, and the fulfilment guard.

alter table public.lab_bookings
  alter column status set default 'PAYMENT_PENDING',
  add column if not exists package_name text,
  add column if not exists fasting_note text not null default '',
  add column if not exists slot_id integer,
  add column if not exists slot_start text,              -- "HH:MM", India time
  add column if not exists slot_end text,
  add column if not exists hold_expires_at timestamptz,
  add column if not exists reschedule_count integer not null default 0,
  add column if not exists price jsonb not null default '{}',   -- { packagePrice, discount, collectionCharge, total } in rupees
  add column if not exists collector jsonb,              -- { name, phone, trackingUrl }
  add column if not exists tests jsonb not null default '[]',
  add column if not exists report_path text,             -- storage path in the "reports" bucket
  add column if not exists needs_attention text,         -- set when a paid booking could not be confirmed at the lab
  add column if not exists paid_at timestamptz;

alter table public.lab_bookings drop constraint if exists lab_bookings_status_check;
alter table public.lab_bookings add constraint lab_bookings_status_check check (status in
  ('PAYMENT_PENDING','BOOKED','COLLECTOR_ASSIGNED','SAMPLE_COLLECTED','PROCESSING','REPORT_READY','CANCELLED','EXPIRED'));

create table public.lab_booking_events (
  id integer generated always as identity primary key,
  lab_booking_id text references public.lab_bookings(id) on delete cascade,
  webhook_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

alter table public.payment_orders
  add column if not exists failure_reason text,
  add column if not exists fulfilled_at timestamptz;

-- Razorpay retries webhooks; an event id is handled once
create table public.razorpay_events (
  id text primary key,
  received_at timestamptz not null default now()
);

alter table public.lab_booking_events enable row level security;
alter table public.razorpay_events enable row level security;
