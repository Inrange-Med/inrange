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
//   GET  /doctor/consultations/:id                    the consultation page
//   PUT  /doctor/consultations/:id/prescription       { diagnosis, patientHistory, remarks, advice, medicines, planId } autosave
//   POST /doctor/consultations/:id/prescription/pdf   "Create PDF": the patient's copy, shown on the page
//   POST /doctor/consultations/:id/prescription/send  "Send to patient": that PDF, on WhatsApp and in the app
//   POST /doctor/consultations/:id/prescription/resend  "Send again" (the WhatsApp message again)
//   POST /doctor/consultations/:id/prescription/revise  "Edit and send new version": a new draft from the sent one
//   POST /doctor/consultations/:id/prescription/discard "Keep the version already sent": drops that draft
//   GET  /medicines/search?q=                         the master list, forgiving: { matches, didYouMean }
import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "../lib/db.ts";
import { body, fail, intParam, ok } from "../lib/http.ts";
import { requireDoctor } from "../lib/auth.ts";
import { deliver, queueMessage } from "../lib/notify.ts";
import { firstName } from "../lib/notices.ts";
import { searchList, toListItem } from "../lib/medicineSearch.ts";
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
    sent.id as sent_id, coalesce(sent.sent_at, sent.signed_at) as sent_at, sent.resent_at,
    dr.id as draft_id, dr.pdf_made_at, dr.saved_at,
    exists (select 1 from prescriptions z join appointments az on az.id = z.appointment_id
      join doctor_slots sz on sz.id = az.slot_id
      where z.patient_id = a.patient_id and z.status = 'SIGNED' and z.appointment_id <> a.id
        and (sz.slot_date + sz.start_time) > (s.slot_date + s.start_time)) as replaced
  from appointments a join doctor_slots s on s.id = a.slot_id join users u on u.id = a.patient_id
  left join patient_profiles p on p.user_id = a.patient_id
  left join lateral (select x.id, x.sent_at, x.signed_at, x.resent_at from prescriptions x
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
  pdf: r.sent_id ? `/api/files/prescriptions/${r.sent_id}` : null,
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

// ---------- one consultation ----------

async function consultationOf(doctorId: number, id: number) {
  const [r] = await sql`${rowsSelect(doctorId)} and a.id = ${id}`;
  if (!r) fail(404, "That consultation was not found.");
  return r;
}

/** The prescription the page edits or shows: the open draft, else the latest issued one. */
async function prescriptionOf(appointmentId: number) {
  const [rx] = await sql`
    select * from prescriptions where appointment_id = ${appointmentId} and status in ('DRAFT', 'SIGNED', 'SUPERSEDED')
    order by (status = 'DRAFT') desc, version desc limit 1`;
  return rx ?? null;
}

const pdfLink = (rx: Row) => (rx.pdf_path && (rx.status !== "DRAFT" || pdfCurrent(rx)) ? `/api/files/prescriptions/${rx.id}` : null);

function prescriptionView(rx: Row | null) {
  if (!rx) return null;
  return {
    id: String(rx.id), version: rx.version, status: rx.status === "DRAFT" ? "DRAFT" : "SENT",
    diagnosis: rx.diagnosis ?? "", patientHistory: rx.patient_history ?? "", remarks: rx.remarks ?? "", advice: rx.advice ?? "",
    planId: rx.plan_id ? String(rx.plan_id) : null,
    medicines: (rx.items as Row[]).map(lineView),
    savedAt: ist(rx.saved_at), pdfMadeAt: rx.status === "DRAFT" && !pdfCurrent(rx) ? null : ist(rx.pdf_made_at ?? rx.signed_at),
    pdf: pdfLink(rx), sentAt: ist(rx.sent_at ?? (rx.status !== "DRAFT" ? rx.signed_at : null)), resentAt: ist(rx.resent_at),
  };
}

consultationRoutes.get("/doctor/consultations/:id", async (c) => {
  const doctor = await doctorOf(c);
  const id = intParam(c.req.param("id"), "consultation");
  const r = await consultationOf(doctor.id, id);
  const patientId = r.patient_id;
  const [[p], [clinical], weights, reports, [last], rx, [plan], plans] = await Promise.all([
    sql`select * from patient_profiles where user_id = ${patientId}`,
    sql`select allergies, outside_medicines from patient_clinical where patient_id = ${patientId}`,
    sql`select weight_kg, logged_at from weight_logs where user_id = ${patientId} order by logged_at desc limit 40`,
    sql`select id, source, title, file_name, file_path, uploaded_at, lab_booking_id from reports
        where user_id = ${patientId} and file_path is not null order by uploaded_at desc`,
    // the last prescription issued before this consultation: a follow-up's prescription starts from it
    sql`select x.*, d.full_name as doctor from prescriptions x join doctors d on d.id = x.doctor_id
        where x.patient_id = ${patientId} and x.status in ('SIGNED', 'SUPERSEDED') and coalesce(x.appointment_id, 0) <> ${id}
        order by coalesce(x.sent_at, x.signed_at) desc limit 1`,
    prescriptionOf(id),
    sql`select pl.name, s.ends_at from subscriptions s join plans pl on pl.id = s.plan_id
        where s.user_id = ${patientId} and s.status = 'Active' and s.ends_at > now() order by s.ends_at desc limit 1`,
    // the plans the doctor can add to the prescription (bought with the medicines, in one payment)
    sql`select id, name, duration_months from plans where active and price_rupees > 0 order by duration_months`,
  ]);
  await sql`insert into audit_log (patient_id, actor_id, action) values (${patientId}, ${doctor.id}, ${`Opened the consultation, ${doctor.name}`})`;
  const kg = weights[0]?.weight_kg ?? p?.weight_kg ?? null;
  const monthAgo = weights.find((w) => Date.now() - new Date(w.logged_at).getTime() >= 28 * 86_400_000);
  const conditions = Array.isArray(p?.conditions)
    ? p.conditions.map((x: Row) => (x.code === "OTHER" ? x.otherText || "Other" : CONDITIONS[x.code] ?? x.code)) : [];
  return ok(c, {
    consultation: { ...rowOf(r), endsAt: ist(r.ends_at), reason: String(r.reason ?? "").split(" | Note:")[0], callOpen: callOpenOf(r) },
    patient: {
      id: String(patientId), name: patientName(r), age: p?.age_years ?? null, sex: p?.gender ?? "",
      heightCm: p?.height_cm ?? null, weightKg: kg, weighedAt: ist(weights[0]?.logged_at ?? p?.updated_at),
      bmi: kg && p?.height_cm ? Math.round((kg / (p.height_cm / 100) ** 2) * 10) / 10 : null,
      // weight change over the last month (the call: "how much weight went up in the last month")
      monthChangeKg: kg && monthAgo ? Math.round((kg - monthAgo.weight_kg) * 10) / 10 : null,
      allergies: clinical?.allergies ?? null, conditions, onPlan: Boolean(plan),
    },
    reports: reports.map((x) => ({
      id: String(x.id), title: x.title || (x.source === "LAB" ? "Blood test" : x.file_name || "Report"),
      source: x.source, at: ist(x.uploaded_at), file: `/api/files/reports/${x.id}`,
    })),
    lastPrescription: last ? {
      id: String(last.id), at: ist(last.sent_at ?? last.signed_at), doctorName: last.doctor, diagnosis: last.diagnosis ?? "",
      patientHistory: last.patient_history ?? "", advice: last.advice ?? "",
      medicines: (last.items as Row[]).map(lineView), pdf: `/api/files/prescriptions/${last.id}`,
    } : null,
    prescription: prescriptionView(rx),
    plans: plans.map((x) => ({ id: String(x.id), name: x.name, months: x.duration_months })),
    activePlan: plan ? { planName: plan.name, endsAt: ist(plan.ends_at) } : null,
  });
});

// ---------- writing, the PDF and sending ----------

/** The draft this consultation's page writes to; created on the first save. A sent one is changed only by revise. */
async function draftFor(doctor: Doctor, r: Row): Promise<Row> {
  const [d] = await sql`select * from prescriptions where appointment_id = ${r.id} and status = 'DRAFT'`;
  if (d) return d;
  if (r.sent_id) fail(409, "This prescription was sent. Choose Edit and send new version to change it.");
  const [created] = await sql`
    insert into prescriptions (patient_id, doctor_id, appointment_id, status, version, items, diagnosis)
    values (${r.patient_id}, ${doctor.id}, ${r.id}, 'DRAFT',
      (select coalesce(max(version), 0) + 1 from prescriptions where patient_id = ${r.patient_id}), '[]'::jsonb, '')
    on conflict (appointment_id) where status = 'DRAFT' and appointment_id is not null do nothing
    returning *`;
  return created ?? (await sql`select * from prescriptions where appointment_id = ${r.id} and status = 'DRAFT'`)[0];
}

const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+$/g, "").slice(0, max);

consultationRoutes.put("/doctor/consultations/:id/prescription", async (c) => {
  const doctor = await doctorOf(c);
  const r = await consultationOf(doctor.id, intParam(c.req.param("id"), "consultation"));
  if (r.status === "Cancelled") fail(409, "This consultation was cancelled.");
  const input = await body<Row>(c);
  const lines = Array.isArray(input.medicines) ? input.medicines.slice(0, 20) : null;
  const ids = (lines ?? []).map((l: Row) => Number(l.medicineId)).filter((n: number) => Number.isInteger(n) && n > 0);
  const listed = new Map((ids.length
    ? await sql`select * from medicines where id in ${sql(ids)} and active` : []).map((m: Row) => [m.id, m]));
  // the plan, bought with the medicines: an active plan from the list, or none
  let planId = undefined as number | null | undefined;
  if (input.planId !== undefined) {
    planId = input.planId ? Number(input.planId) : null;
    if (planId !== null && (!Number.isInteger(planId) ||
        !(await sql`select 1 from plans where id = ${planId} and active and price_rupees > 0`).length))
      fail(400, "That plan is not available.");
  }
  const draft = await draftFor(doctor, r);
  const items = lines ? lines.map((l: Row, i: number) => lineOf(l, listed.get(Number(l.medicineId)), i)) : draft.items;
  const [saved] = await sql`
    update prescriptions set
      diagnosis = ${input.diagnosis !== undefined ? text(input.diagnosis, 2000) : draft.diagnosis ?? ""},
      patient_history = ${input.patientHistory !== undefined ? text(input.patientHistory, 4000) : draft.patient_history},
      remarks = ${input.remarks !== undefined ? text(input.remarks, 2000) : draft.remarks},
      advice = ${input.advice !== undefined ? text(input.advice, 4000) : draft.advice},
      items = ${sql.json(items)}, plan_id = ${planId === undefined ? draft.plan_id : planId},
      saved_at = date_trunc('milliseconds', clock_timestamp())
    where id = ${draft.id} and status = 'DRAFT' returning *`;
  if (!saved) fail(409, "This prescription was sent a moment ago. Reload the page.");
  return ok(c, prescriptionView(saved), "Saved");
});

/** The longest a line may run for a patient with no plan (the nano plan): one month (12 Nov 2026 call). */
const NANO_DAYS = 31;

/** A prescription is issued only for a consultation that is not cancelled and whose call has opened. */
function mayIssue(r: Row) {
  if (r.status === "Cancelled") fail(409, "This consultation was cancelled.");
  if (Date.now() < new Date(r.starts_at).getTime() - OPENS_BEFORE)
    fail(409, "The prescription can be finished once the call opens.");
}

/** What the PDF needs before it can be made; the first gap, in the words the doctor sees. */
function missingFor(rx: Row, onPlan: boolean): string | null {
  if (!String(rx.diagnosis ?? "").trim()) return "Write the diagnosis first.";
  for (const [i, l] of (rx.items as Row[]).entries()) {
    const which = (rx.items as Row[]).length > 1 ? `medicine ${i + 1}` : "the medicine";
    if (!String(l.medicineName ?? "").trim()) return `Choose ${which} from the list, or type its name.`;
    if (!String(l.frequency ?? "").trim()) return `Choose how often for ${which}.`;
    // issued for one month without a plan: a longer line would print one thing and order another
    if (!onPlan && Number(l.durationDays) > NANO_DAYS)
      return `This patient is not on a plan yet, so the prescription is for one month. Set ${which} to 1 month or less.`;
  }
  return null;
}

consultationRoutes.post("/doctor/consultations/:id/prescription/pdf", async (c) => {
  const doctor = await doctorOf(c);
  const r = await consultationOf(doctor.id, intParam(c.req.param("id"), "consultation"));
  mayIssue(r);
  const [rx] = await sql`select * from prescriptions where appointment_id = ${r.id} and status = 'DRAFT'`;
  if (!rx) fail(409, r.sent_id ? "This prescription was sent already." : "Write the prescription first.");
  // the PDF carries the time it was made as its signature time; sending issues exactly this file
  // the database's clock, as autosave's: a save that lands while the PDF renders is later than `at`
  // milliseconds, as saved_at: a JS Date carries no finer, so the comparison is exact both ways
  const [{ at }] = await sql`select date_trunc('milliseconds', clock_timestamp()) as at`;
  const { months, onPlan } = await issueMonths(r.patient_id, monthsOf(rx.items), Boolean(rx.plan_id));
  const missing = missingFor(rx, onPlan);
  if (missing) fail(422, missing);
  const path = await renderRx(doctor, r.patient_id, rx, at, months);
  const [made] = await sql`
    update prescriptions set pdf_path = ${path}, pdf_made_at = ${at}, months = ${months}
    where id = ${rx.id} and status = 'DRAFT' and (saved_at is null or saved_at <= ${at}) returning *`;
  if (!made) fail(409, "The prescription changed while the PDF was being made. Create it again.");
  await sql`insert into audit_log (patient_id, actor_id, action) values (${r.patient_id}, ${doctor.id}, ${`Created the prescription PDF, version ${rx.version}, ${doctor.name}`})`;
  return ok(c, prescriptionView(made), "PDF created");
});

consultationRoutes.post("/doctor/consultations/:id/prescription/send", async (c) => {
  const doctor = await doctorOf(c);
  const r = await consultationOf(doctor.id, intParam(c.req.param("id"), "consultation"));
  mayIssue(r);
  const [rx] = await sql`select * from prescriptions where appointment_id = ${r.id} and status = 'DRAFT'`;
  if (!rx) fail(409, r.sent_id ? "This prescription was sent already." : "Write the prescription first.");
  if (!pdfCurrent(rx)) fail(409, "The prescription changed after the PDF was made. Create the PDF again, then send it.");
  const sentAt = new Date();
  await issueRx(doctor, r.patient_id, rx.id, { signedAt: new Date(rx.pdf_made_at), months: rx.months, path: rx.pdf_path, sentAt });
  // sent is done (the row reads SENT). The appointment itself is left alone: a doctor who sends during the
  // call must not lock the patient out of rejoining. The patient joins this doctor's care team, as at End.
  await sql`
    insert into patient_profiles (user_id, care_team_doctor_id) values (${r.patient_id}, ${doctor.id})
    on conflict (user_id) do update set care_team_doctor_id = coalesce(patient_profiles.care_team_doctor_id, excluded.care_team_doctor_id)`;
  const [sent] = await sql`select * from prescriptions where id = ${rx.id}`;
  return ok(c, prescriptionView(sent), "Sent to patient");
});

consultationRoutes.post("/doctor/consultations/:id/prescription/resend", async (c) => {
  const doctor = await doctorOf(c);
  const r = await consultationOf(doctor.id, intParam(c.req.param("id"), "consultation"));
  const [rx] = await sql`select * from prescriptions where appointment_id = ${r.id} and status = 'SIGNED'`;
  if (!rx) fail(409, "There is no current prescription to send again.");
  const [{ n }] = await sql`select count(*)::int as n from patient_messages where prescription_id = ${rx.id} and kind = 'RX_READY'`;
  const messageId = await queueMessage(sql, {
    patientId: r.patient_id, kind: "RX_READY", values: [await firstName(sql, r.patient_id), doctor.name],
    links: [String(rx.id)], dedupeKey: `rx:${rx.id}:v${rx.version}:again:${n}`, prescriptionId: rx.id,
  });
  const [again] = await sql`update prescriptions set resent_at = now() where id = ${rx.id} returning *`;
  if (messageId) await deliver(messageId).catch((e) => console.error("prescription again", e.message));
  await sql`insert into audit_log (patient_id, actor_id, action) values (${r.patient_id}, ${doctor.id}, ${`Sent the prescription again, ${doctor.name}`})`;
  return ok(c, prescriptionView(again), "Sent again");
});

consultationRoutes.post("/doctor/consultations/:id/prescription/revise", async (c) => {
  const doctor = await doctorOf(c);
  const r = await consultationOf(doctor.id, intParam(c.req.param("id"), "consultation"));
  const [open] = await sql`select * from prescriptions where appointment_id = ${r.id} and status = 'DRAFT'`;
  if (open) return ok(c, prescriptionView(open), "Editing the new version");
  const [sent] = await sql`select * from prescriptions where appointment_id = ${r.id} and status = 'SIGNED'`;
  if (!sent) fail(409, "Only the current prescription can be changed. A newer one replaced this one.");
  const [draft] = await sql`
    insert into prescriptions (patient_id, doctor_id, appointment_id, status, version, items, diagnosis, patient_history,
                               remarks, advice, plan_id, saved_at)
    values (${r.patient_id}, ${doctor.id}, ${r.id}, 'DRAFT',
      (select coalesce(max(version), 0) + 1 from prescriptions where patient_id = ${r.patient_id}),
      ${sql.json(sent.items)}, ${sent.diagnosis ?? ""}, ${sent.patient_history}, ${sent.remarks}, ${sent.advice}, ${sent.plan_id},
      date_trunc('milliseconds', clock_timestamp()))
    on conflict (appointment_id) where status = 'DRAFT' and appointment_id is not null do nothing returning *`;
  return ok(c, prescriptionView(draft ?? (await prescriptionOf(r.id))), "Editing the new version");
});

/** "Keep the version already sent": drops the new version being written; the sent one stays current. */
consultationRoutes.post("/doctor/consultations/:id/prescription/discard", async (c) => {
  const doctor = await doctorOf(c);
  const r = await consultationOf(doctor.id, intParam(c.req.param("id"), "consultation"));
  const [sent] = await sql`select * from prescriptions where appointment_id = ${r.id} and status = 'SIGNED'`;
  if (!sent) fail(409, "There is no sent prescription to keep.");
  await sql`update prescriptions set status = 'VOID' where appointment_id = ${r.id} and status = 'DRAFT'`;
  return ok(c, prescriptionView(sent), "Kept the version already sent");
});

// ---------- the master list ----------

consultationRoutes.get("/medicines/search", async (c) => {
  await requireDoctor(c);
  const { matches, didYouMean } = await searchList(String(c.req.query("q") ?? ""));
  return ok(c, { matches: matches.map(toListItem), didYouMean: didYouMean.map(toListItem) });
});
