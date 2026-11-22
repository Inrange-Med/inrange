-- Redcliffe production (22 Nov 2026): the Nano plan books the package Redcliffe made for inrange, "Range Assessment
-- Package" CAMP11467 (48 parameters: CBC, lipid profile, eGFR, creatinine, HbA1c, fasting sugar, fasting insulin,
-- vitamin D, vitamin B12, SGOT, SGPT, TSH, hsCRP; go-live price and lab MRP Rs 1,700). PL70 was the QA code.
-- Apply together with the production REDCLIFFE_BASE_URL and key: QA has no CAMP11467.
-- The description loses the lab's name (client, 19 Nov 2026: the lab is never named to patients).
update public.care_packages
set lab_package_code = 'CAMP11467',
    description = 'Home blood tests, then your consultation.'
where code = 'LAB_AND_CONSULT';
