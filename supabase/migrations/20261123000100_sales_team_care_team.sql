-- The sales team and the patient's doctors (the user, 23 Nov 2026).
-- Sales team: a list admin keeps, ranked (1 is the best). A patient's salesperson and the seller of a plan now point
-- at a person on it; the name stays beside the id (patient_profiles.salesperson, plan_recommendations.salesperson),
-- so everything that reads the name keeps working.
create table if not exists public.salespeople (
  id integer generated always as identity primary key,
  full_name text not null,
  mobile text check (mobile is null or mobile ~ '^[6-9][0-9]{9}$'),
  -- the order of the list: 1 is the best. Only the order among active people is shown.
  rank integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists salespeople_name on public.salespeople (lower(full_name));
alter table public.salespeople enable row level security;

alter table public.patient_profiles add column if not exists salesperson_id integer references public.salespeople(id) on delete set null;
alter table public.plan_recommendations add column if not exists salesperson_id integer references public.salespeople(id) on delete set null;

-- the names typed by hand until now become the first people on the list, in the order they first appeared
insert into public.salespeople (full_name, rank)
select name, row_number() over (order by first_at, name)
from (
  select distinct on (lower(name)) name, first_at from (
    select trim(salesperson) as name, updated_at as first_at from public.patient_profiles where nullif(trim(salesperson), '') is not null
    union all
    select trim(salesperson), created_at from public.plan_recommendations where nullif(trim(salesperson), '') is not null
  ) typed order by lower(name), first_at
) names
on conflict do nothing;
update public.patient_profiles p set salesperson_id = s.id from public.salespeople s
  where p.salesperson_id is null and lower(trim(p.salesperson)) = lower(s.full_name);
update public.plan_recommendations r set salesperson_id = s.id from public.salespeople s
  where r.salesperson_id is null and lower(trim(r.salesperson)) = lower(s.full_name);

-- The patient's doctors: more than one can be on the care team. The doctor of the first consultation joins by
-- default (lib/careTeam.ts); admin adds and removes the rest. patient_profiles.care_team_doctor_id stays as the main
-- doctor (the one who joined first and is still on the team).
create table if not exists public.care_team_doctors (
  patient_id integer not null references public.users(id) on delete cascade,
  doctor_id integer not null references public.doctors(id) on delete cascade,
  added_by integer references public.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (patient_id, doctor_id)
);
create index if not exists care_team_doctors_doctor on public.care_team_doctors (doctor_id);
alter table public.care_team_doctors enable row level security;
insert into public.care_team_doctors (patient_id, doctor_id)
select user_id, care_team_doctor_id from public.patient_profiles where care_team_doctor_id is not null
on conflict do nothing;
