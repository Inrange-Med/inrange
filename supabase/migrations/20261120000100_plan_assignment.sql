-- The plan is sold, not prescribed (client call, 19 Nov 2026; the user, 20 Nov 2026): a salesperson sells it on the
-- call after the doctor, tells admin, and admin puts the patient on it. The patient then pays for it in the app (with
-- any medicines waiting, in one payment). An assignment is a plan_recommendations row with no doctor.
alter table public.plan_recommendations alter column doctor_id drop not null;
alter table public.plan_recommendations
  add column if not exists assigned_by integer references public.users(id),
  add column if not exists salesperson text;
-- who sold to (or is selling to) the patient; the doctor sees it, and so does admin
alter table public.patient_profiles add column if not exists salesperson text;
