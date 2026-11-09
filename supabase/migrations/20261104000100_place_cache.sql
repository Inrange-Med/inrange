-- Mock-mode address search (Photon / OpenStreetMap): each place offered gets a 6-character eloc,
-- and its point is kept here so GET /api/labs/locations/:eloc can answer. Disposable cache.
create table public.place_cache (
  eloc text primary key,
  latitude double precision not null,
  longitude double precision not null,
  place jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.place_cache enable row level security;
revoke all on public.place_cache from anon, authenticated;
