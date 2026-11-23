// Consultations, the care tab, chat and the video room. Mounted at /api.
//   GET    /schedule/available-slots?date=            patient: bookable times (doctor hidden)
//   GET    /schedule/slots/:doctorId/:date            public: one doctor's slots on a day
//   PUT    /schedule/book                             patient: { slotId, consultationType, reason }
//   PATCH  /appointments/:appointmentId/reschedule    patient: { slotId }
//   GET    /appointments/patient                      patient: their consultations
//   GET    /appointments/doctor[?date=]               doctor: their consultations
//   GET    /doctor/me                                 doctor: own profile
//   GET    /doctor/patients                           doctor: patients they treat
//   GET    /care-team                                 patient: the care-team doctor
//   GET    /care/prescription/current                 patient: latest signed prescription
//   GET    /care/medicine-orders                      patient: deliveries, newest first
//   GET    /care/cart                                 patient: the prescription's prefilled cart, or null
//   PATCH  /care/cart                                 patient: { lines?: [{ medicineId, quantity }], addressId? } within the prescription
//                                                     (checkout: POST /payments/orders { purpose: "MEDICINE_ORDER", referenceId: cartId })
//   POST   /chat/init                                 { doctorId } (patient) or { patientId } (doctor) -> { sessionId }
//   GET    /chat/sessions/:sessionId/messages?afterId= messages oldest first (polling: only id > afterId)
//   POST   /chat/sessions/:sessionId/messages         { messageText, messageType?, fileUrl? } -> the saved message
//   GET    /chat/doctor/sessions                      doctor: every patient chat
//   POST   /chat/sessions/:sessionId/read             doctor opened the chat
//   POST   /chat/sessions/:sessionId/no-reply-needed  doctor sets the waiting messages aside
//   DELETE /chat/sessions/:sessionId/no-reply-needed  undo
//   GET    /video/appointments/:appointmentId/join    { joinLink, role }
//   POST   /video/appointments/:appointmentId/end     doctor ends the call; the consultation is complete
import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "../lib/db.ts";
import { body, fail, intParam, ok, todayIST } from "../lib/http.ts";
import { type AuthUser, requireDoctor, requirePatient, requireUser } from "../lib/auth.ts";
import { setEligibility } from "../lib/eligibility.ts";
import { signedUrl } from "../lib/storage.ts";
import { priceCart, type CartLine } from "../lib/pharmacy.ts";
import { bookAppointment } from "../lib/booking.ts";
import { joinIfFirst } from "../lib/careTeam.ts";
import * as notices from "../lib/notices.ts";
import { sendNow } from "../lib/notify.ts";
import { createRoom, endRoom, hmsLive, joinLink, mockJoinLink } from "../integrations/hms.ts";

export const careRoutes = new Hono();

const BOOKING_DAYS_AHEAD = 60;
const URGENT_WORDS = /chest pain|breathless|can'?t breathe|faint|unconscious|vomit|severe|blood|suicid|emergency|seizure/i;

// ---------- helpers ----------

/** YYYY-MM-DD within today..today+60 (India time), else 400. */
function bookableDate(raw: string | undefined): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) fail(400, "Choose a valid date.");
  const today = todayIST();
  const last = new Date(Date.parse(today) + BOOKING_DAYS_AHEAD * 86400_000).toISOString().slice(0, 10);
  if (raw! < today || raw! > last) fail(400, `Choose a date within the next ${BOOKING_DAYS_AHEAD} days.`);
  return raw!;
}

/**
 * Frees lapsed checkout holds and creates `date`'s 30-minute slots: from each doctor's own weekly
 * hours (doctor_hours), or the default timetable (Mon to Sat, 10:00-13:00 and 15:00-19:00) for a
 * doctor who has set none. Days off get none. Slots that already exist (booked, held, blocked) are
 * left as they are; changing hours removes only open future slots (routes/doctor.ts).
 */
async function prepareSlots(date: string) {
  await sql`update doctor_slots set status = 'Available', held_by = null, held_until = null
            where status = 'Held' and held_until < now()`;
  await sql`
    insert into doctor_slots (doctor_id, slot_date, start_time, end_time)
    select d.id, ${date}::date, t::time, (t + interval '30 minutes')::time
    from doctors d
    cross join lateral (
      select generate_series(timestamp '2000-01-01' + h.start_time,
                             timestamp '2000-01-01' + h.end_time - interval '30 minutes', interval '30 minutes') as t
      from doctor_hours h where h.doctor_id = d.id and h.weekday = extract(isodow from ${date}::date)
      union all
      select generate_series(timestamp '2000-01-01 10:00', timestamp '2000-01-01 12:30', interval '30 minutes')
      where not exists (select 1 from doctor_hours h where h.doctor_id = d.id) and extract(isodow from ${date}::date) < 7
      union all
      select generate_series(timestamp '2000-01-01 15:00', timestamp '2000-01-01 18:30', interval '30 minutes')
      where not exists (select 1 from doctor_hours h where h.doctor_id = d.id) and extract(isodow from ${date}::date) < 7
    ) g
    where d.active
      and not exists (select 1 from doctor_days_off o where o.doctor_id = d.id and o.day = ${date}::date)
    on conflict do nothing`;
}

const iso = (col: string) => sql`to_char(${sql(col)} at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"')`;

// built per call: sql is bound to the request (lib/db.ts), never at module load
/** Appointment rows in the shape the app's toAppointment() reads (PascalCase). */
const appointmentSelect = () => sql`
  select a.id as "AppointmentId", a.doctor_id as "DoctorId", d.full_name as "DoctorName", d.photo_url as "DoctorPhoto",
    d.specialization as "Specialization", a.patient_id as "PatientId",
    coalesce(nullif(trim(concat_ws(' ', pp.first_name, pp.last_name)), ''), pu.full_name) as "PatientName",
    pp.first_name as "FirstName", pu.mobile as "PatientPhone", pp.age_years as "Age", pp.gender as "Gender",
    a.status as "Status", a.consultation_type as "ConsultationType", a.reason as "Reason",
    to_char(s.slot_date, 'YYYY-MM-DD') as "SlotDate", to_char(s.start_time, 'HH24:MI:SS') as "StartTime",
    to_char(s.end_time, 'HH24:MI:SS') as "EndTime", a.visit_type as "VisitType", a.visit_type as "visitType"
  from appointments a
  join doctors d on d.id = a.doctor_id
  join users pu on pu.id = a.patient_id
  left join patient_profiles pp on pp.user_id = a.patient_id
  left join doctor_slots s on s.id = a.slot_id`;

const doctorSummary = (d: Record<string, unknown>) => ({
  id: d.id, fullName: d.full_name, photoUrl: d.photo_url ?? null, specialization: d.specialization ?? "",
  qualifications: d.qualification ?? "", experience: d.experience ?? "", languages: d.languages ?? [],
  about: d.about ?? "", consultationFee: d.consultation_fee_rupees ?? null, rating: null,
});

/** The patient's care-team doctor id: the assigned one, else the doctor of their latest live booking. */
async function careTeamDoctorId(patientId: number): Promise<number | null> {
  const [row] = await sql`
    select coalesce(
      (select care_team_doctor_id from patient_profiles where user_id = ${patientId}),
      (select doctor_id from appointments where patient_id = ${patientId} and status <> 'Cancelled' order by created_at desc limit 1)
    ) as doctor_id`;
  return row?.doctor_id ?? null;
}

async function doctorTreats(doctorId: number, patientId: number): Promise<boolean> {
  const [row] = await sql`
    select 1 from appointments where doctor_id = ${doctorId} and patient_id = ${patientId} and status <> 'Cancelled'
    union all select 1 from care_team_doctors where patient_id = ${patientId} and doctor_id = ${doctorId}
    limit 1`;
  return Boolean(row);
}

const messageSelect = () => sql`
  select m.id, m.session_id as "sessionId", m.sender_user_id as "senderUserId", m.sender_role as "senderRole",
    m.message_type as "messageType", coalesce(m.message_text, '') as "messageText", m.file_url as "fileUrl",
    ${iso("m.sent_at")} as "sentAt"
  from chat_messages m`;

/** The chat session if the caller is its patient or doctor, else 403/400. */
async function sessionFor(c: Context, me: AuthUser) {
  const id = intParam(c.req.param("sessionId"), "chat");
  const [s] = await sql`select * from chat_sessions where id = ${id}`;
  if (!s) fail(400, "That chat does not exist.");
  if (s.patient_id !== me.id && s.doctor_id !== me.id && me.role !== "ADMIN") fail(403, "You do not have access to this chat.");
  return s;
}

/** The appointment if the caller is its patient or doctor. */
async function appointmentFor(c: Context, me: AuthUser) {
  const id = intParam(c.req.param("appointmentId"), "consultation");
  const [a] = await sql`select * from appointments where id = ${id}`;
  if (!a) fail(400, "That consultation does not exist.");
  if (a.patient_id !== me.id && a.doctor_id !== me.id) fail(403, "You do not have access to this consultation.");
  return a;
}

// ---------- schedule ----------

careRoutes.get("/schedule/available-slots", async (c) => {
  const me = await requirePatient(c);
  const date = bookableDate(c.req.query("date"));
  await prepareSlots(date);
  // before the patient has a doctor every doctor's times merge (one slot per start time); after, only their doctors'
  const team = sql`select doctor_id from care_team_doctors where patient_id = ${me.id}`;
  const rows = await sql`
    select distinct on (s.start_time) s.id as "SlotId", to_char(s.start_time, 'HH24:MI') as "StartTime",
      to_char(s.end_time, 'HH24:MI') as "EndTime", 'Available' as "Status"
    from doctor_slots s join doctors d on d.id = s.doctor_id and d.active
    where s.slot_date = ${date}::date
      and (s.status = 'Available' or (s.status = 'Held' and s.held_by = ${me.id}))
      and (s.slot_date + s.start_time) > (now() at time zone 'Asia/Kolkata')
      and (not exists (${team}) or s.doctor_id in (${team}))
    order by s.start_time, s.id`;
  return ok(c, rows);
});

careRoutes.get("/schedule/slots/:doctorId/:date", async (c) => {
  const doctorId = intParam(c.req.param("doctorId"), "doctor");
  const date = bookableDate(c.req.param("date"));
  await prepareSlots(date);
  const rows = await sql`
    select s.id as "SlotId", to_char(s.start_time, 'HH24:MI') as "StartTime", to_char(s.end_time, 'HH24:MI') as "EndTime",
      case when s.status = 'Available' then 'Available' else 'Booked' end as "Status"
    from doctor_slots s where s.doctor_id = ${doctorId} and s.slot_date = ${date}::date
    order by s.start_time`;
  return ok(c, rows);
});

careRoutes.put("/schedule/book", async (c) => {
  const me = await requirePatient(c);
  const input = await body<{ slotId?: unknown; consultationType?: string; reason?: string }>(c);
  const slotId = intParam(String(input.slotId ?? ""), "time");
  const { appointmentId, messages } = await sql.begin(async (tx) => {
    const [el] = await tx`select * from eligibility where user_id = ${me.id} for update`;
    if (el?.stage !== "APPROVED")
      fail(400, "You can book once your doctor has reviewed your blood test report.");
    const [{ count }] = await tx`select count(*)::int as count from appointments where patient_id = ${me.id} and status <> 'Cancelled'`;
    const first = count === 0;
    if (first && (!el.consultation_paid || el.consultation_used))
      fail(400, "Your first consultation needs to be paid for. Choose a time and continue to payment.");
    // ponytail: pilot lets follow-ups book without an active plan; require a Subscription here when plans go live
    const [other] = await tx`
      select 1 from doctor_slots s where s.id = ${slotId}
        and exists (select 1 from care_team_doctors t where t.patient_id = ${me.id})
        and s.doctor_id not in (select t.doctor_id from care_team_doctors t where t.patient_id = ${me.id})`;
    if (other) fail(400, "Choose one of your doctor's times.");
    const booked = await bookAppointment(tx, {
      patientId: me.id, slotId, reason: input.reason, consultationType: input.consultationType, prepaid: first,
    });
    if (first) await setEligibility(tx, me.id, { consultation_used: true });
    // the patient's confirmation and the doctor's notice on WhatsApp, both with the link to the room
    return { appointmentId: booked.appointmentId, messages: await notices.within(tx, (sp) => notices.appointmentBooked(sp, booked.appointmentId)) };
  });
  await sendNow(messages);
  return ok(c, { appointmentId }, "Consultation booked", { appointmentId });
});

careRoutes.patch("/appointments/:appointmentId/reschedule", async (c) => {
  const me = await requirePatient(c);
  const appointmentId = intParam(c.req.param("appointmentId"), "consultation");
  const slotId = intParam(String((await body(c)).slotId ?? ""), "time");
  const { row, messages } = await sql.begin(async (tx) => {
    const [a] = await tx`select * from appointments where id = ${appointmentId} for update`;
    if (!a || a.patient_id !== me.id) fail(400, "That consultation does not exist.");
    const [from] = await tx`select to_char(slot_date, 'YYYY-MM-DD') as "slotDate", to_char(start_time, 'HH24:MI') as "startTime"
                            from doctor_slots where id = ${a.slot_id}`;
    // a doctor opening the room early marks it InProgress; it is still movable until it ends
    if (a.status !== "Booked" && a.status !== "InProgress") fail(400, "Only a booked consultation can be moved.");
    const [slot] = await tx`select doctor_id from doctor_slots where id = ${slotId}`;
    if (!slot || slot.doctor_id !== a.doctor_id) fail(400, "Choose one of the same doctor's times.");
    const [taken] = await tx`
      update doctor_slots s set status = 'Booked', held_by = null, held_until = null
      where s.id = ${slotId} and (s.status = 'Available' or (s.status = 'Held' and (s.held_by = ${me.id} or s.held_until < now())))
        and (s.slot_date + s.start_time) > (now() at time zone 'Asia/Kolkata')
      returning s.id`;
    if (!taken) fail(409, "That time was just booked. Choose another.");
    if (a.slot_id) await tx`update doctor_slots set status = 'Available' where id = ${a.slot_id}`;
    await tx`update appointments set slot_id = ${slotId}, status = 'Booked', started_at = null, patient_joined_at = null,
             doctor_joined_at = null where id = ${appointmentId}`;
    const [out] = await tx`
      select a.id as "AppointmentId", a.doctor_id as "DoctorId", to_char(s.slot_date, 'YYYY-MM-DD') as "SlotDate",
        to_char(s.start_time, 'HH24:MI:SS') as "StartTime", to_char(s.end_time, 'HH24:MI:SS') as "EndTime", a.status as "Status"
      from appointments a join doctor_slots s on s.id = a.slot_id where a.id = ${appointmentId}`;
    // both hear the new time; the old time's reminders lapse on their own (the slot changed)
    const moved = from as { slotDate: string; startTime: string } | undefined;
    return { row: out, messages: moved ? await notices.within(tx, (sp) => notices.appointmentMoved(sp, appointmentId, moved)) : [] };
  });
  await sendNow(messages);
  return ok(c, row, "Appointment moved");
});

// ---------- appointment lists and doctor basics ----------

careRoutes.get("/appointments/patient", async (c) => {
  const me = await requirePatient(c);
  const rows = await sql`${appointmentSelect()} where a.patient_id = ${me.id} order by s.slot_date, s.start_time`;
  return ok(c, rows);
});

careRoutes.get("/appointments/doctor", async (c) => {
  const me = await requireDoctor(c);
  const date = c.req.query("date");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(400, "Choose a valid date.");
  const rows = await sql`
    ${appointmentSelect()} where a.doctor_id = ${me.id} and (${date ?? null}::date is null or s.slot_date = ${date ?? null}::date)
    order by s.slot_date, s.start_time`;
  return ok(c, rows);
});

careRoutes.get("/doctor/me", async (c) => {
  const me = await requireDoctor(c);
  const [d] = await sql`select * from doctors where id = ${me.id}`;
  if (!d) fail(400, "Your doctor profile is not set up yet. Ask the InRange team.");
  return ok(c, {
    id: d.id, fullName: d.full_name, specialization: d.specialization ?? "", photoUrl: d.photo_url ?? null,
    qualification: d.qualification ?? "", registrationNo: d.registration_no ?? "", experience: d.experience ?? "",
    languages: d.languages ?? [], about: d.about ?? "", mobile: me.mobile,
  });
});

careRoutes.get("/doctor/patients", async (c) => {
  const me = await requireDoctor(c);
  const rows = await sql`
    select u.id, coalesce(nullif(trim(concat_ws(' ', pp.first_name, pp.last_name)), ''), u.full_name, 'Patient') as "fullName",
      pp.age_years as age, pp.gender, u.mobile
    from users u left join patient_profiles pp on pp.user_id = u.id
    where u.id in (
      select patient_id from appointments where doctor_id = ${me.id} and status <> 'Cancelled'
      union select patient_id from chat_sessions where doctor_id = ${me.id}
      union select patient_id from care_team_doctors where doctor_id = ${me.id})
    order by 2`;
  return ok(c, rows);
});

// ---------- care tab ----------

careRoutes.get("/care-team", async (c) => {
  const me = await requirePatient(c);
  const doctorId = await careTeamDoctorId(me.id);
  if (!doctorId) return ok(c, { doctor: null });
  const [d] = await sql`select * from doctors where id = ${doctorId}`;
  return ok(c, { doctor: d ? doctorSummary(d) : null });
});

careRoutes.get("/care/prescription/current", async (c) => {
  const me = await requirePatient(c);
  const [p] = await sql`
    select p.*, d.full_name, d.qualification, d.registration_no, ${iso("p.signed_at")} as signed_iso
    from prescriptions p join doctors d on d.id = p.doctor_id
    where p.patient_id = ${me.id} and p.status = 'SIGNED' order by p.signed_at desc limit 1`;
  if (!p) return ok(c, null);
  return ok(c, {
    id: String(p.id), doctorName: p.full_name, doctorQualification: p.qualification ?? "",
    doctorRegistrationNo: p.registration_no ?? "", signedAt: p.signed_iso, version: p.version,
    pdf: p.pdf_path ? `/api/files/prescriptions/${p.id}` : null,
    // ponytail: the signed link stays until the web app that opens `pdf` is live; then delete it
    pdfUrl: await signedUrl("prescriptions", p.pdf_path),
    items: (p.items ?? []).map((i: Record<string, unknown>) => ({
      medicineName: i.medicineName ?? "", strength: i.strength ?? "", dose: i.dose ?? "", frequency: i.frequency ?? "",
      route: i.route ?? "", instructions: i.instructions ?? "", reason: i.reason ?? "", genericName: i.genericName ?? null,
    })),
  });
});

careRoutes.get("/care/medicine-orders", async (c) => {
  const me = await requirePatient(c);
  const rows = await sql`
    select id::text as id, 'MED-' || lpad(id::text, 5, '0') as "orderNumber", status,
      ${iso("placed_at")} as "placedAt", ${iso("expected_at")} as "expectedAt",
      ${iso("dispatched_at")} as "dispatchedAt", ${iso("delivered_at")} as "deliveredAt",
      courier, tracking_no as "trackingNo", tracking_url as "trackingUrl", items, history,
      feedback, cancel_reason as "cancelReason", refunded_paise as "refundedPaise",
      case when supply_days is not null and delivered_at is not null
        then to_char((delivered_at + make_interval(days => supply_days)) at time zone 'Asia/Kolkata', 'YYYY-MM-DD') end as "runOutOn",
      -- a delivered order can be rated for two weeks
      (status = 'DELIVERED' and feedback is null and delivered_at > now() - interval '14 days') as "canGiveFeedback"
    from medicine_orders where patient_id = ${me.id} order by placed_at desc`;
  return ok(c, rows);
});

// ---------- chat ----------

careRoutes.post("/chat/init", async (c) => {
  const me = await requireUser(c, "PATIENT", "DOCTOR");
  const input = await body<{ doctorId?: unknown; patientId?: unknown }>(c);
  let patientId: number, doctorId: number;
  if (me.role === "DOCTOR") {
    doctorId = me.id;
    patientId = intParam(String(input.patientId ?? ""), "patient");
  } else {
    patientId = me.id;
    doctorId = intParam(String(input.doctorId ?? ""), "doctor");
  }
  if (!(await doctorTreats(doctorId, patientId)))
    fail(400, me.role === "DOCTOR" ? "You can message patients you treat." : "You can message your doctor once you have booked a consultation.");
  const [s] = await sql`
    insert into chat_sessions (patient_id, doctor_id) values (${patientId}, ${doctorId})
    on conflict (patient_id, doctor_id) do update set patient_id = excluded.patient_id returning id`;
  return ok(c, { sessionId: s.id }, "Chat ready", { sessionId: s.id });
});

careRoutes.get("/chat/sessions/:sessionId/messages", async (c) => {
  const me = await requireUser(c);
  const s = await sessionFor(c, me);
  const afterId = Math.max(0, Number(c.req.query("afterId") ?? 0) || 0);
  const rows = await sql`${messageSelect()} where m.session_id = ${s.id} and m.id > ${afterId} order by m.id limit 500`;
  return ok(c, rows);
});

careRoutes.post("/chat/sessions/:sessionId/messages", async (c) => {
  const me = await requireUser(c, "PATIENT", "DOCTOR");
  const s = await sessionFor(c, me);
  const input = await body<{ messageText?: unknown; messageType?: unknown; fileUrl?: unknown }>(c);
  const text = String(input.messageText ?? "").trim();
  const fileUrl = typeof input.fileUrl === "string" && /^https:\/\//.test(input.fileUrl) ? input.fileUrl : null;
  if (!text && !fileUrl) fail(400, "Write a message first.");
  if (text.length > 4000) fail(400, "That message is too long. Keep it under 4,000 characters.");
  const role = me.id === s.doctor_id ? "DOCTOR" : "PATIENT";
  const [m] = await sql`
    insert into chat_messages (session_id, sender_user_id, sender_role, message_type, message_text, file_url)
    values (${s.id}, ${me.id}, ${role}, ${fileUrl ? "FILE" : "TEXT"}, ${text || null}, ${fileUrl})
    returning id`;
  if (role === "DOCTOR") await sql`update chat_sessions set doctor_last_read_at = now() where id = ${s.id}`;
  // the other side hears there is a message (never what it says), at most once an hour
  await notices.chatMessage(s as { id: number; patient_id: number; doctor_id: number }, role).then(sendNow).catch((e) => console.error("chat notice", (e as Error).message));
  const [row] = await sql`${messageSelect()} where m.id = ${m.id}`;
  return ok(c, row, "Sent");
});

careRoutes.get("/chat/doctor/sessions", async (c) => {
  const me = await requireDoctor(c);
  const sessions = await sql`
    select cs.id, cs.patient_id, cs.doctor_last_read_at, cs.no_reply_needed_at,
      coalesce(nullif(trim(concat_ws(' ', pp.first_name, pp.last_name)), ''), u.full_name, 'Patient') as patient_name,
      last.message_text as last_text, last.file_url as last_file, last.sender_role as last_role,
      ${iso("last.sent_at")} as last_sent_at, last.sent_at as last_sent_raw,
      (select max(sent_at) from chat_messages where session_id = cs.id and sender_role = 'DOCTOR') as last_doctor_at
    from chat_sessions cs
    join users u on u.id = cs.patient_id
    left join patient_profiles pp on pp.user_id = cs.patient_id
    left join lateral (select * from chat_messages where session_id = cs.id order by id desc limit 1) last on true
    where cs.doctor_id = ${me.id}
    order by last.sent_at desc nulls last`;
  const out = [];
  for (const s of sessions) {
    // the patient's messages since the doctor last replied (and since "no reply needed"), oldest first
    const marks = [s.last_doctor_at, s.no_reply_needed_at].filter(Boolean).map((d: Date) => new Date(d).getTime());
    const since = marks.length ? new Date(Math.max(...marks)) : null;
    const waiting = await sql`
      select message_text, ${iso("sent_at")} as at from chat_messages
      where session_id = ${s.id} and sender_role = 'PATIENT' and (${since}::timestamptz is null or sent_at > ${since}::timestamptz)
      order by id`;
    out.push({
      sessionId: s.id,
      patientId: String(s.patient_id),
      patientName: s.patient_name,
      lastMessage: s.last_sent_at
        ? { text: s.last_text ?? "", fromDoctor: s.last_role === "DOCTOR", sentAt: s.last_sent_at, hasFile: Boolean(s.last_file) }
        : null,
      waitingSince: waiting[0]?.at ?? null,
      urgent: waiting.some((w) => URGENT_WORDS.test(w.message_text ?? "")),
      unread: s.last_role === "PATIENT" && (!s.doctor_last_read_at || s.last_sent_raw > s.doctor_last_read_at),
    });
  }
  return ok(c, out);
});

careRoutes.post("/chat/sessions/:sessionId/read", async (c) => {
  const me = await requireDoctor(c);
  const s = await sessionFor(c, me);
  await sql`update chat_sessions set doctor_last_read_at = now() where id = ${s.id}`;
  return ok(c, null, "Marked read");
});

careRoutes.post("/chat/sessions/:sessionId/no-reply-needed", async (c) => {
  const me = await requireDoctor(c);
  const s = await sessionFor(c, me);
  await sql`update chat_sessions set no_reply_needed_at = now(), doctor_last_read_at = now() where id = ${s.id}`;
  return ok(c, null, "Set aside");
});

careRoutes.delete("/chat/sessions/:sessionId/no-reply-needed", async (c) => {
  const me = await requireDoctor(c);
  const s = await sessionFor(c, me);
  await sql`update chat_sessions set no_reply_needed_at = null where id = ${s.id}`;
  return ok(c, null, "Undone");
});

// ---------- video ----------

careRoutes.get("/video/appointments/:appointmentId/join", async (c) => {
  const me = await requireUser(c, "PATIENT", "DOCTOR");
  const a = await appointmentFor(c, me);
  if (a.status === "Cancelled") fail(400, "This consultation was cancelled.");
  if (a.status === "Completed") fail(400, "This consultation has ended.");
  const role = me.id === a.doctor_id ? "doctor" : "patient";
  const [who] = role === "doctor"
    ? await sql`select full_name as name from doctors where id = ${me.id}`
    : await sql`select coalesce(nullif(trim(concat_ws(' ', pp.first_name, pp.last_name)), ''), u.full_name, 'Patient') as name
                from users u left join patient_profiles pp on pp.user_id = u.id where u.id = ${me.id}`;
  const name = who?.name ?? "";
  let link = mockJoinLink(a.id, role, name);
  if (hmsLive()) {
    try {
      // two people joining at once land in one room: the first room stored wins
      const roomId = a.video_room_id ?? (await sql`
        update appointments set video_room_id = coalesce(video_room_id, ${await createRoom(a.id)})
        where id = ${a.id} returning video_room_id`)[0].video_room_id;
      link = await joinLink(roomId, role, name, me.id);
    } catch (e) {
      console.error("100ms join", a.id, e);
      fail(502, "The video room could not be opened. Please try again in a moment.");
    }
  }
  // each join is stamped; from a quarter of an hour before the start, the other side hears it on WhatsApp
  // if they are not in the room yet (once: the message is keyed on the slot). An early look says nothing.
  const [seen] = await sql`
    update appointments a set
      status = case when ${role} = 'doctor' and a.status = 'Booked' then 'InProgress' else a.status end,
      started_at = case when ${role} = 'doctor' and a.status = 'Booked' then coalesce(a.started_at, now()) else a.started_at end,
      doctor_joined_at = case when ${role} = 'doctor' then now() else a.doctor_joined_at end,
      patient_joined_at = case when ${role} = 'patient' then now() else a.patient_joined_at end
    where a.id = ${a.id}
    returning (select (s.slot_date + s.start_time) at time zone 'Asia/Kolkata' - interval '15 minutes'
               from doctor_slots s where s.id = a.slot_id) as window_opens, a.doctor_joined_at, a.patient_joined_at`;
  if (seen?.window_opens && new Date(seen.window_opens) <= new Date()) {
    const other = role === "doctor" ? seen.patient_joined_at : seen.doctor_joined_at;
    if (!other || new Date(other) < new Date(seen.window_opens))
      await notices.joined(a.id, role).then(sendNow).catch((e) => console.error("join notice", (e as Error).message));
  }
  return ok(c, { joinLink: link, role });
});

careRoutes.post("/video/appointments/:appointmentId/end", async (c) => {
  const me = await requireDoctor(c);
  const a = await appointmentFor(c, me);
  if (a.doctor_id !== me.id) fail(403, "Only the consultation's doctor can end it.");
  await sql.begin(async (tx) => {
    await tx`update appointments set status = 'Completed', ended_at = coalesce(ended_at, now()) where id = ${a.id}`;
    await joinIfFirst(tx, a.patient_id, a.doctor_id);
  });
  await endRoom(a.video_room_id);
  // the note to sign: a reminder an hour later, unless it is signed by then
  await notices.callEnded(a.id).catch((e) => console.error("note notice", (e as Error).message));
  return ok(c, null, "Consultation ended");
});

// ---------- the medicine cart ----------

const addressLine = (a: Record<string, unknown>) =>
  [a.line1, a.line2, a.landmark, a.city, a.pincode].filter(Boolean).join(", ");

/** The patient's open cart as the cart page shows it (customer prices only), or null. */
async function cartView(patientId: number) {
  const [k] = await sql`
    select k.*, p.months, ${iso("p.valid_until")} as valid_iso, p.valid_until
    from medicine_carts k join prescriptions p on p.id = k.prescription_id
    where k.patient_id = ${patientId} and k.status = 'OPEN' order by k.id desc limit 1`;
  if (!k || (k.valid_until && new Date(k.valid_until) <= new Date())) return null;
  const [priced, [address]] = await Promise.all([
    priceCart(sql, k as never),
    sql`select * from addresses where user_id = ${patientId}
        order by (id = ${k.address_id ?? 0}) desc, is_default desc, id desc limit 1`,
  ]);
  return {
    id: String(k.id), prescriptionId: String(k.prescription_id), months: k.months, validUntil: k.valid_iso, ...priced,
    // a refill is the next supply on the same prescription (lib/medicineFlow.ts checkRefills)
    kind: k.kind, boughtElsewhere: Boolean(k.elsewhere_at),
    address: address ? { id: String(address.id), label: address.label, name: address.full_name ?? "", line: addressLine(address) } : null,
  };
}

careRoutes.get("/care/cart", async (c) => {
  const me = await requirePatient(c);
  return ok(c, await cartView(me.id));
});

careRoutes.patch("/care/cart", async (c) => {
  const me = await requirePatient(c);
  const input = await body<{ lines?: { medicineId?: unknown; quantity?: unknown }[]; addressId?: unknown }>(c);
  const [k] = await sql`
    select k.* from medicine_carts k join prescriptions p on p.id = k.prescription_id
    where k.patient_id = ${me.id} and k.status = 'OPEN'
      and (p.valid_until is null or p.valid_until > now()) order by k.id desc limit 1`;
  if (!k) fail(404, "There is no cart to change.");
  let lines = k.lines as CartLine[];
  if (Array.isArray(input.lines)) {
    const asked = new Map(input.lines.map((l) => [Number(l.medicineId), Number(l.quantity)]));
    lines = lines.map((l) => {
      if (!asked.has(l.medicineId)) return l;
      const q = asked.get(l.medicineId)!;
      // only within the prescription: never more than prescribed, never an item it does not name
      if (!Number.isInteger(q) || q < 0 || q > l.prescribed) fail(400, "That quantity is more than your doctor prescribed.");
      return { ...l, quantity: q };
    });
  }
  let addressId = k.address_id;
  if (input.addressId != null) {
    const [a] = await sql`select id from addresses where id = ${Number(input.addressId) || 0} and user_id = ${me.id}`;
    if (!a) fail(400, "That address was not found.");
    addressId = a.id;
  }
  await sql`update medicine_carts set lines = ${sql.json(lines)}, address_id = ${addressId} where id = ${k.id}`;
  return ok(c, await cartView(me.id), "Saved");
});
