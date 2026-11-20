-- The Nano plan (blood tests at home, the doctor's consultation and the coach call), priced on the client call of
-- 19 Nov 2026 and shown EZWeight style at the user's request (20 Nov 2026): Rs 1,799 against Rs 3,999 crossed out.
-- The crossed-out price is real: what the parts cost bought separately (Redcliffe lists the blood test package,
-- PL70, at Rs 3,000; our consultation alone is Rs 999). No countdown, no "lowest price ever", no "X booked a
-- minute ago": false urgency and invented social proof (CCPA dark-pattern guidelines, 2023).
alter table public.care_packages add column if not exists mrp_rupees integer;
update public.care_packages set price_rupees = 1799, mrp_rupees = 3999 where code = 'LAB_AND_CONSULT';

-- an optional test added to a care package's home collection, ticked on the review before paying
create table if not exists public.care_addons (
  code text primary key,
  care_package_code text not null references public.care_packages(code),
  name text not null,
  description text not null default '',
  price_rupees integer not null check (price_rupees > 0),
  mrp_rupees integer,
  active boolean not null default true,
  sort_order integer not null default 0
);
alter table public.care_addons enable row level security;
insert into public.care_addons (code, care_package_code, name, description, price_rupees, mrp_rupees, sort_order)
values ('CORTISOL', 'LAB_AND_CONSULT', 'Cortisol test', 'Your stress hormone, which can make weight harder to lose.', 300, 350, 1)
on conflict (code) do nothing;

-- until Redcliffe's production catalogue gives the add-on's own code, the team adds it to the booking by hand
alter table public.ops_tasks drop constraint if exists ops_tasks_kind_check;
alter table public.ops_tasks add constraint ops_tasks_kind_check check (kind in ('NO_REPLY', 'QUESTIONS', 'PLAN_CALL',
  'PAYMENT_FAILED', 'DISPATCH_DUE', 'DELIVERY_LATE', 'DELIVERY_ISSUE', 'RENEWAL', 'REFILL_GAP', 'ADHERENCE', 'RECONCILE',
  'MATCH_MEDICINE', 'LAB_ADD_ON'));
