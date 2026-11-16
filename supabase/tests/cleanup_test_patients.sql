-- Deletes every test patient, coach and admin (mobile starting 98000) and everything attached to them, and frees their slots.
-- Run: supabase db query --remote -f supabase/tests/cleanup_test_patients.sql
begin;
create temp table t on commit drop as
  select id from users where role in ('PATIENT', 'COACH', 'ADMIN') and (mobile like '98000%');
update doctor_slots set status = 'Available', held_by = null, held_until = null
  where held_by in (select id from t) or id in (select slot_id from appointments where patient_id in (select id from t));
-- the medicine flow (20261117000100_medicine_flow.sql): rows that point at orders and carts go first
update patient_profiles set coach_id = null where coach_id in (select id from t);
update ops_tasks set assigned_to = null, done_by = null where assigned_to in (select id from t) or done_by in (select id from t);
delete from ops_tasks where patient_id in (select id from t);
delete from patient_message_replies where patient_id in (select id from t);
delete from patient_messages where patient_id in (select id from t);
delete from dose_schedules where patient_id in (select id from t);
delete from medicine_followups where patient_id in (select id from t);
delete from medicine_orders where patient_id in (select id from t);
delete from medicine_carts where patient_id in (select id from t);
delete from clinical_notes where patient_id in (select id from t);
delete from prescriptions where patient_id in (select id from t);
delete from chat_sessions where patient_id in (select id from t);
delete from appointments where patient_id in (select id from t);
delete from payment_orders where user_id in (select id from t);
delete from support_requests where user_id in (select id from t);
delete from audit_log where patient_id in (select id from t) or actor_id in (select id from t);
delete from otp_codes where mobile like '98000%';
delete from users where id in (select id from t);
commit;
select (select count(*) from users where role = 'PATIENT') as patients_left,
       (select count(*) from users where role = 'DOCTOR') as doctors,
       (select count(*) from appointments) as appointments,
       (select count(*) from doctor_slots where status <> 'Available') as slots_taken;
