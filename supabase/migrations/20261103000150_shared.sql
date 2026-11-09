-- Shared clinical tables read by several route groups (care tab, doctor dashboard, payments).
create table public.prescriptions (
  id integer generated always as identity primary key,
  patient_id integer not null references public.users(id),
  doctor_id integer not null references public.doctors(id),
  appointment_id integer references public.appointments(id),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SIGNED', 'VOID')),
  version integer not null default 1,
  items jsonb not null default '[]',   -- [{ medicineName, strength, dose, frequency, route, instructions, reason, genericName }]
  pdf_path text,                       -- storage path in the "prescriptions" bucket
  signed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.prescriptions (patient_id, status);

create table public.medicine_orders (
  id integer generated always as identity primary key,
  patient_id integer not null references public.users(id),
  prescription_id integer references public.prescriptions(id),
  status text not null default 'PLACED' check (status in ('PLACED', 'PACKED', 'DISPATCHED', 'DELIVERED')),
  placed_at timestamptz not null default now(),
  expected_at timestamptz,
  tracking_no text,
  tracking_url text,
  items jsonb not null default '[]',   -- [{ name, quantity }]
  history jsonb not null default '[]'  -- [{ status, at, note }]
);

alter table public.prescriptions enable row level security;
alter table public.medicine_orders enable row level security;


-- Addresses (patient), reports (uploads and lab results) and lab bookings: shared because the
-- patient app, the lab flow, payments and the doctor's record all read them. Owners may ALTER to add columns.
create table public.addresses (
  id integer generated always as identity primary key,
  user_id integer not null references public.users(id) on delete cascade,
  label text not null default 'Home',
  full_name text,
  line1 text not null,
  line2 text,
  landmark text,
  city text,
  state text,
  pincode text check (pincode ~ '^[1-9][0-9]{5}$'),
  latitude double precision,
  longitude double precision,
  eloc text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.addresses (user_id);

create table public.reports (
  id integer generated always as identity primary key,
  user_id integer not null references public.users(id) on delete cascade,
  purpose text not null default 'GENERAL',       -- ELIGIBILITY | GENERAL | ...
  source text not null default 'UPLOAD' check (source in ('UPLOAD', 'LAB')),
  title text,
  file_path text,                                -- storage path in the "reports" bucket
  file_name text,
  mime_type text,
  size_bytes integer,
  lab_booking_id text,
  status text not null default 'RECEIVED' check (status in ('RECEIVED', 'REVIEWED')),
  reviewed_by integer references public.doctors(id),
  reviewed_at timestamptz,
  review_note text,
  uploaded_at timestamptz not null default now()
);
create index on public.reports (user_id);

create sequence public.lab_booking_seq start 1001;
create table public.lab_bookings (
  id text primary key default ('LB-' || nextval('public.lab_booking_seq')),
  user_id integer not null references public.users(id) on delete cascade,
  care_package_code text references public.care_packages(code),
  lab_package_code text not null,
  address_id integer references public.addresses(id),
  slot_date date,
  slot_time text,
  status text not null default 'AWAITING_PAYMENT',
  amount_paise integer not null default 0,
  person jsonb not null default '{}',            -- { name, gender, ageYears } of whoever gives the sample
  provider text not null default 'mock',
  provider_booking_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.lab_bookings (user_id);

alter table public.addresses enable row level security;
alter table public.reports enable row level security;
alter table public.lab_bookings enable row level security;

-- private file buckets (reached only through signed URLs minted by the api function)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('reports', 'reports', false, 15728640, array['application/pdf','image/jpeg','image/png','image/heic','image/webp']),
  ('prescriptions', 'prescriptions', false, 10485760, array['application/pdf']),
  ('photos', 'photos', false, 15728640, array['image/jpeg','image/png','image/heic','image/webp'])
on conflict (id) do nothing;
