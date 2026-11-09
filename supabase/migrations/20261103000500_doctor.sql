-- InRange pilot: the doctor dashboard's own tables (call notes, private notes, audit, symptoms,
-- progress photos, clinical facts the doctor maintains). Reached only through the api function.

-- a signed prescription is replaced, not deleted: the previous one becomes SUPERSEDED
alter table public.prescriptions drop constraint if exists prescriptions_status_check;
alter table public.prescriptions add constraint prescriptions_status_check
  check (status in ('DRAFT', 'SIGNED', 'SUPERSEDED', 'VOID'));

-- one call note per consultation; the pilot has no scribe, so a draft opens empty when the call ends
create table public.clinical_notes (
  id integer generated always as identity primary key,
  appointment_id integer unique references public.appointments(id),
  patient_id integer not null references public.users(id),
  doctor_id integer not null references public.doctors(id),
  type text not null default 'FIRST_CONSULTATION' check (type in ('FIRST_CONSULTATION', 'FOLLOW_UP')),
  reason text not null default '',
  call_at timestamptz not null,
  minutes integer not null default 0,
  transcribed boolean not null default false,
  ready_at timestamptz not null default now(),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SIGNED')),
  sections jsonb not null,
  medicines jsonb not null default '[]',
  follow_ups jsonb not null default '[]',
  record_updates jsonb not null default '[]',
  checks jsonb not null default '{}',
  transcript jsonb not null default '[]',
  signed jsonb,                                   -- { at, by, byQualification, prescriptionVersion, sentToApp }
  prescription_id integer references public.prescriptions(id),
  history jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index on public.clinical_notes (doctor_id, status);
create index on public.clinical_notes (patient_id);

create table public.note_addenda (
  id integer generated always as identity primary key,
  note_id integer not null references public.clinical_notes(id) on delete cascade,
  doctor_id integer not null references public.doctors(id),
  text text not null,
  at timestamptz not null default now()
);

create table public.private_notes (
  id integer generated always as identity primary key,
  patient_id integer not null references public.users(id) on delete cascade,
  doctor_id integer not null references public.doctors(id),
  text text not null,
  at timestamptz not null default now()
);
create index on public.private_notes (patient_id);

create table public.audit_log (
  id integer generated always as identity primary key,
  patient_id integer references public.users(id) on delete cascade,
  actor_id integer references public.users(id),
  action text not null,
  at timestamptz not null default now()
);
create index on public.audit_log (patient_id, at desc);

create table public.symptom_logs (
  id integer generated always as identity primary key,
  patient_id integer not null references public.users(id) on delete cascade,
  label text not null,
  severity text not null check (severity in ('Mild', 'Moderate', 'Severe')),
  note text not null default '',
  requires_review boolean not null default true,
  at timestamptz not null default now(),
  acknowledged_by integer references public.doctors(id),
  acknowledged_at timestamptz,
  outcome text
);
create index on public.symptom_logs (patient_id, at desc);

create table public.progress_photos (
  id integer generated always as identity primary key,
  patient_id integer not null references public.users(id) on delete cascade,
  taken_at timestamptz not null default now(),
  front_path text,                                -- storage paths in the "photos" bucket
  side_path text,
  shared_with_doctor boolean not null default true
);
create index on public.progress_photos (patient_id);

-- what the doctor records about a patient beyond the onboarding answers (record updates land here)
create table public.patient_clinical (
  patient_id integer primary key references public.users(id) on delete cascade,
  identity_verified boolean not null default false,
  allergies text,
  outside_medicines text[],                       -- null: never asked; {}: asked, none
  plan jsonb,                                     -- { goals: [{ label, value }], reviewAt, notes }
  updated_at timestamptz not null default now()
);

alter table public.clinical_notes enable row level security;
alter table public.note_addenda enable row level security;
alter table public.private_notes enable row level security;
alter table public.audit_log enable row level security;
alter table public.symptom_logs enable row level security;
alter table public.progress_photos enable row level security;
alter table public.patient_clinical enable row level security;
