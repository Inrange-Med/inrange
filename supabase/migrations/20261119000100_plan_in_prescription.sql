-- The plan is part of the prescription (19 Nov 2026: no friction, everything bought together). The doctor picks it
-- with the medicines; sending puts it in the same cart, so the patient pays once for the plan and the medicines.
alter table public.prescriptions add column plan_id integer references public.plans(id);
alter table public.medicine_carts add column plan_id integer references public.plans(id);
