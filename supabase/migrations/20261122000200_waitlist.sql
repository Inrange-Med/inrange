-- Waitlist for the coming-soon programmes (src/components/landing/Waitlist.tsx), 22 Nov 2026: it drafted an email
-- to care@inrangemed.com, which is not set up, so sign-ups are kept here instead. Only what the form asks: name,
-- mobile, city, and when the unticked consent box was ticked. One row per programme and mobile.
create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  programme text not null check (programme in ('pcos', 'sexual')),
  name text not null,
  mobile text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  city text not null,
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (programme, mobile)
);
alter table public.waitlist enable row level security;
