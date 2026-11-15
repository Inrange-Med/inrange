-- Prescription template v2 (16 Nov 2026): what the PDF now prints beyond the first version.
-- Per medicine: how to store it and when to contact us. Per doctor: the council that registered them,
-- the practice address and contact the Telemedicine Practice Guidelines ask for on a prescription.

alter table public.medicines add column storage text not null default '';
alter table public.medicines add column seek_help text not null default '';
update public.medicines set
  storage = 'Keep pens in the fridge (2 to 8°C). Do not freeze.',
  seek_help = 'Severe or lasting stomach pain, vomiting that won''t stop, or signs of an allergic reaction. In an emergency, go to the nearest hospital.'
where form = 'Pen injection';

alter table public.doctors add column council text;            -- "Delhi Medical Council"
alter table public.doctors add column practice_address text;   -- printed under the registration (CONFIRM per doctor)
alter table public.doctors add column contact text;            -- a phone or email the patient may use (CONFIRM per doctor)
update public.doctors set council = case split_part(registration_no, '/', 1)
  when 'DMC' then 'Delhi Medical Council' when 'HMC' then 'Haryana Medical Council'
  when 'UPMC' then 'Uttar Pradesh Medical Council' when 'NMC' then 'National Medical Commission' end
where council is null and registration_no is not null;
