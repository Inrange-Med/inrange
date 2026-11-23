-- One waiting payment link per patient for a plan, and one for a blood test: the two never replace each other.
drop index if exists public.payment_links_one_open;
create unique index if not exists payment_links_one_open on public.payment_links (patient_id, purpose) where status = 'CREATED';
