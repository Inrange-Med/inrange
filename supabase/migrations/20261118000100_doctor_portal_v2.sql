-- Doctor portal v2 (17 Nov 2026 call, docs/backend/doctor-portal-v2-prd.md): one prescription per
-- consultation, written on the consultation page while the call runs in another tab. It saves as the
-- doctor types (DRAFT), "Create PDF" makes the patient's copy (pdf_made_at), "Send to patient" signs and
-- sends it (sent_at). Editing after the PDF was made takes the PDF away until it is made again, so the
-- PDF on the page is always exactly what the patient gets. "Edit and send new version" opens a new DRAFT
-- version for the same consultation; sending it supersedes the old one, as before.

alter table public.prescriptions add column diagnosis text;          -- required before the PDF
alter table public.prescriptions add column patient_history text;
alter table public.prescriptions add column remarks text;
alter table public.prescriptions add column advice text;
alter table public.prescriptions add column saved_at timestamptz;    -- the last autosave ("Saved 7:14 pm")
alter table public.prescriptions add column pdf_made_at timestamptz; -- the PDF in pdf_path is current
alter table public.prescriptions add column sent_at timestamptz;     -- first sent to the patient
alter table public.prescriptions add column resent_at timestamptz;   -- the last "Send again"

-- one draft at a time per consultation (the page's autosave target); an older duplicate draft is voided first
update public.prescriptions x set status = 'VOID'
where x.status = 'DRAFT' and x.appointment_id is not null
  and exists (select 1 from public.prescriptions y where y.appointment_id = x.appointment_id and y.status = 'DRAFT' and y.id > x.id);
create unique index prescriptions_one_draft_per_consultation
  on public.prescriptions (appointment_id) where status = 'DRAFT' and appointment_id is not null;
create index on public.prescriptions (appointment_id);

-- The master list (PDPL's medicines and supplements, searchable by the doctor). An item without a price is
-- on the list (it prints, and searching finds it, so nobody types it again) but the pharmacy does not sell
-- it yet, so it never reaches a cart. Import: docs/backend/doctor-portal-v2.md, "The master list".
alter table public.medicines add column kind text not null default 'MEDICINE' check (kind in ('MEDICINE', 'SUPPLEMENT'));
alter table public.medicines add column default_dose text not null default '';   -- "1 tablet", "1 injection"
alter table public.medicines add column sku text unique;                          -- PDPL's product code
alter table public.medicines alter column mrp_paise drop not null;
update public.medicines set default_dose = '1 injection' where form = 'Pen injection' and default_dose = '';

-- a medicine the doctor added that is not on the list: printed, not orderable until admin matches it
alter table public.ops_tasks drop constraint if exists ops_tasks_kind_check;
alter table public.ops_tasks add constraint ops_tasks_kind_check check (kind in ('NO_REPLY', 'QUESTIONS', 'PLAN_CALL',
  'PAYMENT_FAILED', 'DISPATCH_DUE', 'DELIVERY_LATE', 'DELIVERY_ISSUE', 'RENEWAL', 'REFILL_GAP', 'ADHERENCE', 'RECONCILE',
  'MATCH_MEDICINE'));
