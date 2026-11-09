-- Patient side: report dates and review status, the free-text health profile, and pilot seed data
-- (plans and the packages a new patient buys before the first consultation).

alter table public.reports add column if not exists report_date date;
alter table public.reports add column if not exists review_status text
  check (review_status in ('UNDER_REVIEW', 'APPROVED', 'NOT_APPROVED'));

-- the Profile screen's "Health profile" edits conditions as one line of text
alter table public.patient_profiles add column if not exists conditions_text text;

-- prices are the whole plan in rupees; longer plans carry a modest discount on 4,500 a month
insert into public.plans (name, description, duration_months, price_rupees, features, sort_order) values
  ('InRange 1 month', 'One month of doctor-led care.', 1, 4500,
   '["Doctor review every 14 days", "Chat with your care team", "Medicine only if your doctor prescribes it"]', 1),
  ('InRange 4 months', 'Four months of doctor-led care.', 4, 17100,
   '["Doctor review every 14 days", "Chat with your care team", "Lab review every 3 months", "Medicine only if your doctor prescribes it"]', 2),
  ('InRange 6 months', 'Six months of doctor-led care.', 6, 24300,
   '["Doctor review every 14 days", "Chat with your care team", "Lab review every 3 months", "Medicine only if your doctor prescribes it"]', 3),
  ('InRange 12 months', 'Twelve months of doctor-led care.', 12, 45900,
   '["Doctor review every 14 days", "Chat with your care team", "Lab review every 3 months", "Medicine only if your doctor prescribes it"]', 4);

insert into public.care_packages (code, name, description, price_rupees, includes_lab_tests, lab_package_code, includes, sort_order) values
  ('CONSULT_ONLY', 'Consultation', 'A 30-minute video consultation with a doctor.', 999, false, null,
   '["30-minute video consultation"]', 1),
  ('LAB_AND_CONSULT', 'Lab tests and consultation', 'Home blood tests by Redcliffe Labs, then your consultation.', 1499, true, 'MD028',
   '["Home sample collection", "Blood tests your doctor needs", "30-minute video consultation"]', 2)
on conflict (code) do nothing;
