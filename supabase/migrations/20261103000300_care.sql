-- Consultations, chat and video: pilot doctors (sign in with these mobiles and the pilot code).
-- Their slots are generated on demand by the api (Mon to Sat, 10:00-13:00 and 15:00-19:00, India time).
insert into public.users (mobile, role, full_name, onboarding_completed) values
  ('9000000001', 'DOCTOR', 'Dr. Ananya Iyer', true),
  ('9000000002', 'DOCTOR', 'Dr. Rohan Mehta', true),
  ('9000000003', 'DOCTOR', 'Dr. Kavita Sharma', true)
on conflict (mobile) do update set role = 'DOCTOR', full_name = excluded.full_name, onboarding_completed = true;

insert into public.doctors (id, full_name, specialization, qualification, registration_no, experience, languages, about, consultation_fee_rupees)
select u.id, v.full_name, v.specialization, v.qualification, v.registration_no, v.experience, v.languages, v.about, 499
from (values
  ('9000000001', 'Dr. Ananya Iyer', 'Endocrinology', 'MBBS, MD (Medicine), DM (Endocrinology)', 'DMC/R/20431', '14 years',
    array['English','Hindi','Tamil'], 'Treats obesity, type 2 diabetes and thyroid conditions.'),
  ('9000000002', 'Dr. Rohan Mehta', 'Internal Medicine', 'MBBS, MD (Internal Medicine)', 'DMC/R/18877', '11 years',
    array['English','Hindi','Gujarati'], 'Focuses on metabolic health and long-term weight care.'),
  ('9000000003', 'Dr. Kavita Sharma', 'Diabetology', 'MBBS, DNB (Family Medicine), Fellowship in Diabetology', 'HMC/R/09124', '9 years',
    array['English','Hindi','Punjabi'], 'Works with people managing diabetes and prediabetes.')
) as v(mobile, full_name, specialization, qualification, registration_no, experience, languages, about)
join public.users u on u.mobile = v.mobile
on conflict (id) do nothing;
