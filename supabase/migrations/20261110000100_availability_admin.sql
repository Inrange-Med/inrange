-- Doctors' own hours (weekly ranges) and days off; slots are generated from them on demand
-- (routes/care.ts prepareSlots). A doctor with no weekly ranges keeps the default timetable.
create table public.doctor_hours (
  id integer generated always as identity primary key,
  doctor_id integer not null references public.doctors(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),   -- ISO: 1 Monday .. 7 Sunday
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index on public.doctor_hours (doctor_id);

create table public.doctor_days_off (
  doctor_id integer not null references public.doctors(id) on delete cascade,
  day date not null,
  primary key (doctor_id, day)
);

-- who decided an eligibility review, and when (the admin area)
alter table public.eligibility add column reviewed_by integer references public.users(id);
alter table public.eligibility add column reviewed_at timestamptz;

alter table public.doctor_hours enable row level security;
alter table public.doctor_days_off enable row level security;
