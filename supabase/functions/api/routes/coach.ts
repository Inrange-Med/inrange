// The coach's panel (23 Nov 2026 call): a health coach or a fitness coach works here, apart from admin's area.
// Mounted at /api. A coach reaches only the patients given to them (as health coach or fitness coach) and never
// writes a prescription or touches a sale; an admin may read and write the same for any patient.
// The medicine queue's tasks stay where they are (routes/ops.ts, scoped the same way).
//   GET  /coach/patients?q=                      my patients: plan, calls made against what it includes, last call
//   GET  /coach/patients/:patientId              one patient: basics, doctors, the plan and its calls, the current
//                                                prescription (read only), the diet chart, the exercise plan,
//                                                the calls made, the remarks for the doctor
//   PUT  /coach/patients/:patientId/plans/:kind  { text } kind diet | fitness: a new version; the patient and the
//                                                doctor see the newest
//   POST /coach/patients/:patientId/calls        { calledOn, note?, kind? } a call made, counted against the plan
// Remarks for the doctor: POST /admin/medicine/patients/:patientId/remarks (routes/ops.ts).
import { Hono } from "hono";
import { sql } from "../lib/db.ts";
import { body, fail, intParam, ok, todayIST } from "../lib/http.ts";
import { type AuthUser, requireUser } from "../lib/auth.ts";
import { lineView } from "../lib/prescriptions.ts";

export const coachRoutes = new Hono();

const name = sql`coalesce(nullif(trim(concat_ws(' ', pp.first_name, pp.last_name)), ''), pu.full_name, 'Patient ' || pu.id)`;
const iso = (col: string) => sql`to_char(${sql(col)} at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"')`;
const scope = (me: AuthUser) => (me.role === "COACH" ? sql`and (pp.coach_id = ${me.id} or pp.fitness_coach_id = ${me.id})` : sql``);

/** The plan a patient is on, with what it includes; calls are counted from the day it started. */
const planOf = sql`
  left join lateral (select p.name, sb.starts_at, sb.ends_at, p.doctor_consults, p.coach_calls, p.fitness_calls
    from subscriptions sb join plans p on p.id = sb.plan_id
    where sb.user_id = pu.id and sb.status = 'Active' and sb.ends_at > now() order by sb.ends_at desc limit 1) pl on true`;

async function patientFor(me: AuthUser, patientId: number) {
  const [p] = await sql`
    select pu.id, pu.mobile, ${name} as name, pp.age_years, pp.gender, pp.height_cm, pp.weight_kg, pp.coach_id, pp.fitness_coach_id,
      to_char(pp.fitness_starts_on, 'YYYY-MM-DD') as fitness_starts_on,
      pl.name as plan, ${iso("pl.starts_at")} as plan_starts, ${iso("pl.ends_at")} as plan_ends, pl.starts_at as plan_from,
      pl.doctor_consults, pl.coach_calls, pl.fitness_calls
    from users pu join patient_profiles pp on pp.user_id = pu.id ${planOf}
    where pu.id = ${patientId} and pu.role = 'PATIENT' ${scope(me)}`;
  return p ?? fail(404, "That patient was not found.");
}

/** Which kinds this person may write for the patient: their own side; an admin, both. */
const sides = (me: AuthUser, p: { coach_id: number | null; fitness_coach_id: number | null }) => ({
  health: me.role === "ADMIN" || p.coach_id === me.id,
  fitness: me.role === "ADMIN" || p.fitness_coach_id === me.id,
});

coachRoutes.get("/coach/patients", async (c) => {
  const me = await requireUser(c, "COACH");
  const q = (c.req.query("q") ?? "").trim().toLowerCase().slice(0, 40);
  const rows = await sql`
    select pu.id::text as id, ${name} as name, pu.mobile, pp.coach_id = ${me.id} as "asHealth", pp.fitness_coach_id = ${me.id} as "asFitness",
      pl.name as "planName", ${iso("pl.ends_at")} as "planEndsAt", pl.coach_calls as "coachCalls", pl.fitness_calls as "fitnessCalls",
      (select count(*) from coach_calls k where k.patient_id = pu.id and k.kind = 'HEALTH' and k.called_on >= coalesce(pl.starts_at, '-infinity')::date)::int as "healthCallsMade",
      (select count(*) from coach_calls k where k.patient_id = pu.id and k.kind = 'FITNESS' and k.called_on >= coalesce(pl.starts_at, '-infinity')::date)::int as "fitnessCallsMade",
      (select to_char(max(k.called_on), 'YYYY-MM-DD') from coach_calls k where k.patient_id = pu.id) as "lastCallOn",
      exists (select 1 from coach_plans d where d.patient_id = pu.id and d.kind = 'DIET') as "hasDiet",
      to_char(pp.fitness_starts_on, 'YYYY-MM-DD') as "fitnessStartsOn",
      (select count(*) from ops_tasks t where t.patient_id = pu.id and t.status = 'OPEN')::int as "openTasks"
    from users pu join patient_profiles pp on pp.user_id = pu.id ${planOf}
    where pu.role = 'PATIENT' ${scope(me)}
      ${me.role === "ADMIN" ? sql`and (pp.coach_id is not null or pp.fitness_coach_id is not null)` : sql``}
      ${q ? sql`and (lower(${name}) like ${`%${q}%`} or pu.mobile like ${`%${q}%`})` : sql``}
    -- who has waited longest for a call comes first
    order by (select max(k.called_on) from coach_calls k where k.patient_id = pu.id) nulls first, pu.id desc limit 300`;
  return ok(c, rows);
});

/** What the coach side holds for a patient; the doctor's page and admin's sheet read it too. */
export async function coaching(patientId: number, planFrom: Date | null) {
  const [plans, calls, remarks] = await Promise.all([
    sql`select distinct on (kind) kind, text, author_name, ${iso("created_at")} as at,
          (select count(*) from coach_plans o where o.patient_id = ${patientId} and o.kind = c.kind)::int as versions
        from coach_plans c where patient_id = ${patientId} order by kind, created_at desc`,
    sql`select id, kind, to_char(called_on, 'YYYY-MM-DD') as "calledOn", note, author_name,
          (${planFrom}::timestamptz is null or called_on >= (${planFrom}::timestamptz at time zone 'Asia/Kolkata')::date) as counted
        from coach_calls where patient_id = ${patientId} order by called_on desc, id desc limit 60`,
    sql`select id, text, author_name, ${iso("created_at")} as at from coach_remarks where patient_id = ${patientId} order by created_at desc limit 50`,
  ]);
  const plan = (kind: string) => {
    const p = plans.find((x) => x.kind === kind);
    return p ? { text: p.text, by: p.author_name, at: p.at, versions: p.versions } : null;
  };
  return {
    diet: plan("DIET"), fitness: plan("FITNESS"),
    calls: calls.map((k) => ({ id: String(k.id), kind: k.kind, calledOn: k.calledOn, note: k.note ?? "", by: k.author_name })),
    healthCallsMade: calls.filter((k) => k.kind === "HEALTH" && k.counted).length,
    fitnessCallsMade: calls.filter((k) => k.kind === "FITNESS" && k.counted).length,
    remarks: remarks.map((r) => ({ id: String(r.id), at: r.at, by: r.author_name, text: r.text })),
  };
}

coachRoutes.get("/coach/patients/:patientId", async (c) => {
  const me = await requireUser(c, "COACH");
  const p = await patientFor(me, intParam(c.req.param("patientId"), "patient"));
  await sql`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${me.id}, ${`Viewed the patient page (${me.role === "COACH" ? "coach" : "care team"})`})`;
  const [doctors, [coach], [fitness], [rx], [next], side] = await Promise.all([
    sql`select d.full_name from care_team_doctors t join doctors d on d.id = t.doctor_id where t.patient_id = ${p.id} order by t.added_at, t.doctor_id`,
    p.coach_id ? sql`select full_name from users where id = ${p.coach_id}` : Promise.resolve([]),
    p.fitness_coach_id ? sql`select full_name from users where id = ${p.fitness_coach_id}` : Promise.resolve([]),
    sql`select x.items, x.diagnosis, x.advice, d.full_name as doctor,
          to_char(coalesce(x.sent_at, x.signed_at) at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') as sent
        from prescriptions x left join doctors d on d.id = x.doctor_id
        where x.patient_id = ${p.id} and x.status = 'SIGNED' order by coalesce(x.sent_at, x.signed_at) desc limit 1`,
    sql`select to_char((s.slot_date + s.start_time), 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') as starts, d.full_name as doctor
        from appointments a join doctor_slots s on s.id = a.slot_id join doctors d on d.id = a.doctor_id
        where a.patient_id = ${p.id} and a.status in ('Booked', 'InProgress') and (s.slot_date + s.start_time) > (now() at time zone 'Asia/Kolkata')
        order by s.slot_date, s.start_time limit 1`,
    coaching(p.id, p.plan_from ?? null),
  ]);
  return ok(c, {
    patient: { id: String(p.id), name: p.name, mobile: p.mobile, age: p.age_years ?? null, gender: p.gender ?? null,
      heightCm: p.height_cm != null ? Number(p.height_cm) : null, weightKg: p.weight_kg != null ? Number(p.weight_kg) : null,
      doctors: doctors.map((d) => d.full_name), coachName: coach?.full_name ?? null, fitnessCoachName: fitness?.full_name ?? null,
      // the fitness coach starts three weeks into a plan (lib/coaches.ts); null: already started
      fitnessStartsOn: p.fitness_starts_on ?? null },
    plan: p.plan ? { name: p.plan, startedAt: p.plan_starts, endsAt: p.plan_ends, doctorConsults: p.doctor_consults ?? null,
      coachCalls: p.coach_calls ?? null, fitnessCalls: p.fitness_calls ?? null } : null,
    nextConsultation: next ? { startsAt: next.starts, doctorName: next.doctor } : null,
    // read only: the coach explains and follows the prescription, and never changes it
    prescription: rx ? { doctorName: rx.doctor ?? "", sentAt: rx.sent, diagnosis: rx.diagnosis ?? "", advice: rx.advice ?? "",
      // deno-lint-ignore no-explicit-any
      medicines: (rx.items as Record<string, any>[]).map(lineView).map((l) => ({
        name: l.name, words: [l.dose, l.frequencyWords, l.duration && `for ${l.duration}`, l.intakeWords].filter(Boolean).join(", ") })) } : null,
    can: sides(me, p as never),
    ...side,
  });
});

coachRoutes.put("/coach/patients/:patientId/plans/:kind", async (c) => {
  const me = await requireUser(c, "COACH");
  const p = await patientFor(me, intParam(c.req.param("patientId"), "patient"));
  const kind = c.req.param("kind") === "diet" ? "DIET" : c.req.param("kind") === "fitness" ? "FITNESS" : fail(404, "This feature is not available yet.");
  const can = sides(me, p as never);
  if (kind === "DIET" ? !can.health : !can.fitness)
    fail(403, kind === "DIET" ? "The diet chart is written by the patient's health coach." : "The exercise plan is written by the patient's fitness coach.");
  const text = String((await body<{ text?: unknown }>(c)).text ?? "").trim().slice(0, 8000);
  if (text.length < 10) fail(400, kind === "DIET" ? "Write the diet chart first." : "Write the exercise plan first.");
  const by = me.fullName?.trim() || (me.role === "COACH" ? "Coach" : "Care team");
  await sql`insert into coach_plans (patient_id, kind, text, author_id, author_name) values (${p.id}, ${kind}, ${text}, ${me.id}, ${by})`;
  await sql`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${me.id}, ${kind === "DIET" ? "Saved a diet chart" : "Saved an exercise plan"})`;
  return ok(c, null, kind === "DIET" ? "Diet chart saved. The patient and the doctor see it." : "Exercise plan saved. The patient and the doctor see it.");
});

coachRoutes.post("/coach/patients/:patientId/calls", async (c) => {
  const me = await requireUser(c, "COACH");
  const p = await patientFor(me, intParam(c.req.param("patientId"), "patient"));
  const b = await body<{ calledOn?: unknown; note?: unknown; kind?: unknown }>(c);
  const can = sides(me, p as never);
  // a coach who is both for this patient (or an admin) says which call it was; otherwise it is their own side
  const kind = can.health && can.fitness ? (b.kind === "FITNESS" ? "FITNESS" : "HEALTH") : can.fitness ? "FITNESS" : "HEALTH";
  const today = todayIST();
  const calledOn = typeof b.calledOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.calledOn) ? b.calledOn : today;
  if (calledOn > today) fail(400, "A call is logged once it has happened.");
  const note = String(b.note ?? "").trim().slice(0, 2000) || null;
  const by = me.fullName?.trim() || (me.role === "COACH" ? "Coach" : "Care team");
  await sql`insert into coach_calls (patient_id, kind, called_on, note, author_id, author_name) values (${p.id}, ${kind}, ${calledOn}, ${note}, ${me.id}, ${by})`;
  await sql`insert into audit_log (patient_id, actor_id, action) values (${p.id}, ${me.id}, ${kind === "HEALTH" ? "Logged a coach call" : "Logged a fitness call"})`;
  return ok(c, null, "Call logged");
});
