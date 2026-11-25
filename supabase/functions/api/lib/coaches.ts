// Coaches are assigned when a plan starts (23 Nov 2026 call): the health coach at once, who makes the first call,
// and the fitness coach too, who starts three weeks in ("the first month goes in building the habit"). Each goes to
// the coach of that kind with the fewest patients; admin can change either at any time. With no coach of a kind on
// the team the patient waits on admin's To call list ("On a plan, no coach").
// Each assignment opens a task in that coach's queue, due when the call is: nothing here needs the scheduler.
import type { TransactionSql } from "postgres";
import { nextWorkingMorning } from "./hours.ts";

export const FITNESS_STARTS_AFTER_DAYS = 21;

/** The coach of this kind with the fewest patients on an active plan. */
async function leastBusy(tx: TransactionSql, kind: "HEALTH" | "FITNESS") {
  const column = kind === "HEALTH" ? tx`p.coach_id` : tx`p.fitness_coach_id`;
  const [c] = await tx`
    select u.id, u.full_name from users u
    where u.role = 'COACH' and coalesce(u.coach_kind, 'HEALTH') in (${kind}, 'BOTH')
    order by (select count(*) from patient_profiles p where ${column} = u.id and exists (
      select 1 from subscriptions s where s.user_id = p.user_id and s.status = 'Active' and s.ends_at > now())), u.id
    limit 1`;
  return c ?? null;
}

async function task(tx: TransactionSql, kind: string, patientId: number, coachId: number, title: string, detail: string, dueAt: Date, key: string) {
  await tx`insert into ops_tasks (kind, priority, patient_id, title, detail, due_at, dedupe_key, assigned_to, history)
           values (${kind}, 'HIGH', ${patientId}, ${title}, ${detail}, ${dueAt}, ${key}, ${coachId},
             ${tx.json([{ at: new Date().toISOString(), by: null, what: "Opened" }])})
           on conflict (dedupe_key) do nothing`;
}

/** Called when a plan starts. Fills only what is empty: a coach admin already chose is kept. */
export async function assignCoaches(tx: TransactionSql, patientId: number, subscriptionId: number) {
  await tx`insert into patient_profiles (user_id) values (${patientId}) on conflict (user_id) do nothing`;
  const [p] = await tx`select coach_id, fitness_coach_id from patient_profiles where user_id = ${patientId} for update`;
  const health = p.coach_id ? { id: p.coach_id as number } : await leastBusy(tx, "HEALTH");
  // a task only for a coach assigned here: someone renewing keeps their coaches and nobody is told to "start"
  if (health && !p.coach_id) {
    await tx`update patient_profiles set coach_id = ${health.id} where user_id = ${patientId}`;
    await tx`insert into audit_log (patient_id, actor_id, action) values (${patientId}, null, 'Health coach assigned when the plan started')`;
    await task(tx, "COACH_FIRST_CALL", patientId, health.id, "First call: a new patient on a plan",
      "Welcome them, explain how the plan works and start their diet chart. Log the call on their page.",
      nextWorkingMorning(new Date()), `coach-first:${subscriptionId}`);
  }
  const starts = new Date(Date.now() + FITNESS_STARTS_AFTER_DAYS * 86_400_000);
  const fitness = p.fitness_coach_id ? { id: p.fitness_coach_id as number } : await leastBusy(tx, "FITNESS");
  if (fitness && !p.fitness_coach_id) {
    await tx`update patient_profiles set fitness_coach_id = ${fitness.id}, fitness_starts_on = ${starts} where user_id = ${patientId}`;
    await tx`insert into audit_log (patient_id, actor_id, action) values (${patientId}, null, 'Fitness coach assigned when the plan started')`;
    await task(tx, "FITNESS_START", patientId, fitness.id, "Start fitness coaching",
      "Three weeks into the plan: make the first fitness call and write their exercise plan.", starts, `fitness-start:${subscriptionId}`);
  }
}
