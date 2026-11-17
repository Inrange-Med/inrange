-- The tick (POST /api/jobs/tick, routes/jobs.ts) every 5 minutes, from the database: follow-ups, order
-- checks, doses, the daily refills and payment check, and every WhatsApp message that is due. The URL and
-- the secret come from Vault, so nothing secret is in git and a database without them does nothing:
--   select vault.create_secret('<JOBS_SECRET>', 'jobs_secret');
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/api/jobs/tick?forceFunctionRegion=ap-south-1', 'tick_url');
-- The function needs the same JOBS_SECRET (supabase secrets set JOBS_SECRET=...). docs/backend/whatsapp.md.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('inrange-tick', '*/5 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'tick_url'),
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-jobs-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'jobs_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 120000)
  where exists (select 1 from vault.decrypted_secrets where name = 'tick_url')
$$);
