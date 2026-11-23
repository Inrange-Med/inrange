// Doctor portal v2 (17 Nov 2026 call; docs/backend/doctor-portal-v2.md): the doctor's three places run on
// these. Every consultation carries one state, so Today, History and the consultation page always agree:
//   UPCOMING   starts later                                 -> Open (read the reports early)
//   CALL_OPEN  from 10 minutes before until the call ends    -> Join video call (a new tab)
//   TO_WRITE   the call happened, no current PDF             -> Write prescription
//   TO_SEND    the PDF is made and current, not sent         -> Send to patient
//   SENT       sent (sentAt)                                 -> View PDF
//   NO_CALL    its time passed and nobody joined             -> Write prescription (a phone call still counts)
//   CANCELLED
// "Done" is the prescription sent (to confirm with Sachchidanand). Mounted at /api. Role DOCTOR; a
// consultation is only ever the signed-in doctor's own, and every read of a patient writes an audit row.
//   GET  /doctor/consultations?date=YYYY-MM-DD        { day: Row[], waiting: Row[] } (waiting: "Do this now", any date)
//   GET  /doctor/consultations/history?from=&to=&q=   past consultations, newest first, no phone numbers
//   GET  /doctor/consultations/:id                    the patient's page, opened from a consultation
//   GET  /doctor/patients/:patientId/page             the same page, opened from the doctor's patient list
//   PUT  /doctor/consultations/:id/prescription       { diagnosis, patientHistory, remarks, advice, medicines } autosave
//                                                     (no plan: a salesperson sells it, never the doctor; 19 Nov 2026 call)
//   POST /doctor/consultations/:id/prescription/pdf   "Create PDF": the patient's copy, shown on the page
//   POST /doctor/consultations/:id/prescription/send  "Send to patient": that PDF, on WhatsApp and in the app
//   POST /doctor/consultations/:id/prescription/resend  "Send again" (the WhatsApp message again)
//   POST /doctor/consultations/:id/prescription/revise  "Edit and send new version": a new draft from the sent one
//   POST /doctor/consultations/:id/prescription/discard "Keep the version already sent": drops that draft
//   PUT, POST /doctor/patients/:patientId/prescription[/pdf|send|resend|revise|discard]
//                                                     the same six steps for a prescription written without a
//                                                     consultation (19 Nov 2026 call: a prescription can be made at
//                                                     any time, "prescription and call should have no relation")
// The page says where a new prescription is written (`write`): a consultation of the doctor's that still waits for
// one, else the patient alone. The doctor never chooses.
//   GET  /medicines/search?q=                         the master list, forgiving: { matches, didYouMean }
import { coaching } from "./coach.ts";
import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "../lib/db.ts";
import { body, fail, intParam, ok } from "../lib/http.ts";
import { requireDoctor } from "../lib/auth.ts";
import { deliver, queueMessage } from "../lib/notify.ts";
import { firstName } from "../lib/notices.ts";
import { searchList, toListItem } from "../lib/medicineSearch.ts";
import { pendingPlan } from "../lib/pharmacy.ts";
import { joinIfFirst } from "../lib/careTeam.ts";
import { treatedIds } from "./doctor.ts";
import {
  type Doctor, issueMonths, issueRx, ist, lineOf, lineView, monthsOf, renderRx,
} from "../lib/prescriptions.ts";

export const consultationRoutes = new Hono();

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
export type ConsultationState = "UPCOMING" | "CALL_OPEN" | "TO_WRITE" | "TO_SEND" | "SENT" | "NO_CALL" | "CANCELLED";

const MIN = 60_000;
/** The call opens 10 minutes before the start (as the patient's Join), and stays open an hour past the end. */
const OPENS_BEFORE = 10 * MIN;
const OPEN_AFTER_END = 60 * MIN;
/** "Do this now" looks back this far for prescriptions not written or not sent. */
const WAITING_DAYS = 60;

async function doctorOf(c: Context): Promise<Doctor> {
  const me = await requireDoctor(c);
  const [d] = await sql`select full_name, qualification, specialization from doctors where id = ${me.id}`;
  return { id: me.id, name: d?.full_name ?? me.fullName ?? "Doctor", qualification: d?.qualification ?? d?.specialization ?? "" };
}

const CONDITIONS: Record<string, string> = {
  T2D: "Type 2 diabetes", PREDIABETES: "Prediabetes", BP: "High blood pressure", PCOS: "PCOS", THYROID: "Thyroid",
  FATTY_LIVER: "Fatty liver", LIPIDS: "High cholesterol", SLEEP_APNOEA: "Sleep apnoea", HEART: "Heart disease",
  KIDNEY: "Kidney disease",
};

const patientName = (r: Row) => r.full_name || `Patient ${r.patient_id}`;

/** The consultations, with the latest issued and the open draft prescription of each. */
const rowsSelect = (doctorId: number) => sql`
  select a.id, a.patient_id, a.status, a.visit_type, a.reason, a.started_at, a.ended_at,
    (s.slot_date + s.start_time) at time zone 'Asia/Kolkata' as starts_at,
    (s.slot_date + s.end_time) at time zone 'Asia/Kolkata' as ends_at,
    coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), u.full_name) as full_name, p.age_years, p.gender,
    sent.id as sent_id, sent.status as sent_status, coalesce(sent.sent_at, sent.signed_at) as sent_at, sent.resent_at,
    dr.id as draft_id, dr.pdf_made_at, dr.saved_at,
    -- the patient's current prescription came later: from a later consultation, or written without one since
    exists (select 1 from prescriptions z left join appointments az on az.id = z.appointment_id
      left join doctor_slots sz on sz.id = az.slot_id
      where z.patient_id = a.patient_id and z.status = 'SIGNED' and z.appointment_id is distinct from a.id
        and case when z.appointment_id is null
              then coalesce(z.sent_at, z.signed_at) > (s.slot_date + s.start_time) at time zone 'Asia/Kolkata'
              else (sz.slot_date + sz.start_time) > (s.slot_date + s.start_time) end) as replaced
  from appointments a join doctor_slots s on s.id = a.slot_id join users u on u.id = a.patient_id
  left join patient_profiles p on p.user_id = a.patient_id
  left join lateral (select x.id, x.status, x.sent_at, x.signed_at, x.resent_at from prescriptions x
    where x.appointment_id = a.id and x.status in ('SIGNED', 'SUPERSEDED') order by x.version desc limit 1) sent on true
  left join lateral (select x.id, x.pdf_made_at, x.saved_at from prescriptions x
    where x.appointment_id = a.id and x.status = 'DRAFT' order by x.version desc limit 1) dr on true
  where a.doctor_id = ${doctorId}`;

const pdfCurrent = (r: Row) => Boolean(r.pdf_made_at && (!r.saved_at || new Date(r.saved_at) <= new Date(r.pdf_made_at)));

/** The call can be joined: from 10 minutes before the start until it ends (at most an hour past the end). */
export function callOpenOf(r: Row, now = Date.now()) {
  if (r.status === "Cancelled" || r.status === "Completed" || r.ended_at) return false;
  const start = new Date(r.starts_at).getTime();
  const end = new Date(r.ends_at ?? r.starts_at).getTime();
  return now >= start - OPENS_BEFORE && now <= end + OPEN_AFTER_END;
}

export function stateOf(r: Row, now = Date.now()): ConsultationState {
  if (r.status === "Cancelled") return "CANCELLED";
  const start = new Date(r.starts_at).getTime();
  const ended = r.status === "Completed" || Boolean(r.ended_at);
  const callOpen = callOpenOf(r, now);
  if (callOpen && !r.sent_id) return "CALL_OPEN";
  // written ahead of the call: still upcoming (nothing is sent before the patient is seen)
  if (now < start - OPENS_BEFORE && !r.sent_id) return "UPCOMING";
  if (r.draft_id && pdfCurrent(r)) return "TO_SEND";
  if (r.draft_id && r.sent_id) return "TO_WRITE"; // a new version being written
  if (r.sent_id) return "SENT";
  if (now < start - OPENS_BEFORE) return "UPCOMING";
  if (callOpen) return "CALL_OPEN";
  if (ended || r.started_at || r.draft_id) return "TO_WRITE";
  return "NO_CALL";
}

const rowOf = (r: Row, now = Date.now()) => ({
  id: String(r.id), patientId: String(r.patient_id), patientName: patientName(r),
  age: r.age_years ?? null, sex: r.gender ?? "", visitType: r.visit_type === "FOLLOW_UP" ? "FOLLOW_UP" : "FIRST",
  startsAt: ist(r.starts_at), state: stateOf(r, now),
  revising: Boolean(r.draft_id && r.sent_id), sentAt: ist(r.sent_at), resentAt: ist(r.resent_at),
  // only the current prescription has a PDF to hand out (19 Nov 2026 call); a replaced one is read on the page
  pdf: r.sent_id && r.sent_status === "SIGNED" ? `/api/files/prescriptions/${r.sent_id}` : null,
});

consultationRoutes.get("/doctor/consultations", async (c) => {
  const doctor = await doctorOf(c);
  const date = c.req.query("date") ?? new Date(Date.now() + 19_800_000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(400, "Choose a valid date.");
  const now = Date.now();
  const [day, recent] = await Promise.all([
    sql`${rowsSelect(doctor.id)} and s.slot_date = ${date}::date order by s.start_time`,
    sql`${rowsSelect(doctor.id)} and a.status <> 'Cancelled'
        and s.slot_date between (now() at time zone 'Asia/Kolkata')::date - ${WAITING_DAYS}::int
                            and (now() at time zone 'Asia/Kolkata')::date + 1
        order by s.slot_date, s.start_time`,
  ]);
  // "Do this now": an open call first, then anything to send, then to write, oldest first
  const rank: Partial<Record<ConsultationState, number>> = { CALL_OPEN: 0, TO_SEND: 1, TO_WRITE: 2 };
  // an older consultation whose prescription a later one already replaced is not waiting on the doctor
  const waiting = recent.filter((r) => !r.replaced || stateOf(r, now) === "CALL_OPEN")
    .map((r) => rowOf(r, now)).filter((r) => r.state in rank)
    .sort((a, b) => rank[a.state]! - rank[b.state]! || String(a.startsAt).localeCompare(String(b.startsAt)));
  return ok(c, { date, day: day.map((r) => rowOf(r, now)), waiting });
});

consultationRoutes.get("/doctor/consultations/history", async (c) => {
  const doctor = await doctorOf(c);
  const today = new Date(Date.now() + 19_800_000).toISOString().slice(0, 10);
  const valid = (d: string | undefined) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const to = valid(c.req.query("to")) ?? today;
  const from = valid(c.req.query("from")) ?? new Date(Date.parse(to) - 29 * 86_400_000).toISOString().slice(0, 10);
  if (from > to) fail(400, "The start date is after the end date.");
  const q = String(c.req.query("q") ?? "").trim().slice(0, 60);
  const rows = await sql`
    ${rowsSelect(doctor.id)} and s.slot_date between ${from}::date and ${to}::date
      and (s.slot_date + s.start_time) at time zone 'Asia/Kolkata' <= now() + interval '10 minutes'
      ${q ? sql`and coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), u.full_name, '') ilike ${`%${q}%`}` : sql``}
    order by s.slot_date desc, s.start_time desc limit 300`;
  return ok(c, { from, to, consultations: rows.map((r) => rowOf(r)) });
});

// ---------- the patient's page ----------

async function consultationOf(doctorId: number, id: number) {
  const [r] = await sql`${rowsSelect(doctorId)} and a.id = ${id}`;
  if (!r) fail(404, "That consultation was not found.");
  return r;
}

/** The prescription a consultation's page edits or shows: the open draft, else the latest issued one. */
async function prescriptionOf(appointmentId: number) {
  const [rx] = await sql`
    select * from prescriptions where appointment_id = ${appointmentId} and status in ('DRAFT', 'SIGNED', 'SUPERSEDED')
    order by (status = 'DRAFT') desc, version desc limit 1`;
  return rx ?? null;
}

// only the current prescription has a PDF to hand out; a replaced one is read on the page (19 Nov 2026 call)
const pdfLink = (rx: Row) =>
  rx.pdf_path && (rx.status === "SIGNED" || (rx.status === "DRAFT" && pdfCurrent(rx))) ? `/api/files/prescriptions/${rx.id}` : null;

function prescriptionView(rx: Row | null) {
  if (!rx) return null;
  return {
    id: String(rx.id), version: rx.version, status: rx.status === "DRAFT" ? "DRAFT" : "SENT",
    diagnosis: rx.diagnosis ?? "", patientHistory: rx.patient_history ?? "", remarks: rx.remarks ?? "", advice: rx.advice ?? "",
    medicines: (rx.items as Row[]).map(lineView),
    savedAt: ist(rx.saved_at), pdfMadeAt: rx.status === "DRAFT" && !pdfCurrent(rx) ? null : ist(rx.pdf_made_at ?? rx.signed_at),
    pdf: pdfLink(rx), sentAt: ist(rx.sent_at ?? (rx.status !== "DRAFT" ? rx.signed_at : null)), resentAt: ist(rx.resent_at),
    // an edit of one already sent ("Edit and send new version"), not a prescription of its own
    revising: Boolean(rx.revises_id),
  };
}

const WAITING: ConsultationState[] = ["CALL_OPEN", "TO_SEND", "TO_WRITE"];

/**
 * Everything the doctor's page for one patient shows, whichever way it was opened: from a consultation (`r`) or
 * from the patient list (no `r`). Who they are and their readings, the plan and who looks after them, the
 * reports, every prescription with who sent it and when, the coach's remarks, and the prescription being
 * written, if any.
 *
 * `write` is where a new prescription goes, decided here so the doctor never has to: the consultation on the
 * page while it still has none; else the doctor's latest consultation with this patient that waits for one
 * (so "Do this now" clears); else the patient alone, with no consultation.
 */
async function pageFor(doctor: Doctor, patientId: number, r: Row | null) {
  const now = Date.now();
  const [[p], [clinical], weights, reports, issued, [plan], assigned, [team], doctors, remarks, mine] = await Promise.all([
    sql`select pp.*, coalesce(nullif(trim(concat_ws(' ', pp.first_name, pp.last_name)), ''), u.full_name) as full_name
        from users u left join patient_profiles pp on pp.user_id = u.id where u.id = ${patientId}`,
    sql`select allergies, outside_medicines from patient_clinical where patient_id = ${patientId}`,
    sql`select weight_kg, logged_at from weight_logs where user_id = ${patientId} order by logged_at desc limit 40`,
    sql`select id, source, title, file_name, file_path, uploaded_at, lab_booking_id from reports
        where user_id = ${patientId} and file_path is not null order by uploaded_at desc`,
    // every prescription ever issued, any doctor, newest first (19 Nov 2026 call: the whole journey, with who and when)
    sql`select x.*, d.full_name as doctor from prescriptions x left join doctors d on d.id = x.doctor_id
        where x.patient_id = ${patientId} and x.status in ('SIGNED', 'SUPERSEDED')
        order by (x.status = 'SIGNED') desc, coalesce(x.sent_at, x.signed_at) desc, x.version desc`,
    sql`select pl.name, s.ends_at, s.starts_at from subscriptions s join plans pl on pl.id = s.plan_id
        where s.user_id = ${patientId} and s.status = 'Active' and s.ends_at > now() order by s.ends_at desc limit 1`,
    pendingPlan(sql, patientId),
    sql`select c.full_name as coach, f.full_name as fitness_coach from patient_profiles pp
        left join users c on c.id = pp.coach_id left join users f on f.id = pp.fitness_coach_id where pp.user_id = ${patientId}`,
    sql`select d.full_name from care_team_doctors t join doctors d on d.id = t.doctor_id where t.patient_id = ${patientId} order by t.added_at, t.doctor_id`,
    sql`select id, text, author_name, created_at from coach_remarks where patient_id = ${patientId} order by created_at desc limit 50`,
    // the doctor's own consultations with this patient, newest first
    sql`${rowsSelect(doctor.id)} and a.patient_id = ${patientId} and a.status <> 'Cancelled'
        order by s.slot_date desc, s.start_time desc limit 40`,
  ]);
  await sql`insert into audit_log (patient_id, actor_id, action) values (${patientId}, ${doctor.id},
    ${`Opened the ${r ? "consultation" : "record"}, ${doctor.name}`})`;

  // where a new prescription is written
  const open = (x: Row) => x.status !== "Cancelled" && !x.replaced && (!x.sent_id || x.draft_id);
  const waiting = r && open(r) ? r
    : mine.find((x) => WAITING.includes(stateOf(x, now)) && (!x.replaced || stateOf(x, now) === "CALL_OPEN")) ?? null;
  const [draft] = waiting
    ? await sql`select * from prescriptions where appointment_id = ${waiting.id} and status = 'DRAFT'`
    : await sql`select * from prescriptions where patient_id = ${patientId} and doctor_id = ${doctor.id}
                and appointment_id is null and status = 'DRAFT'`;
  // the consultation the page speaks of (its time, the Join button): the one opened, else the one waiting,
  // else the call that is open or comes next
  const upcoming = [...mine].reverse().find((x) => ["UPCOMING", "CALL_OPEN"].includes(stateOf(x, now)));
  const shown = r ?? waiting ?? upcoming ?? null;

  const kg = weights[0]?.weight_kg ?? p?.weight_kg ?? null;
  const monthAgo = weights.find((w) => Date.now() - new Date(w.logged_at).getTime() >= 28 * 86_400_000);
  const conditions = Array.isArray(p?.conditions)
    ? p.conditions.map((x: Row) => (x.code === "OTHER" ? x.otherText || "Other" : CONDITIONS[x.code] ?? x.code)) : [];
  const last = r ? issued.find((x) => x.appointment_id !== r.id) : issued[0];
  return {
    consultation: shown
      ? { ...rowOf(shown, now), endsAt: ist(shown.ends_at), reason: String(shown.reason ?? "").split(" | Note:")[0], callOpen: callOpenOf(shown, now) }
      : null,
    patient: {
      id: String(patientId), name: p?.full_name || `Patient ${patientId}`, age: p?.age_years ?? null, sex: p?.gender ?? "",
      heightCm: p?.height_cm ?? null, weightKg: kg, weighedAt: ist(weights[0]?.logged_at ?? p?.updated_at),
      bmi: kg && p?.height_cm ? Math.round((kg / (p.height_cm / 100) ** 2) * 10) / 10 : null,
      // weight change over the last month (the call: "how much weight went up in the last month")
      monthChangeKg: kg && monthAgo ? Math.round((kg - monthAgo.weight_kg) * 10) / 10 : null,
      allergies: clinical?.allergies ?? null, conditions, onPlan: Boolean(plan),
      // the diagnosis on their current prescription, for the top of the page
      diagnosis: String(issued[0]?.diagnosis ?? "").trim() || null,
      // who looks after them besides the doctor (19 Nov 2026 call): the salesperson for a first-time patient; the
      // health coach, the salesperson and the fitness coach once enrolled
      salesperson: p?.salesperson ?? null, coachName: team?.coach ?? null, fitnessCoachName: team?.fitness_coach ?? null,
      doctors: doctors.map((d) => String(d.full_name)),
    },
    reports: reports.map((x) => ({
      id: String(x.id), title: x.title || (x.source === "LAB" ? "Blood test" : x.file_name || "Report"),
      source: x.source, at: ist(x.uploaded_at), file: `/api/files/reports/${x.id}`,
    })),
    // beside each one: who sent it and when; "edited" when it corrects an earlier version. Only the current
    // one has a PDF: a replaced prescription is read here and never handed out.
    prescriptions: issued.map((x, i) => ({
      id: String(x.id), version: x.version, current: x.status === "SIGNED", doctorName: x.doctor ?? "",
      sentAt: ist(x.sent_at ?? x.signed_at), resentAt: ist(x.resent_at),
      edited: Boolean(x.revises_id) || Boolean(x.appointment_id && issued.slice(i + 1).some((y) => y.appointment_id === x.appointment_id)),
      diagnosis: x.diagnosis ?? "", patientHistory: x.patient_history ?? "", remarks: x.remarks ?? "", advice: x.advice ?? "",
      medicines: (x.items as Row[]).map(lineView), pdf: pdfLink(x),
      // the doctor who sent the current one may correct it; the consultation it belongs to, if any
      mine: x.doctor_id === doctor.id, appointmentId: x.appointment_id != null ? String(x.appointment_id) : null,
    })),
    lastPrescription: last ? {
      id: String(last.id), at: ist(last.sent_at ?? last.signed_at), doctorName: last.doctor, diagnosis: last.diagnosis ?? "",
      patientHistory: last.patient_history ?? "", advice: last.advice ?? "",
      medicines: (last.items as Row[]).map(lineView), pdf: pdfLink(last),
    } : null,
    write: waiting ? { kind: "consultation", id: String(waiting.id) } : { kind: "patient", id: String(patientId) },
    draft: prescriptionView(draft ?? null),
    coachRemarks: remarks.map((x) => ({ id: String(x.id), at: ist(x.created_at), by: x.author_name, text: x.text })),
    // the coach's side (23 Nov 2026 call): the diet chart, the exercise plan and the calls made, read only
    coach: await coaching(patientId, plan?.starts_at ?? null).then((k) => ({ diet: k.diet, fitness: k.fitness,
      healthCallsMade: k.healthCallsMade, fitnessCallsMade: k.fitnessCallsMade, lastCallOn: k.calls[0]?.calledOn ?? null })),
    activePlan: plan ? { planName: plan.name, endsAt: ist(plan.ends_at) } : null,
    // sold and assigned, not paid yet: prescriptions stay one month until it is
    assignedPlan: !plan && assigned ? { planName: assigned.name } : null,
  };
}

consultationRoutes.get("/doctor/consultations/:id", async (c) => {
  const doctor = await doctorOf(c);
  const id = intParam(c.req.param("id"), "consultation");
  const r = await consultationOf(doctor.id, id);
  // `prescription` is this consultation's own (its draft, else the one it sent), as the page read it before 23 Nov 2026
  return ok(c, { ...(await pageFor(doctor, r.patient_id, r)), prescription: prescriptionView(await prescriptionOf(id)) });
});

consultationRoutes.get("/doctor/patients/:patientId/page", async (c) => {
  const doctor = await doctorOf(c);
  const patientId = await treated(doctor, intParam(c.req.param("patientId"), "patient"));
  return ok(c, { ...(await pageFor(doctor, patientId, null)), prescription: null });
});

// ---------- writing, the PDF and sending ----------

/**
 * Where a prescription is written: for one consultation, or for the patient with no consultation (a month's
 * refill when no call can happen). The six steps below are the same for both.
 */
type Target = { patientId: number; appointmentId: number | null; cancelled: boolean; sentId: number | null };

async function treated(doctor: Doctor, patientId: number) {
  const [row] = await sql`select 1 from (${treatedIds(doctor.id)}) t where t.patient_id = ${patientId}`;
  if (!row) fail(404, "That patient was not found.");
  return patientId;
}

async function consultationTarget(c: Context, doctor: Doctor): Promise<Target> {
  const r = await consultationOf(doctor.id, intParam(c.req.param("id"), "consultation"));
  return { patientId: r.patient_id, appointmentId: r.id, cancelled: r.status === "Cancelled", sentId: r.sent_id ?? null };
}

async function patientTarget(c: Context, doctor: Doctor): Promise<Target> {
  const patientId = await treated(doctor, intParam(c.req.param("patientId"), "patient"));
  return { patientId, appointmentId: null, cancelled: false, sentId: null };
}

/** The target's prescriptions: the consultation's, or the doctor's own for this patient that have no consultation. */
const within = (doctor: Doctor, t: Target) => t.appointmentId
  ? sql`appointment_id = ${t.appointmentId}`
  : sql`patient_id = ${t.patientId} and doctor_id = ${doctor.id} and appointment_id is null`;

const draftOf = async (doctor: Doctor, t: Target): Promise<Row | undefined> =>
  (await sql`select * from prescriptions where ${within(doctor, t)} and status = 'DRAFT'`)[0];

/** The draft the page writes to; created on the first save. A sent one is changed only by revise. */
async function draftFor(doctor: Doctor, t: Target): Promise<Row> {
  const d = await draftOf(doctor, t);
  if (d) return d;
  if (t.sentId) fail(409, "This prescription was sent. Choose Edit and send new version to change it.");
  const [created] = await sql`
    insert into prescriptions (patient_id, doctor_id, appointment_id, status, version, items, diagnosis)
    values (${t.patientId}, ${doctor.id}, ${t.appointmentId}, 'DRAFT',
      (select coalesce(max(version), 0) + 1 from prescriptions where patient_id = ${t.patientId}), '[]'::jsonb, '')
    on conflict do nothing
    returning *`;
  return created ?? (await draftOf(doctor, t))!;
}

const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+$/g, "").slice(0, max);

async function saveDraft(doctor: Doctor, t: Target, input: Row) {
  if (t.cancelled) fail(409, "This consultation was cancelled.");
  const lines = Array.isArray(input.medicines) ? input.medicines.slice(0, 20) : null;
  const ids = (lines ?? []).map((l: Row) => Number(l.medicineId)).filter((n: number) => Number.isInteger(n) && n > 0);
  const listed = new Map((ids.length
    ? await sql`select * from medicines where id in ${sql(ids)} and active` : []).map((m: Row) => [m.id, m]));
  const draft = await draftFor(doctor, t);
  const items = lines ? lines.map((l: Row, i: number) => lineOf(l, listed.get(Number(l.medicineId)), i)) : draft.items;
  const [saved] = await sql`
    update prescriptions set
      diagnosis = ${input.diagnosis !== undefined ? text(input.diagnosis, 2000) : draft.diagnosis ?? ""},
      patient_history = ${input.patientHistory !== undefined ? text(input.patientHistory, 4000) : draft.patient_history},
      remarks = ${input.remarks !== undefined ? text(input.remarks, 2000) : draft.remarks},
      advice = ${input.advice !== undefined ? text(input.advice, 4000) : draft.advice},
      items = ${sql.json(items)}, plan_id = null,
      saved_at = date_trunc('milliseconds', clock_timestamp())
    where id = ${draft.id} and status = 'DRAFT' returning *`;
  if (!saved) fail(409, "This prescription was sent a moment ago. Reload the page.");
  return saved;
}

/** The longest any line may run: one month. Every prescription is for one month, plan or not (23 Nov 2026 call). */
const NANO_DAYS = 31;

/** What the PDF needs before it can be made; the first gap, in the words the doctor sees. */
function missingFor(rx: Row, _onPlan: boolean): string | null {
  if (!String(rx.diagnosis ?? "").trim()) return "Write the diagnosis first.";
  for (const [i, l] of (rx.items as Row[]).entries()) {
    const which = (rx.items as Row[]).length > 1 ? `medicine ${i + 1}` : "the medicine";
    if (!String(l.medicineName ?? "").trim()) return `Choose ${which} from the list, or type its name.`;
    if (!String(l.frequency ?? "").trim()) return `Choose how often for ${which}.`;
    // a longer line would print one thing and order another
    if (Number(l.durationDays) > NANO_DAYS) return `Every prescription is for one month. Set ${which} to 1 month or less.`;
  }
  return null;
}

/**
 * A prescription is issued for any consultation that is not cancelled, before or after its call, or for no
 * consultation at all: it does not depend on the call (19 Nov 2026 call).
 */
async function makePdf(doctor: Doctor, t: Target) {
  if (t.cancelled) fail(409, "This consultation was cancelled.");
  const rx = await draftOf(doctor, t);
  if (!rx) fail(409, t.sentId ? "This prescription was sent already." : "Write the prescription first.");
  // the PDF carries the time it was made as its signature time; sending issues exactly this file
  // the database's clock, as autosave's: a save that lands while the PDF renders is later than `at`
  // milliseconds, as saved_at: a JS Date carries no finer, so the comparison is exact both ways
  const [{ at }] = await sql`select date_trunc('milliseconds', clock_timestamp()) as at`;
  const { months, onPlan } = await issueMonths(t.patientId, monthsOf(rx!.items));
  const missing = missingFor(rx!, onPlan);
  if (missing) fail(422, missing);
  const path = await renderRx(doctor, t.patientId, rx!, at, months);
  const [made] = await sql`
    update prescriptions set pdf_path = ${path}, pdf_made_at = ${at}, months = ${months}
    where id = ${rx!.id} and status = 'DRAFT' and (saved_at is null or saved_at <= ${at}) returning *`;
  if (!made) fail(409, "The prescription changed while the PDF was being made. Create it again.");
  await sql`insert into audit_log (patient_id, actor_id, action) values (${t.patientId}, ${doctor.id}, ${`Created the prescription PDF, version ${rx!.version}, ${doctor.name}`})`;
  return made;
}

async function sendDraft(doctor: Doctor, t: Target) {
  if (t.cancelled) fail(409, "This consultation was cancelled.");
  const rx = await draftOf(doctor, t);
  if (!rx) fail(409, t.sentId ? "This prescription was sent already." : "Write the prescription first.");
  if (!pdfCurrent(rx!)) fail(409, "The prescription changed after the PDF was made. Create the PDF again, then send it.");
  const sentAt = new Date();
  await issueRx(doctor, t.patientId, rx!.id, { signedAt: new Date(rx!.pdf_made_at), months: rx!.months, path: rx!.pdf_path, sentAt });
  // sent is done (the row reads SENT). The appointment itself is left alone: a doctor who sends during the
  // call must not lock the patient out of rejoining. A patient without a doctor yet gets this one, as at End.
  await joinIfFirst(sql, t.patientId, doctor.id);
  // a draft the doctor began for this patient without a consultation is now out of date: it goes
  await sql`update prescriptions set status = 'VOID' where patient_id = ${t.patientId} and doctor_id = ${doctor.id}
            and appointment_id is null and status = 'DRAFT' and id <> ${rx!.id}`;
  return (await sql`select * from prescriptions where id = ${rx!.id}`)[0];
}

/** "Send again": the WhatsApp message again. From the patient's page: their current prescription, whoever sent it. */
async function sendAgain(doctor: Doctor, t: Target) {
  const [rx] = t.appointmentId
    ? await sql`select * from prescriptions where appointment_id = ${t.appointmentId} and status = 'SIGNED'`
    : await sql`select * from prescriptions where patient_id = ${t.patientId} and status = 'SIGNED'`;
  if (!rx) fail(409, "There is no current prescription to send again.");
  const [{ n }] = await sql`select count(*)::int as n from patient_messages where prescription_id = ${rx.id} and kind = 'RX_READY'`;
  const messageId = await queueMessage(sql, {
    patientId: t.patientId, kind: "RX_READY", values: [await firstName(sql, t.patientId), doctor.name],
    links: [String(rx.id)], dedupeKey: `rx:${rx.id}:v${rx.version}:again:${n}`, prescriptionId: rx.id,
  });
  const [again] = await sql`update prescriptions set resent_at = now() where id = ${rx.id} returning *`;
  if (messageId) await deliver(messageId).catch((e) => console.error("prescription again", e.message));
  await sql`insert into audit_log (patient_id, actor_id, action) values (${t.patientId}, ${doctor.id}, ${`Sent the prescription again, ${doctor.name}`})`;
  return again;
}

/**
 * "Edit and send new version": a new draft copied from the one sent, which it replaces once sent. What the patient
 * already paid for on the sent one stays bought (lib/prescriptions.ts issueRx, through revises_id).
 */
async function reviseSent(doctor: Doctor, t: Target) {
  const open = await draftOf(doctor, t);
  if (open) return open;
  const [sent] = await sql`select * from prescriptions where ${within(doctor, t)} and status = 'SIGNED'`;
  if (!sent) fail(409, "Only the current prescription can be changed. A newer one replaced this one.");
  const [draft] = await sql`
    insert into prescriptions (patient_id, doctor_id, appointment_id, revises_id, status, version, items, diagnosis,
                               patient_history, remarks, advice, saved_at)
    values (${t.patientId}, ${doctor.id}, ${t.appointmentId}, ${sent.id}, 'DRAFT',
      (select coalesce(max(version), 0) + 1 from prescriptions where patient_id = ${t.patientId}),
      ${sql.json(sent.items)}, ${sent.diagnosis ?? ""}, ${sent.patient_history}, ${sent.remarks}, ${sent.advice},
      date_trunc('milliseconds', clock_timestamp()))
    on conflict do nothing returning *`;
  return draft ?? (await draftOf(doctor, t))!;
}

/**
 * Drops the draft. For a consultation: "Keep the version already sent" (the sent one stays current). Without a
 * consultation: the prescription being written is given up (nothing was sent).
 */
async function discardDraft(doctor: Doctor, t: Target) {
  const [sent] = t.appointmentId ? await sql`select * from prescriptions where appointment_id = ${t.appointmentId} and status = 'SIGNED'` : [];
  if (t.appointmentId && !sent) fail(409, "There is no sent prescription to keep.");
  await sql`update prescriptions set status = 'VOID' where ${within(doctor, t)} and status = 'DRAFT'`;
  return sent ?? null;
}

const STEP_WORDS = { pdf: "PDF created", send: "Sent to patient", resend: "Sent again", revise: "Editing the new version", discard: "Kept the version already sent" };
const STEPS: Record<keyof typeof STEP_WORDS, (doctor: Doctor, t: Target) => Promise<Row | null>> =
  { pdf: makePdf, send: sendDraft, resend: sendAgain, revise: reviseSent, discard: discardDraft };

async function step(c: Context, targetOf: typeof consultationTarget, name: keyof typeof STEPS) {
  const doctor = await doctorOf(c);
  return ok(c, prescriptionView(await STEPS[name](doctor, await targetOf(c, doctor))), STEP_WORDS[name]);
}
async function save(c: Context, targetOf: typeof consultationTarget) {
  const doctor = await doctorOf(c);
  const t = await targetOf(c, doctor);
  return ok(c, prescriptionView(await saveDraft(doctor, t, await body<Row>(c))), "Saved");
}

consultationRoutes.put("/doctor/consultations/:id/prescription", (c) => save(c, consultationTarget));
consultationRoutes.post("/doctor/consultations/:id/prescription/pdf", (c) => step(c, consultationTarget, "pdf"));
consultationRoutes.post("/doctor/consultations/:id/prescription/send", (c) => step(c, consultationTarget, "send"));
consultationRoutes.post("/doctor/consultations/:id/prescription/resend", (c) => step(c, consultationTarget, "resend"));
consultationRoutes.post("/doctor/consultations/:id/prescription/revise", (c) => step(c, consultationTarget, "revise"));
consultationRoutes.post("/doctor/consultations/:id/prescription/discard", (c) => step(c, consultationTarget, "discard"));

consultationRoutes.put("/doctor/patients/:patientId/prescription", (c) => save(c, patientTarget));
consultationRoutes.post("/doctor/patients/:patientId/prescription/pdf", (c) => step(c, patientTarget, "pdf"));
consultationRoutes.post("/doctor/patients/:patientId/prescription/send", (c) => step(c, patientTarget, "send"));
consultationRoutes.post("/doctor/patients/:patientId/prescription/resend", (c) => step(c, patientTarget, "resend"));
consultationRoutes.post("/doctor/patients/:patientId/prescription/revise", (c) => step(c, patientTarget, "revise"));
consultationRoutes.post("/doctor/patients/:patientId/prescription/discard", (c) => step(c, patientTarget, "discard"));

// ---------- the master list ----------

consultationRoutes.get("/medicines/search", async (c) => {
  await requireDoctor(c);
  const { matches, didYouMean } = await searchList(String(c.req.query("q") ?? ""));
  return ok(c, { matches: matches.map(toListItem), didYouMean: didYouMean.map(toListItem) });
});
