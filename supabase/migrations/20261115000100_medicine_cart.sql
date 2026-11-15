-- The pharmacy catalogue, the prescription's prefilled cart, and the programme prices from the
-- pricing sheet ("Program Pricing", Nov 2026). docs/backend/medicine-cart.md.
--
-- Customer prices (MRP, the discounted price, a plan's MRP and price) may reach the app.
-- INTERNAL prices (what a pack costs us, PTS incl. GST; what a plan's services cost us) live ONLY in
-- the *_costs tables. No route selects from them except the cart's below-cost guard (lib/pharmacy.ts),
-- so a `select *` on medicines or plans can never leak them.

create table public.medicines (
  id integer generated always as identity primary key,
  brand text not null,                    -- "Mounjaro KwikPen"
  molecule text not null,                 -- "Tirzepatide" (the generic name, printed in capitals on the Rx)
  form text not null,                     -- "Pen injection", "Tablet"
  strength text not null,                 -- "2.5 mg"
  pack text not null,                     -- one unit of quantity, printed as "3 x pen (4 weekly doses)"
  pack_days integer not null check (pack_days > 0),
  route text not null default '',         -- "Under the skin"
  default_frequency text not null default '',
  mrp_paise integer not null check (mrp_paise > 0),
  active boolean not null default true,
  unique (brand, strength)
);

create table public.medicine_costs (
  medicine_id integer primary key references public.medicines(id) on delete cascade,
  cost_paise integer not null check (cost_paise > 0),   -- PTS incl. GST: what we pay
  updated_at timestamptz not null default now()
);

-- the default discount on a prescription's cart, by the prescription's length (sheet: 3 months 13%,
-- 6 months 14%; 1 to 2 months 13% by decision, 15 Nov 2026). The highest min_months not above it wins.
create table public.medicine_discounts (
  min_months integer primary key check (min_months >= 1),
  percent numeric(4,1) not null check (percent >= 0 and percent < 50)
);
insert into public.medicine_discounts values (1, 13), (6, 14);

-- Pricing sheet, "With Medication", Step 1 (1 pen = 1 month). MRP and PTS in rupees x 100.
with rows (brand, molecule, strength, mrp, pts) as (values
  ('Wegovy FlexTouch', 'Semaglutide', '0.25 mg', 566000, 437405),
  ('Wegovy FlexTouch', 'Semaglutide', '0.5 mg', 810000, 625968),
  ('Wegovy FlexTouch', 'Semaglutide', '1 mg', 910000, 703248),
  ('Wegovy FlexTouch', 'Semaglutide', '1.7 mg', 1275000, 985320),
  ('Wegovy FlexTouch', 'Semaglutide', '2.4 mg', 1640000, 1267392),
  ('Ozempic', 'Semaglutide', '0.25 mg', 566000, 437405),
  ('Ozempic', 'Semaglutide', '0.5 mg', 810000, 625968),
  ('Ozempic', 'Semaglutide', '1 mg', 910000, 703248),
  ('Mounjaro KwikPen', 'Tirzepatide', '2.5 mg', 1312500, 1014300),
  ('Mounjaro KwikPen', 'Tirzepatide', '5 mg', 1640625, 1267875),
  ('Mounjaro KwikPen', 'Tirzepatide', '7.5 mg', 2062500, 1593900),
  ('Mounjaro KwikPen', 'Tirzepatide', '10 mg', 2062500, 1593900),
  ('Mounjaro KwikPen', 'Tirzepatide', '12.5 mg', 2578125, 1992375),
  ('Mounjaro KwikPen', 'Tirzepatide', '15 mg', 2578125, 1992375)
), ins as (
  insert into public.medicines (brand, molecule, form, strength, pack, pack_days, route, default_frequency, mrp_paise)
  select brand, molecule, 'Pen injection', strength, 'pen (4 weekly doses)', 28, 'Under the skin',
         'Once a week, same day each week', mrp from rows
  returning id, brand, strength
)
insert into public.medicine_costs (medicine_id, cost_paise)
select ins.id, rows.pts from ins join rows using (brand, strength);

create index medicines_search_idx on public.medicines (lower(brand), lower(molecule));

-- Programme plans (sheet, "Pricing"): the app shows MRP struck through and charges the price (the
-- sheet's floor), by decision on 15 Nov 2026. The old 1/4/6/12-month pilot plans stop being offered;
-- existing subscriptions keep pointing at them.
alter table public.plans add column mrp_rupees integer check (mrp_rupees is null or mrp_rupees >= price_rupees);
create table public.plan_costs (
  plan_id integer primary key references public.plans(id) on delete cascade,
  cost_rupees integer not null,            -- sheet Step 3 "total package value": what the services cost us
  updated_at timestamptz not null default now()
);
update public.plans set active = false where active;
with rows (months, mrp, price, cost, sort, features) as (values
  (3, 20000, 16999, 9300, 1, '["A doctor review every month", "Weekly calls with your health coach", "Weekly fitness calls", "Chat with your care team", "Medicine only if your doctor prescribes it"]'),
  (6, 36000, 31999, 19400, 2, '["A doctor review every month", "Weekly calls with your health coach", "Weekly fitness calls", "Blood tests at home, once", "Chat with your care team", "Medicine only if your doctor prescribes it"]'),
  (9, 48000, 41999, 29500, 3, '["A doctor review every month", "Weekly calls with your health coach", "Weekly fitness calls", "Blood tests at home, twice", "Chat with your care team", "Medicine only if your doctor prescribes it"]'),
  (12, 55000, 48999, 39600, 4, '["A doctor review every month", "Weekly calls with your health coach", "Weekly fitness calls", "Blood tests at home, three times", "Chat with your care team", "Medicine only if your doctor prescribes it"]')
), ins as (
  insert into public.plans (name, description, duration_months, price_rupees, mrp_rupees, features, sort_order)
  select 'inrange ' || months || ' months', months || ' months of doctor-led care.', months, price, mrp, features::jsonb, sort
  from rows returning id, duration_months
)
insert into public.plan_costs (plan_id, cost_rupees)
select ins.id, rows.cost from ins join rows on rows.months = ins.duration_months;

-- the call note's length, out of the package lines (12 Nov 2026 call: no screen shows a length)
update public.care_packages set description = 'A video consultation with a doctor.',
  includes = '["Video consultation with a doctor", "A call with your health coach"]' where code = 'CONSULT_ONLY';
update public.care_packages set includes =
  '["Blood tests at home", "Video consultation with a doctor", "A call with your health coach"]' where code = 'LAB_AND_CONSULT';

-- a prescription's length (the cart covers it) and until when it may be dispensed
alter table public.prescriptions add column months integer not null default 1 check (months between 1 and 12);
alter table public.prescriptions add column valid_until timestamptz;

-- the cart a signed prescription creates: lines are inventory items, quantity up to what was prescribed.
-- Prices are read live from medicines when shown and frozen into the payment order at checkout.
create table public.medicine_carts (
  id integer generated always as identity primary key,
  patient_id integer not null references public.users(id) on delete cascade,
  prescription_id integer not null unique references public.prescriptions(id),
  status text not null default 'OPEN' check (status in ('OPEN', 'PAID', 'CLOSED')),
  available_at timestamptz not null,       -- first consultation without a plan: signed + NANO_CART_DELAY_HOURS
  lines jsonb not null,                    -- [{ medicineId, quantity, prescribed }]
  address_id integer references public.addresses(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index on public.medicine_carts (patient_id, status);

alter table public.payment_orders drop constraint if exists payment_orders_purpose_check;
alter table public.payment_orders add constraint payment_orders_purpose_check
  check (purpose in ('PLAN', 'LAB_BOOKING', 'CONSULTATION_FEE', 'MEDICINE_ORDER'));

alter table public.medicine_orders add column cart_id integer references public.medicine_carts(id);
alter table public.medicine_orders add column address_id integer references public.addresses(id);
alter table public.medicine_orders add column payment_order_id text references public.payment_orders(id);

alter table public.medicines enable row level security;
alter table public.medicine_costs enable row level security;
alter table public.medicine_discounts enable row level security;
alter table public.plan_costs enable row level security;
alter table public.medicine_carts enable row level security;
revoke all on public.medicines, public.medicine_costs, public.medicine_discounts, public.plan_costs,
  public.medicine_carts from anon, authenticated;
