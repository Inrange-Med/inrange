-- What a report file really is, read from its bytes when it arrives (lib/fileCheck.ts), so an admin can
-- spot an edited, old or reused report: the file's fingerprint (the same file under another patient is
-- a warning) and, for a PDF, the app that made it and its created and changed dates.
alter table public.reports add column sha256 text;
alter table public.reports add column file_meta jsonb;
create index reports_sha256_idx on public.reports (sha256) where sha256 is not null;
