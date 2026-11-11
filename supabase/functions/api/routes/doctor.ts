// The doctor dashboard: a patient's record, the work queue, call notes and prescriptions.
// Doc: docs/backend/doctor-dashboard.md. Mounted at /api. Every route: role DOCTOR, and only patients
// this doctor treats (an appointment with them, or their care-team doctor); every read of a record
// and every change writes an audit row.
//   GET    /doctor/patients/snapshots
//   GET    /doctor/queue
//   GET    /doctor/work-counts
//   GET    /doctor/patients/:patientId/record
//   GET    /doctor/patients/:patientId/photos
//   POST   /doctor/patients/:patientId/photos/viewed
//   POST   /doctor/patients/:patientId/symptoms/:symptomId/acknowledgement   { outcome }
//   DELETE /doctor/patients/:patientId/symptoms/:symptomId/acknowledgement
//   POST   /doctor/patients/:patientId/labs/:labId/review                    { comment }
//   POST   /doctor/patients/:patientId/prescriptions/:prescriptionId/sign
//   POST   /doctor/patients/:patientId/private-notes                         { text }
//   POST   /doctor/patients/:patientId/plan-recommendation                   { planId, note? }
//   DELETE /doctor/patients/:patientId/plan-recommendation
//   GET    /doctor/notes
//   GET    /doctor/notes/:noteId
//   PUT    /doctor/notes/:noteId                                             ClinicalNoteChanges
//   POST   /doctor/notes/:noteId/sign                                        { sendToApp }
//   POST   /doctor/notes/:noteId/addenda                                     { text }
// How notes and prescriptions come to exist: the pilot has no scribe, so when a consultation ends
// (status Completed or ended_at set) the first notes/queue/count read opens an empty DRAFT note for it,
// with the patient's current medicines listed as CONTINUE. Signing a note turns its included medicine
// changes into a DRAFT prescription (next version), which the doctor signs from the record.
import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "../lib/db.ts";
import { body, fail, intParam, ok } from "../lib/http.ts";
import { requireDoctor } from "../lib/auth.ts";
import { signedUrl, uploadFile } from "../lib/storage.ts";

export const doctorRoutes = new Hono();

type Row = Record<string, any>; // deno-lint-ignore no-explicit-any

/** ISO 8601 in India time, e.g. 2026-10-28T10:30:00+05:30. */
const ist = (d: unknown): string | null =>
  d ? new Date(new Date(d as string).getTime() + 19_800_000).toISOString().slice(0, 19) + "+05:30" : null;

const CONDITION_LABELS: Record<string, string> = {
  T2D: "Type 2 diabetes", PREDIABETES: "Prediabetes", BP: "Hypertension", PCOS: "PCOS", THYROID: "Thyroid",
  FATTY_LIVER: "Fatty liver", LIPIDS: "High cholesterol", SLEEP_APNOEA: "Sleep apnoea", HEART: "Heart disease",
  KIDNEY: "Kidney disease",
};
const CONSENT_LABELS: Record<string, string> = {
  TERMS: "Terms", PRIVACY: "Privacy", HEALTH_DATA: "Health data", TELECONSULT: "Video consultation",
  AI: "Call transcription",
};
const SECTION_KEYS = ["summary", "assessment", "plan", "patient"] as const;
const URGENT_WORDS = /\b(chest pain|breath|faint|fainted|unconscious|vomiting blood|blood|severe|emergency|urgent|suicid|seizure|can'?t breathe)\b/i;

const conditionLabels = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? raw.map((c: Row) => (c.code === "OTHER" ? c.otherText || "Other" : CONDITION_LABELS[c.code] ?? c.code))
    : [];
const programmeOf = (raw: unknown) =>
  Array.isArray(raw) && raw.some((c: Row) => c.code === "T2D") ? "Diabetes care" : "Weight care";
const patientName = (r: Row) =>
  r.full_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || `Patient ${r.patient_id ?? r.id}`;

/** The doctor's patients: anyone with an appointment with them, or whose care-team doctor they are. */
export const treatedIds = (doctorId: number) => sql`
  select patient_id from appointments where doctor_id = ${doctorId}
  union select user_id from patient_profiles where care_team_doctor_id = ${doctorId}`;

async function doctorOf(c: Context) {
  const me = await requireDoctor(c);
  const [d] = await sql`select full_name, qualification, specialization from doctors where id = ${me.id}`;
  return { id: me.id, name: d?.full_name ?? me.fullName ?? "Doctor", qualification: d?.qualification ?? d?.specialization ?? "" };
}

async function assertTreats(doctorId: number, patientId: number) {
  const [row] = await sql`select 1 from (${treatedIds(doctorId)}) t where t.patient_id = ${patientId}`;
  if (!row) fail(403, "This patient is not under your care.");
}

/** The doctor plus the patient id from the path, checked. */
async function forPatient(c: Context) {
  const doctor = await doctorOf(c);
  const patientId = intParam(c.req.param("patientId"), "patient");
  await assertTreats(doctor.id, patientId);
  return { doctor, patientId };
}

const audit = (patientId: number | null, doctor: { id: number; name: string }, action: string) =>
  sql`insert into audit_log (patient_id, actor_id, action) values (${patientId}, ${doctor.id}, ${`${action}, ${doctor.name}`})`;

// ---------- call notes ----------

const emptySections = () => SECTION_KEYS.map((key) => ({ key, draft: [], current: [], checked: false }));

/** Opens an empty draft note for every finished consultation of this doctor that has none. */
async function openDraftNotes(doctorId: number) {
  const missing = await sql`
    select a.id, a.patient_id, a.visit_type, a.reason, a.started_at, a.ended_at, a.created_at,
           (s.slot_date + s.start_time) at time zone 'Asia/Kolkata' as slot_at
    from appointments a left join doctor_slots s on s.id = a.slot_id
    left join clinical_notes n on n.appointment_id = a.id
    where a.doctor_id = ${doctorId} and n.id is null and (a.status = 'Completed' or a.ended_at is not null)`;
  for (const a of missing) {
    const [rx] = await sql`
      select items from prescriptions where patient_id = ${a.patient_id} and status = 'SIGNED'
      order by version desc, id desc limit 1`;
    const medicines = ((rx?.items ?? []) as Row[]).map((item, i) => ({
      id: `m${i + 1}`, action: "CONTINUE", name: item.medicineName ?? "", strength: item.strength ?? "",
      detail: item.frequency ?? "", was: null, evidence: [], include: true,
    }));
    const callAt = a.started_at ?? a.slot_at ?? a.created_at;
    const minutes = a.started_at && a.ended_at
      ? Math.max(1, Math.round((new Date(a.ended_at).getTime() - new Date(a.started_at).getTime()) / 60_000))
      : 30;
    await sql`
      insert into clinical_notes (appointment_id, patient_id, doctor_id, type, reason, call_at, minutes, transcribed,
                                  ready_at, sections, medicines, history)
      values (${a.id}, ${a.patient_id}, ${doctorId}, ${a.visit_type === "FOLLOW_UP" ? "FOLLOW_UP" : "FIRST_CONSULTATION"},
              ${String(a.reason ?? "").split(" | Note:")[0]}, ${callAt}, ${minutes}, false, ${a.ended_at ?? new Date()},
              ${sql.json(emptySections())}, ${sql.json(medicines)},
              ${sql.json([{ at: ist(new Date()), what: "Note opened for you to write (no scribe in the pilot)" }])})
      on conflict (appointment_id) do nothing`;
  }
}

async function loadNote(noteId: number, doctorId: number, withTranscript = true) {
  const [n] = await sql`
    select n.*, coalesce(u.full_name, nullif(concat_ws(' ', p.first_name, p.last_name), '')) as full_name,
           rx.version as rx_version, rx.status as rx_status
    from clinical_notes n join users u on u.id = n.patient_id
    left join patient_profiles p on p.user_id = n.patient_id
    left join prescriptions rx on rx.id = n.prescription_id
    where n.id = ${noteId} and n.doctor_id = ${doctorId}`;
  if (!n) fail(404, "That call note was not found.");
  const addenda = await sql`
    select a.at, a.text, d.full_name from note_addenda a join doctors d on d.id = a.doctor_id
    where a.note_id = ${noteId} order by a.at`;
  return toNote(n, addenda, withTranscript);
}

function toNote(n: Row, addenda: Row[] = [], withTranscript = true) {
  const signed = n.signed
    ? { ...n.signed, prescriptionVersion: n.rx_version ?? null,
        prescriptionStatus: n.rx_status === "SIGNED" || n.rx_status === "SUPERSEDED" ? "SIGNED" : n.rx_status ? "DRAFT" : null }
    : null;
  return {
    id: String(n.id), patientId: String(n.patient_id), patientName: patientName({ ...n, id: n.patient_id }),
    type: n.type, reason: n.reason, callAt: ist(n.call_at), minutes: n.minutes, transcribed: n.transcribed,
    readyAt: ist(n.ready_at), status: n.status, sections: n.sections, medicines: n.medicines,
    followUps: n.follow_ups, recordUpdates: n.record_updates, checks: n.checks,
    transcript: withTranscript ? n.transcript : [], signed,
    addenda: addenda.map((a) => ({ at: ist(a.at), by: a.full_name, text: a.text })),
    history: n.history,
  };
}

const sentences = (sections: Row[], key: string): Row[] => sections.find((s) => s.key === key)?.current ?? [];

// ponytail: the note screen can only include or leave out medicines, never add one, and the pilot has no
// scribe. So a Plan sentence like "Start Metformin 500 mg, twice a day after meals" (or any sentence
// prefixed "Rx:") becomes a medicine change on save. Unprefixed sentences need a strength, so "Continue
// walking every evening" stays prose. Replace with an "Add medicine" control on the note screen.
const RX_SENTENCE =
  /^(?:rx:\s*)?(start|stop|change|continue)\s+([A-Za-z][\w\-\/]*(?:\s+[A-Za-z][\w\-\/]*)*)(?:\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?)\b))?\s*[,;:]?\s*(.*?)\.?\s*$/i;

export function planMedicines(sections: Row[], previous: Row[] = []): Row[] {
  const included = new Map(previous.map((m) => [m.id, m.include]));
  const fromPlan = sentences(sections, "plan").flatMap((s) => {
    const text = String(s.text ?? "").trim();
    const m = RX_SENTENCE.exec(text);
    if (!m || (!/^rx:/i.test(text) && !m[3])) return [];
    const id = `plan-${s.id}`;
    return [{ id, action: m[1].toUpperCase(), name: m[2], strength: m[3] ?? "", detail: m[4] ?? "",
      was: null, evidence: [], include: included.get(id) ?? true }];
  });
  return [...previous.filter((m) => !String(m.id).startsWith("plan-")), ...fromPlan];
}

doctorRoutes.get("/doctor/notes", async (c) => {
  const doctor = await doctorOf(c);
  await openDraftNotes(doctor.id);
  const rows = await sql`
    select n.*, coalesce(u.full_name, nullif(concat_ws(' ', p.first_name, p.last_name), '')) as full_name,
           rx.version as rx_version, rx.status as rx_status
    from clinical_notes n join users u on u.id = n.patient_id
    left join patient_profiles p on p.user_id = n.patient_id
    left join prescriptions rx on rx.id = n.prescription_id
    where n.doctor_id = ${doctor.id}
      and (n.status = 'DRAFT' or (n.signed->>'at')::timestamptz > now() - interval '30 days')
    order by n.call_at desc`;
  return ok(c, rows.map((n) => toNote(n, [], false)));
});

doctorRoutes.get("/doctor/notes/:noteId", async (c) => {
  const doctor = await doctorOf(c);
  const note = await loadNote(intParam(c.req.param("noteId"), "note"), doctor.id);
  await audit(Number(note.patientId), doctor, "Opened the call note");
  return ok(c, note);
});

doctorRoutes.put("/doctor/notes/:noteId", async (c) => {
  const doctor = await doctorOf(c);
  const noteId = intParam(c.req.param("noteId"), "note");
  const input = await body<Row>(c);
  const [n] = await sql`select * from clinical_notes where id = ${noteId} and doctor_id = ${doctor.id}`;
  if (!n) fail(404, "That call note was not found.");
  const change = String(input.change ?? "Edited the note").slice(0, 200);
  const history = [...n.history, { at: ist(new Date()), what: change }];

  if (n.status === "SIGNED") {
    // a signed note is final; only follow-ups may be ticked off after the call
    const same = (a: unknown, b: unknown) => a === undefined || JSON.stringify(a) === JSON.stringify(b);
    const stripDone = (list: Row[] = []) => list.map(({ done: _done, ...rest }) => rest);
    if (!same(input.sections, n.sections) || !same(input.medicines, n.medicines) ||
        !same(input.recordUpdates, n.record_updates) || !same(input.checks, n.checks) ||
        (input.followUps && JSON.stringify(stripDone(input.followUps)) !== JSON.stringify(stripDone(n.follow_ups))))
      fail(409, "This note is signed. Add an addendum to correct it.");
    const done = new Map((input.followUps ?? []).map((f: Row) => [f.id, !!f.done]));
    const followUps = (n.follow_ups as Row[]).map((f) => ({ ...f, done: done.has(f.id) ? done.get(f.id) : f.done }));
    await sql`update clinical_notes set follow_ups = ${sql.json(followUps)}, history = ${sql.json(history)} where id = ${noteId}`;
  } else {
    const sections = Array.isArray(input.sections) && input.sections.length === 4 ? input.sections : n.sections;
    await sql`
      update clinical_notes set sections = ${sql.json(sections)},
        medicines = ${sql.json(planMedicines(sections, Array.isArray(input.medicines) ? input.medicines : n.medicines))},
        follow_ups = ${sql.json(Array.isArray(input.followUps) ? input.followUps : n.follow_ups)},
        record_updates = ${sql.json(Array.isArray(input.recordUpdates) ? input.recordUpdates : n.record_updates)},
        checks = ${sql.json(input.checks && typeof input.checks === "object" ? input.checks : n.checks)},
        history = ${sql.json(history)}
      where id = ${noteId}`;
  }
  await audit(n.patient_id, doctor, change);
  return ok(c, await loadNote(noteId, doctor.id), "Saved");
});

doctorRoutes.post("/doctor/notes/:noteId/sign", async (c) => {
  const doctor = await doctorOf(c);
  const noteId = intParam(c.req.param("noteId"), "note");
  const sendToApp = (await body<Row>(c)).sendToApp !== false;
  const [n] = await sql`select * from clinical_notes where id = ${noteId} and doctor_id = ${doctor.id}`;
  if (!n) fail(404, "That call note was not found.");
  if (n.status === "SIGNED") fail(409, "This note is already signed.");
  const sections = n.sections as Row[];
  if (sections.some((s) => (s.current as Row[]).some((x) => x.flag && !x.flag.resolved)))
    fail(422, "Resolve every flagged sentence before signing.");
  if (!sentences(sections, "summary").length || !sentences(sections, "plan").length)
    fail(422, "Write the visit summary and the plan before signing.");

  await sql.begin(async (tx) => {
    // included medicine changes become the next DRAFT prescription, applied to the current signed one
    const changes = (n.medicines as Row[]).filter((m) => m.include && m.action !== "CONTINUE");
    let prescriptionId: number | null = null;
    if (changes.length) {
      const [current] = await tx`
        select items, version from prescriptions where patient_id = ${n.patient_id} and status = 'SIGNED'
        order by version desc limit 1`;
      const [{ next }] = await tx`select coalesce(max(version), 0) + 1 as next from prescriptions where patient_id = ${n.patient_id}`;
      let items = [...((current?.items ?? []) as Row[])];
      for (const m of changes) {
        items = items.filter((i) => String(i.medicineName).toLowerCase() !== String(m.name).toLowerCase());
        if (m.action !== "STOP")
          items.push({ medicineName: m.name, strength: m.strength, dose: "", frequency: m.detail, route: "",
                       instructions: m.detail, reason: "", genericName: null });
      }
      const [rx] = await tx`
        insert into prescriptions (patient_id, doctor_id, appointment_id, status, version, items)
        values (${n.patient_id}, ${doctor.id}, ${n.appointment_id}, 'DRAFT', ${next}, ${tx.json(items)}) returning id`;
      prescriptionId = rx.id;
    }
    // included record updates apply to the record
    for (const u of (n.record_updates as Row[]).filter((x) => x.include)) {
      const verified = /^(yes|true|verified)/i.test(String(u.to));
      const meds = String(u.to).toLowerCase() === "none" ? [] : String(u.to).split(/,\s*/).filter(Boolean);
      await tx`insert into patient_clinical (patient_id) values (${n.patient_id}) on conflict do nothing`;
      if (u.field === "allergies") await tx`update patient_clinical set allergies = ${u.to}, updated_at = now() where patient_id = ${n.patient_id}`;
      if (u.field === "identity_verified") await tx`update patient_clinical set identity_verified = ${verified}, updated_at = now() where patient_id = ${n.patient_id}`;
      if (u.field === "outside_medicines") await tx`update patient_clinical set outside_medicines = ${meds}, updated_at = now() where patient_id = ${n.patient_id}`;
    }
    await tx`
      update symptom_logs set acknowledged_by = ${doctor.id}, acknowledged_at = now(), outcome = 'Discussed on the call'
      where patient_id = ${n.patient_id} and requires_review and acknowledged_at is null and at <= ${n.call_at}::timestamptz + interval '2 hours'`;
    const signed = { at: ist(new Date()), by: doctor.name, byQualification: doctor.qualification, sentToApp: sendToApp };
    await tx`
      update clinical_notes set status = 'SIGNED', signed = ${tx.json(signed)}, prescription_id = ${prescriptionId},
        history = ${tx.json([...n.history, { at: ist(new Date()), what: `Signed by ${doctor.name}` }])}
      where id = ${noteId}`;
    await tx`insert into audit_log (patient_id, actor_id, action) values (${n.patient_id}, ${doctor.id}, ${`Signed the call note, ${doctor.name}`})`;
  });
  return ok(c, await loadNote(noteId, doctor.id), "Signed");
});

doctorRoutes.post("/doctor/notes/:noteId/addenda", async (c) => {
  const doctor = await doctorOf(c);
  const noteId = intParam(c.req.param("noteId"), "note");
  const text = String((await body<Row>(c)).text ?? "").trim();
  if (!text) fail(400, "Write the addendum first.");
  const [n] = await sql`select patient_id, status from clinical_notes where id = ${noteId} and doctor_id = ${doctor.id}`;
  if (!n) fail(404, "That call note was not found.");
  if (n.status !== "SIGNED") fail(409, "Edit the draft instead; addenda are for signed notes.");
  await sql`insert into note_addenda (note_id, doctor_id, text) values (${noteId}, ${doctor.id}, ${text.slice(0, 4000)})`;
  await audit(n.patient_id, doctor, "Added an addendum to a call note");
  return ok(c, await loadNote(noteId, doctor.id), "Addendum added");
});

// ---------- queue and counts ----------

async function waitingItems(doctorId: number) {
  await openDraftNotes(doctorId);
  const ids = treatedIds(doctorId);
  const nameCols = sql`coalesce(u.full_name, nullif(concat_ws(' ', p.first_name, p.last_name), '')) as full_name`;
  const [symptoms, labs, notes, rxs, chats] = await Promise.all([
    sql`select s.*, ${nameCols} from symptom_logs s join users u on u.id = s.patient_id
        left join patient_profiles p on p.user_id = s.patient_id
        where s.patient_id in (${ids}) and s.requires_review and s.acknowledged_at is null order by s.at`,
    sql`select r.*, ${nameCols} from reports r join users u on u.id = r.user_id
        left join patient_profiles p on p.user_id = r.user_id
        where r.user_id in (${ids}) and r.status = 'RECEIVED' order by r.uploaded_at`,
    sql`select n.id, n.patient_id, n.call_at, n.reason, ${nameCols} from clinical_notes n join users u on u.id = n.patient_id
        left join patient_profiles p on p.user_id = n.patient_id
        where n.doctor_id = ${doctorId} and n.status = 'DRAFT' order by n.call_at`,
    sql`select x.id, x.patient_id, x.version, x.created_at, ${nameCols} from prescriptions x join users u on u.id = x.patient_id
        left join patient_profiles p on p.user_id = x.patient_id
        where x.doctor_id = ${doctorId} and x.status = 'DRAFT' order by x.created_at`,
    // patient messages after the doctor's last reply and after "no reply needed"
    sql`select cs.id, cs.patient_id, ${nameCols},
          min(m.sent_at) as waiting_since, string_agg(m.message_text, ' ') as texts
        from chat_sessions cs join users u on u.id = cs.patient_id
        left join patient_profiles p on p.user_id = cs.patient_id
        join chat_messages m on m.session_id = cs.id and m.sender_role = 'PATIENT'
          and m.sent_at > greatest(coalesce(cs.no_reply_needed_at, '-infinity'),
            coalesce((select max(d.sent_at) from chat_messages d where d.session_id = cs.id and d.sender_role = 'DOCTOR'), '-infinity'))
        where cs.doctor_id = ${doctorId}
        group by cs.id, cs.patient_id, u.full_name, p.first_name, p.last_name order by waiting_since`,
  ]);
  const rank = { Severe: 0, Moderate: 1, Mild: 2 } as Record<string, number>;
  const items = [
    ...symptoms.map((s) => ({ order: rank[s.severity], id: String(s.id), kind: "symptom", patientId: String(s.patient_id),
      patientName: patientName(s), title: `${s.label}, ${s.severity.toLowerCase()}`, detail: s.note, at: ist(s.at),
      severity: s.severity, urgent: false })),
    ...chats.map((m) => {
      const urgent = URGENT_WORDS.test(m.texts ?? "");
      return { order: urgent ? 3 : 5, id: `chat_${m.id}`, kind: "message", patientId: String(m.patient_id),
        patientName: patientName(m), title: urgent ? "Urgent message" : "Message for you",
        detail: String(m.texts ?? "").slice(0, 140), at: ist(m.waiting_since), severity: null, urgent };
    }),
    ...labs.map((r) => ({ order: 4, id: String(r.id), kind: "lab", patientId: String(r.user_id), patientName: patientName(r),
      title: "Report to review", detail: r.title ?? r.file_name ?? "Lab report", at: ist(r.uploaded_at), severity: null, urgent: false })),
    ...notes.map((n) => ({ order: 6, id: String(n.id), kind: "note", patientId: String(n.patient_id), patientName: patientName(n),
      title: "Call note to sign", detail: n.reason ?? "", at: ist(n.call_at), severity: null, urgent: false })),
    ...rxs.map((x) => ({ order: 7, id: String(x.id), kind: "rx", patientId: String(x.patient_id), patientName: patientName(x),
      title: "Prescription to sign", detail: `Version ${x.version}`, at: ist(x.created_at), severity: null, urgent: false })),
  ];
  items.sort((a, b) => a.order - b.order || String(a.at).localeCompare(String(b.at)));
  return items.map(({ order: _order, ...item }) => item);
}

doctorRoutes.get("/doctor/queue", async (c) => {
  const doctor = await doctorOf(c);
  return ok(c, await waitingItems(doctor.id));
});

doctorRoutes.get("/doctor/work-counts", async (c) => {
  const doctor = await doctorOf(c);
  const items = await waitingItems(doctor.id);
  return ok(c, {
    waitingOnYou: items.length,
    notesToSign: items.filter((i) => i.kind === "note").length,
    messagesForYou: items.filter((i) => i.kind === "message").length,
  });
});

// ---------- patients ----------

doctorRoutes.get("/doctor/patients/snapshots", async (c) => {
  const doctor = await doctorOf(c);
  const rows = await sql`
    select t.patient_id, p.conditions, p.height_cm,
      (select a.city from addresses a where a.user_id = t.patient_id order by a.is_default desc, a.id desc limit 1) as city,
      (select min(a.created_at) from appointments a where a.patient_id = t.patient_id) as care_started_at,
      coalesce((select w.weight_kg from weight_logs w where w.user_id = t.patient_id order by w.logged_at desc limit 1), p.weight_kg) as weight_kg
    from (${treatedIds(doctor.id)}) t left join patient_profiles p on p.user_id = t.patient_id`;
  return ok(c, rows.map((r) => ({
    patientId: String(r.patient_id), programme: programmeOf(r.conditions), city: r.city ?? "",
    conditions: conditionLabels(r.conditions), careStartedAt: ist(r.care_started_at),
    bmi: r.weight_kg && r.height_cm ? Math.round((r.weight_kg / (r.height_cm / 100) ** 2) * 10) / 10 : null,
    latestHba1c: null, // ponytail: lab results are not parsed in the pilot; add when reports carry results
  })));
});

doctorRoutes.get("/doctor/patients/:patientId/record", async (c) => {
  const { doctor, patientId } = await forPatient(c);
  await audit(patientId, doctor, "Opened the record");
  const [[p], [clinical], weights, consents, labs, rxs, visits, symptoms, privateNotes, auditRows, [photos], [first], [lastAppt], [city]] =
    await Promise.all([
      sql`select * from patient_profiles where user_id = ${patientId}`,
      sql`select * from patient_clinical where patient_id = ${patientId}`,
      sql`select weight_kg, logged_at, source from weight_logs where user_id = ${patientId} order by logged_at`,
      sql`select consent_type from consents where user_id = ${patientId} and revoked_at is null order by id`,
      sql`select * from reports where user_id = ${patientId} order by uploaded_at desc`,
      sql`select * from prescriptions where patient_id = ${patientId} and status <> 'VOID' order by version desc, id desc`,
      sql`select * from clinical_notes where patient_id = ${patientId} and status = 'SIGNED' order by call_at desc`,
      sql`select * from symptom_logs where patient_id = ${patientId} order by at desc limit 50`,
      sql`select n.*, d.full_name from private_notes n join doctors d on d.id = n.doctor_id
          where n.patient_id = ${patientId} order by n.at desc`,
      sql`select at, action from audit_log where patient_id = ${patientId} order by at desc limit 100`,
      sql`select count(*)::int as n from progress_photos where patient_id = ${patientId} and shared_with_doctor`,
      sql`select min(created_at) as at from appointments where patient_id = ${patientId}`,
      sql`select reason from appointments where patient_id = ${patientId} order by created_at desc limit 1`,
      sql`select city from addresses where user_id = ${patientId} order by is_default desc, id desc limit 1`,
    ]);
  const weightSource = (s: string) => (s === "ONBOARDING" ? "At sign-up" : s === "DOCTOR" ? "Doctor recorded" : "Patient logged");
  const [[rec], [sub]] = await Promise.all([
    sql`select r.plan_id, r.note, r.created_at, pl.name from plan_recommendations r join plans pl on pl.id = r.plan_id
        where r.patient_id = ${patientId} order by r.created_at desc limit 1`,
    sql`select pl.name, s.ends_at from subscriptions s join plans pl on pl.id = s.plan_id
        where s.user_id = ${patientId} and s.status = 'Active' and s.ends_at > now() order by s.ends_at desc limit 1`,
  ]);
  return ok(c, {
    planRecommendation: rec ? { planId: rec.plan_id, planName: rec.name, note: rec.note ?? "", recommendedAt: ist(rec.created_at) } : null,
    activePlan: sub ? { planName: sub.name, endsAt: ist(sub.ends_at) } : null,
    programme: programmeOf(p?.conditions),
    city: city?.city ?? "",
    careStartedAt: ist(first?.at),
    identityVerified: clinical?.identity_verified ?? false,
    heightCm: p?.height_cm ?? null,
    weights: weights.length
      ? weights.map((w) => ({ at: ist(w.logged_at), kg: w.weight_kg, source: weightSource(w.source) }))
      : p?.weight_kg ? [{ at: ist(p.updated_at), kg: p.weight_kg, source: "At sign-up" }] : [],
    waist: null,
    hba1c: [],
    conditions: conditionLabels(p?.conditions),
    allergies: clinical?.allergies ?? null,
    outsideMedicines: clinical?.outside_medicines ?? null,
    consents: consents.map((x) => CONSENT_LABELS[x.consent_type] ?? x.consent_type),
    plan: clinical?.plan ?? null,
    concern: String(lastAppt?.reason ?? "").split(" | Note:")[0],
    screening: null,
    labs: await Promise.all(labs.map(async (r) => ({
      id: String(r.id),
      source: r.source === "LAB" ? "LAB" : "UPLOAD",
      file: r.file_path ? `/api/files/reports/${r.id}` : null,
      fileUrl: await signedUrl("reports", r.file_path), // ponytail: until the web app opens `file`; then delete
      packageName: r.title || (r.source === "LAB" ? "Lab report" : r.file_name || "Uploaded report"),
      collectedAt: ist(r.report_date ?? r.uploaded_at), reportedAt: ist(r.uploaded_at),
      status: r.status === "REVIEWED" ? "REVIEWED" : "DOCTOR_REVIEW_PENDING",
      // review_note also carries the eligibility outcome; only a doctor's review counts as their comment
      results: [], doctorComment: r.reviewed_by ? r.review_note ?? null : null, reviewedAt: ist(r.reviewed_at),
    }))),
    prescriptions: rxs.map((x) => ({
      id: String(x.id), version: x.version, status: x.status, date: ist(x.signed_at ?? x.created_at),
      items: (x.items as Row[]).map((i) => ({ name: i.medicineName ?? "", strength: i.strength ?? "", dose: i.dose ?? "",
        frequency: i.frequency ?? "", duration: i.duration ?? "" })),
      // instructions that only repeat the frequency (doctor-added medicines) are not shown twice
      advice: (x.items as Row[]).filter((i) => i.instructions && i.instructions !== i.frequency).map((i) => i.instructions).join(" "),
    })),
    visits: visits.map((n) => ({
      id: `visit_${n.id}`, at: ist(n.call_at), type: n.type,
      summary: sentences(n.sections, "summary").map((s) => s.text).join(" "),
      assessment: sentences(n.sections, "assessment").map((s) => s.text).join(" ") || null,
      noteId: String(n.id), plan: sentences(n.sections, "plan").map((s) => s.text),
    })),
    symptoms: symptoms.map((s) => ({ id: String(s.id), label: s.label, severity: s.severity, note: s.note, at: ist(s.at),
      requiresReview: s.requires_review, acknowledged: !!s.acknowledged_at })),
    adherence: null,
    injections: null,
    privateNotes: privateNotes.map((n) => ({ id: String(n.id), at: ist(n.at), text: n.text, by: n.full_name })),
    audit: auditRows.map((a) => ({ at: ist(a.at), action: a.action })),
    photosShared: (photos?.n ?? 0) > 0,
  });
});

doctorRoutes.get("/doctor/patients/:patientId/photos", async (c) => {
  const { doctor, patientId } = await forPatient(c);
  const rows = await sql`
    select ph.*, (select w.weight_kg from weight_logs w where w.user_id = ph.patient_id
                    and abs(extract(epoch from w.logged_at - ph.taken_at)) <= 3 * 86400
                  order by abs(extract(epoch from w.logged_at - ph.taken_at)) limit 1) as weight_kg
    from progress_photos ph where ph.patient_id = ${patientId} and ph.shared_with_doctor order by ph.taken_at`;
  if (!rows.length) fail(403, "This patient is not sharing progress photos.");
  await audit(patientId, doctor, "Listed the progress photos");
  return ok(c, await Promise.all(rows.map(async (r) => ({
    id: String(r.id), takenAt: ist(r.taken_at), weightKg: r.weight_kg ?? null,
    front: r.front_path ? `/api/files/photos/${r.id}/front` : null,
    side: r.side_path ? `/api/files/photos/${r.id}/side` : null,
    // ponytail: the signed links stay until the web app that opens front/side is live; then delete them
    frontUrl: await signedUrl("photos", r.front_path, 300), sideUrl: await signedUrl("photos", r.side_path, 300),
  }))));
});

doctorRoutes.post("/doctor/patients/:patientId/photos/viewed", async (c) => {
  const { doctor, patientId } = await forPatient(c);
  await audit(patientId, doctor, "Viewed the progress photos");
  return ok(c, null, "Noted");
});

doctorRoutes.post("/doctor/patients/:patientId/symptoms/:symptomId/acknowledgement", async (c) => {
  const { doctor, patientId } = await forPatient(c);
  const symptomId = intParam(c.req.param("symptomId"), "symptom");
  const outcome = String((await body<Row>(c)).outcome ?? "").trim() || "Acknowledged";
  const [s] = await sql`
    update symptom_logs set acknowledged_by = ${doctor.id}, acknowledged_at = now(), outcome = ${outcome.slice(0, 200)}
    where id = ${symptomId} and patient_id = ${patientId} returning label`;
  if (!s) fail(400, "That symptom was not found for this patient.");
  await audit(patientId, doctor, `Acknowledged ${s.label}: ${outcome}`);
  return ok(c, null, "Acknowledged");
});

doctorRoutes.delete("/doctor/patients/:patientId/symptoms/:symptomId/acknowledgement", async (c) => {
  const { doctor, patientId } = await forPatient(c);
  const symptomId = intParam(c.req.param("symptomId"), "symptom");
  const [s] = await sql`
    update symptom_logs set acknowledged_by = null, acknowledged_at = null, outcome = null
    where id = ${symptomId} and patient_id = ${patientId} returning label`;
  if (!s) fail(400, "That symptom was not found for this patient.");
  await audit(patientId, doctor, `Undid the acknowledgement of ${s.label}`);
  return ok(c, null, "Undone");
});

doctorRoutes.post("/doctor/patients/:patientId/labs/:labId/review", async (c) => {
  const { doctor, patientId } = await forPatient(c);
  const labId = intParam(c.req.param("labId"), "report");
  const comment = String((await body<Row>(c)).comment ?? "").trim();
  const [r] = await sql`
    update reports set status = 'REVIEWED', reviewed_by = ${doctor.id}, reviewed_at = now(), review_note = ${comment || null}
    where id = ${labId} and user_id = ${patientId} returning id`;
  if (!r) fail(400, "That report was not found for this patient.");
  await audit(patientId, doctor, "Reviewed a lab report");
  return ok(c, null, "Marked reviewed");
});

doctorRoutes.post("/doctor/patients/:patientId/private-notes", async (c) => {
  const { doctor, patientId } = await forPatient(c);
  const text = String((await body<Row>(c)).text ?? "").trim();
  if (!text) fail(400, "Write the note first.");
  const [n] = await sql`
    insert into private_notes (patient_id, doctor_id, text) values (${patientId}, ${doctor.id}, ${text.slice(0, 4000)})
    returning id, at`;
  await audit(patientId, doctor, "Added a private note");
  return ok(c, { id: String(n.id), at: ist(n.at), text, by: doctor.name }, "Saved");
});

doctorRoutes.post("/doctor/patients/:patientId/plan-recommendation", async (c) => {
  const { doctor, patientId } = await forPatient(c);
  const input = await body<Row>(c);
  const planId = intParam(String(input.planId ?? ""), "plan");
  const note = String(input.note ?? "").trim();
  if (note.length > 500) fail(400, "Keep the note under 500 characters.");
  const [plan] = await sql`select id, name from plans where id = ${planId} and active`;
  if (!plan) fail(400, "That plan is not available.");
  // newest wins for the patient's Plans screen; this doctor's earlier suggestion is replaced
  await sql.begin(async (tx) => {
    await tx`delete from plan_recommendations where patient_id = ${patientId} and doctor_id = ${doctor.id}`;
    await tx`insert into plan_recommendations (patient_id, doctor_id, plan_id, note) values (${patientId}, ${doctor.id}, ${planId}, ${note || null})`;
  });
  await audit(patientId, doctor, `Recommended ${plan.name}`);
  return ok(c, null, "Plan recommended");
});

doctorRoutes.delete("/doctor/patients/:patientId/plan-recommendation", async (c) => {
  const { doctor, patientId } = await forPatient(c);
  await sql`delete from plan_recommendations where patient_id = ${patientId} and doctor_id = ${doctor.id}`;
  await audit(patientId, doctor, "Withdrew the plan recommendation");
  return ok(c, null, "Recommendation withdrawn");
});

doctorRoutes.post("/doctor/patients/:patientId/prescriptions/:prescriptionId/sign", async (c) => {
  const { doctor, patientId } = await forPatient(c);
  const rxId = intParam(c.req.param("prescriptionId"), "prescription");
  const [rx] = await sql`select * from prescriptions where id = ${rxId} and patient_id = ${patientId}`;
  if (!rx) fail(400, "That prescription was not found for this patient.");
  if (rx.status !== "DRAFT") fail(409, "Only a draft prescription can be signed.");
  const items = rx.items as Row[];
  if (!items.length) fail(422, "This prescription has no medicines to sign.");
  const [d] = await sql`select registration_no from doctors where id = ${doctor.id}`;
  const [u] = await sql`
    select coalesce(u.full_name, nullif(concat_ws(' ', p.first_name, p.last_name), '')) as full_name, p.age_years, p.gender
    from users u left join patient_profiles p on p.user_id = u.id where u.id = ${patientId}`;
  const signedAt = new Date();
  const path = `${patientId}/rx-${rxId}-v${rx.version}.pdf`;
  const pdf = prescriptionPdf([
    "InRange prescription",
    `Version ${rx.version}   Signed ${ist(signedAt)?.slice(0, 16).replace("T", " ")} IST`,
    "",
    `Patient: ${u?.full_name ?? ""}${u?.age_years ? `, ${u.age_years} years` : ""}${u?.gender ? `, ${u.gender}` : ""}`,
    `Doctor: ${doctor.name}${doctor.qualification ? `, ${doctor.qualification}` : ""}`,
    `Registration no: ${d?.registration_no ?? "not recorded"}`,
    "",
    ...items.flatMap((i, n) => [
      `${n + 1}. ${i.medicineName ?? ""} ${i.strength ?? ""}`.trim(),
      `   ${[i.dose, i.frequency, i.route].filter(Boolean).join(", ")}`,
      ...(i.instructions ? [`   ${i.instructions}`] : []),
    ]),
    "",
    "Signed electronically under the Telemedicine Practice Guidelines 2020.",
  ]);
  await uploadFile("prescriptions", path, new Blob([pdf], { type: "application/pdf" }), "application/pdf");
  await sql.begin(async (tx) => {
    await tx`update prescriptions set status = 'SUPERSEDED' where patient_id = ${patientId} and status = 'SIGNED'`;
    await tx`update prescriptions set status = 'SIGNED', signed_at = ${signedAt}, pdf_path = ${path} where id = ${rxId}`;
    await tx`
      insert into medicine_orders (patient_id, prescription_id, status, expected_at, items, history)
      values (${patientId}, ${rxId}, 'PLACED', ${new Date(signedAt.getTime() + 3 * 864e5)},
        ${tx.json(items.map((i) => ({ name: `${i.medicineName ?? ""} ${i.strength ?? ""}`.trim(), quantity: "As prescribed" })))},
        ${tx.json([{ status: "PLACED", at: ist(signedAt), note: "Order received by the pharmacy" }])})`;
    await tx`insert into audit_log (patient_id, actor_id, action) values (${patientId}, ${doctor.id}, ${`Signed prescription version ${rx.version}, ${doctor.name}`})`;
  });
  return ok(c, { id: String(rxId), version: rx.version, status: "SIGNED", signedAt: ist(signedAt) }, "Signed");
});

/** A one-page A4 PDF of plain text lines (Helvetica, ASCII). Enough for a pilot prescription. */
function prescriptionPdf(lines: string[]): string {
  const esc = (s: string) => s.replace(/[^\x20-\x7e]/g, "?").replace(/([\\()])/g, "\\$1");
  const stream = ["BT", "/F1 11 Tf", "14 TL", "56 780 Td",
    ...lines.map((l, i) => (i === 0 ? `/F1 16 Tf (${esc(l)}) Tj /F1 11 Tf T* T*` : `(${esc(l)}) Tj T*`)), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out; // ASCII only, so string length = byte length for the xref offsets
}
