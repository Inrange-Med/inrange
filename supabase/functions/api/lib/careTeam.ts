// The patient's doctors (23 Nov 2026): care_team_doctors holds everyone on the team; patient_profiles.care_team_doctor_id
// is the main doctor, the one who joined first and is still on it. The doctor of the first consultation joins by
// default; admin adds and removes the rest (routes/ops.ts).
import type { TransactionSql } from "postgres";
import type { sql } from "./db.ts";

type Sql = TransactionSql | typeof sql;

/** The main doctor follows the team: whoever joined first and is still on it (none when the team is empty). */
const setMain = (tx: Sql, patientId: number) => tx`
  insert into patient_profiles (user_id, care_team_doctor_id)
  values (${patientId}, (select doctor_id from care_team_doctors where patient_id = ${patientId} order by added_at, doctor_id limit 1))
  on conflict (user_id) do update set care_team_doctor_id = excluded.care_team_doctor_id`;

/** After a consultation: its doctor joins the team only while the patient has no doctor yet. */
export async function joinIfFirst(tx: Sql, patientId: number, doctorId: number) {
  await tx`insert into care_team_doctors (patient_id, doctor_id)
           select ${patientId}, ${doctorId} where not exists (select 1 from care_team_doctors where patient_id = ${patientId})
           on conflict do nothing`;
  await setMain(tx, patientId);
}

/** Admin adds a doctor to the team. */
export async function addDoctor(tx: Sql, patientId: number, doctorId: number, by: number) {
  await tx`insert into care_team_doctors (patient_id, doctor_id, added_by) values (${patientId}, ${doctorId}, ${by}) on conflict do nothing`;
  await setMain(tx, patientId);
}

/** Admin takes a doctor off the team. Their past consultations and prescriptions stay theirs to open. */
export async function removeDoctor(tx: Sql, patientId: number, doctorId: number) {
  await tx`delete from care_team_doctors where patient_id = ${patientId} and doctor_id = ${doctorId}`;
  await setMain(tx, patientId);
}
