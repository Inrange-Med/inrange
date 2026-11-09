-- "public" is only the schema name. Belt and braces on top of RLS-with-no-policies: Supabase's
-- Data API roles (anon, authenticated) get no privileges on any table, sequence or function here,
-- now or in future. Only the `api` edge function (connected as the owner) reads or writes data.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
