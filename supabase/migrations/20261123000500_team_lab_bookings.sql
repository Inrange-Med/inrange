-- The team books a blood test for a patient on a call (23 Nov 2026 call: about a third do not book by themselves),
-- and a payment link can be for that booking as well as for a plan. When such a link is paid the collection is
-- confirmed by itself, exactly as a payment in the app would.
alter table public.payment_links
  add column if not exists purpose text not null default 'PLAN' check (purpose in ('PLAN', 'LAB_BOOKING')),
  add column if not exists lab_booking_id text references public.lab_bookings(id) on delete cascade;
alter table public.payment_links alter column plan_id drop not null;
alter table public.payment_links drop constraint if exists payment_links_what;
alter table public.payment_links add constraint payment_links_what
  check ((purpose = 'PLAN' and plan_id is not null) or (purpose = 'LAB_BOOKING' and lab_booking_id is not null));
-- who on the team made a booking for the patient (null: the patient booked it)
alter table public.lab_bookings add column if not exists booked_by integer references public.users(id) on delete set null;
