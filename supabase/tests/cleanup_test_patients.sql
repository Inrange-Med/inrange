-- Deletes every test patient (mobile starting 98000) and everything attached to them, and frees their slots.
-- Run: supabase db query --remote -f supabase/tests/cleanup_test_patients.sql
begin;
create temp table t on commit drop as
  select id from users where role = 'PATIENT' and (mobile like '98000%');
update doctor_slots set status = 'Available', held_by = null, held_until = null
  where held_by in (select id from t) or id in (select slot_id from appointments where patient_id in (select id from t));
delete from medicine_orders where patient_id in (select id from t);
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
