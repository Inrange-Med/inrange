// The InRange team's admin area. Mounted at /api. Every route: role ADMIN.
//   GET   /admin/reviews                      waiting eligibility reviews (oldest first) and the last 20 decided
//   POST  /admin/reviews/:patientId           { decision: "APPROVED" | "NOT_APPROVED", note? }
//   GET   /admin/doctors                      every doctor, with their mobile, status and hours
//   POST  /admin/doctors                      { mobile, fullName, specialization, qualification, registrationNo,
//                                               experience?, languages?, about?, consultationFeeRupees? }
//   PATCH /admin/doctors/:doctorId            any of the fields above except mobile, and { active }
// A doctor's hours are set by the doctor (routes/availability.ts; an admin may pass ?doctorId=).
import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "../lib/db.ts";
import { body, fail, intParam, ok, todayIST } from "../lib/http.ts";
import { requireUser } from "../lib/auth.ts";
import { setEligibility } from "../lib/eligibility.ts";
import { signedUrl } from "../lib/storage.ts";

export const adminRoutes = new Hono();

const requireAdmin = async (c: Context) => {
  const me = await requireUser(c, "ADMIN");
  if (me.role !== "ADMIN") fail(403, "You do not have access to this.");
  return me;
};

const ist = (d: unknown): string | null =>
  d ? new Date(new Date(d as string).getTime() + 19_800_000).toISOString().slice(0, 19) + "+05:30" : null;

// ---------- eligibility reviews ----------

adminRoutes.get("/admin/reviews", async (c) => {
  await requireAdmin(c);
  const rows = await sql`
    select e.user_id, e.path, e.stage, e.review_note, e.lab_booking_id, e.updated_at, e.reviewed_at,
      u.mobile, coalesce(nullif(trim(concat_ws(' ', pp.first_name, pp.last_name)), ''), u.full_name) as name,
      pp.age_years, pp.gender, rv.full_name as reviewed_by_name
    from eligibility e join users u on u.id = e.user_id
    left join patient_profiles pp on pp.user_id = e.user_id
    left join users rv on rv.id = e.reviewed_by
    where e.stage = 'UNDER_REVIEW' or (e.stage in ('APPROVED', 'NOT_APPROVED') and e.reviewed_at is not null)
    order by case when e.stage = 'UNDER_REVIEW' then 0 else 1 end,
      case when e.stage = 'UNDER_REVIEW' then e.updated_at end asc, e.reviewed_at desc
    limit 120`;
  const ids = rows.map((r) => r.user_id);
  const reports = ids.length ? await sql`
    select r.id, r.user_id, r.title, r.file_name, r.file_path, r.source, r.lab_booking_id, r.uploaded_at
    from reports r join eligibility e on e.user_id = r.user_id
    where r.user_id in ${sql(ids)} and (r.purpose = 'ELIGIBILITY' or (r.lab_booking_id is not null and r.lab_booking_id = e.lab_booking_id))
    order by r.uploaded_at desc` : [];
  const toReview = (r: Record<string, unknown>) => ({
    patientId: r.user_id, name: r.name ?? "", mobile: r.mobile, age: r.age_years ?? null, gender: r.gender ?? null,
    path: r.path, stage: r.stage, note: r.review_note ?? null, labBookingId: r.lab_booking_id ?? null,
    waitingSince: ist(r.updated_at), decidedAt: ist(r.reviewed_at), decidedBy: r.reviewed_by_name ?? null,
  });
  const withReports = await Promise.all(rows.map(async (r) => ({
    ...toReview(r),
    reports: await Promise.all(reports.filter((x) => x.user_id === r.user_id).slice(0, 3).map(async (x) => ({
      id: x.id, title: x.title ?? x.file_name ?? "Report", source: x.source, uploadedAt: ist(x.uploaded_at),
      url: await signedUrl("reports", x.file_path),
    }))),
  })));
  return ok(c, {
    waiting: withReports.filter((r) => r.stage === "UNDER_REVIEW"),
    decided: withReports.filter((r) => r.stage !== "UNDER_REVIEW").slice(0, 20),
  });
});

adminRoutes.post("/admin/reviews/:patientId", async (c) => {
  const me = await requireAdmin(c);
  const patientId = intParam(c.req.param("patientId"), "patient");
  const input = await body<{ decision?: string; note?: string }>(c);
  const decision = input.decision === "APPROVED" || input.decision === "NOT_APPROVED" ? input.decision : null;
  if (!decision) fail(400, "Choose Approve or Not approved.");
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) : "";
  if (decision === "NOT_APPROVED" && !note) fail(400, "Add a short note for the patient on what happens next.");
  const [e] = await sql`select stage from eligibility where user_id = ${patientId}`;
  if (!e || !["UNDER_REVIEW", "APPROVED", "NOT_APPROVED"].includes(e.stage)) fail(409, "This patient has nothing to review yet.");
  await sql.begin(async (tx) => {
    await setEligibility(tx, patientId, { stage: decision!, review_note: note || null });
    await tx`update eligibility set reviewed_by = ${me.id}, reviewed_at = now() where user_id = ${patientId}`;
    // the patient's Reports tab shows the decision on the reports it was made from
    await tx`update reports r set review_status = ${decision!}, review_note = ${note || null}
      from eligibility e where e.user_id = ${patientId} and r.user_id = e.user_id
        and (r.purpose = 'ELIGIBILITY' or (r.lab_booking_id is not null and r.lab_booking_id = e.lab_booking_id))`;
  });
  return ok(c, null, decision === "APPROVED" ? "Approved" : "Marked not approved");
});

// ---------- doctors ----------

type DoctorInput = Partial<{
  mobile: string; fullName: string; specialization: string; qualification: string; registrationNo: string;
  experience: string; languages: string[]; about: string; consultationFeeRupees: number | null; active: boolean;
}>;

const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

function doctorFields(input: DoctorInput, creating: boolean) {
  const f = {
    full_name: text(input.fullName, 120),
    specialization: text(input.specialization, 120),
    qualification: text(input.qualification, 200),
    registration_no: text(input.registrationNo, 60),
    experience: text(input.experience, 60),
    about: text(input.about, 1000),
    languages: Array.isArray(input.languages) ? input.languages.map((l) => String(l).trim()).filter(Boolean).slice(0, 8) : undefined,
    consultation_fee_rupees: input.consultationFeeRupees === null ? null
      : input.consultationFeeRupees === undefined ? undefined : Number(input.consultationFeeRupees),
    active: typeof input.active === "boolean" ? input.active : undefined,
  };
  if (f.consultation_fee_rupees != null && (!Number.isInteger(f.consultation_fee_rupees) || f.consultation_fee_rupees < 0))
    fail(400, "The fee is a whole number of rupees.");
  if (creating) {
    if (!f.full_name) fail(400, "Add the doctor's full name.");
    if (!f.registration_no) fail(400, "Add the medical council registration number.");
    if (!f.specialization) fail(400, "Add the specialisation.");
  }
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined));
}

const doctorSelect = () => sql`
  select d.id, u.mobile, d.full_name, d.specialization, d.qualification, d.registration_no, d.experience,
    d.languages, d.about, d.consultation_fee_rupees, d.active,
    not exists (select 1 from doctor_hours h where h.doctor_id = d.id) as uses_default_hours,
    (select count(*)::int from appointments a join doctor_slots s on s.id = a.slot_id
      where a.doctor_id = d.id and a.status in ('Booked', 'InProgress') and s.slot_date >= ${todayIST()}::date) as upcoming
  from doctors d join users u on u.id = d.id`;

const toDoctor = (d: Record<string, unknown>) => ({
  id: d.id, mobile: d.mobile, fullName: d.full_name, specialization: d.specialization ?? "",
  qualification: d.qualification ?? "", registrationNo: d.registration_no ?? "", experience: d.experience ?? "",
  languages: d.languages ?? [], about: d.about ?? "", consultationFeeRupees: d.consultation_fee_rupees ?? null,
  active: d.active, usesDefaultHours: d.uses_default_hours, upcomingConsultations: d.upcoming,
});

adminRoutes.get("/admin/doctors", async (c) => {
  await requireAdmin(c);
  const rows = await sql`${doctorSelect()} order by d.active desc, d.full_name`;
  return ok(c, rows.map(toDoctor));
});

adminRoutes.post("/admin/doctors", async (c) => {
  await requireAdmin(c);
  const input = await body<DoctorInput>(c);
  const mobile = String(input.mobile ?? "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  if (!/^[6-9]\d{9}$/.test(mobile)) fail(400, "Enter the doctor's 10-digit mobile number.");
  const fields = doctorFields(input, true);
  const id = await sql.begin(async (tx) => {
    const [existing] = await tx`
      select u.id, u.role, exists (select 1 from patient_profiles p where p.user_id = u.id) as has_profile
      from users u where u.mobile = ${mobile} for update`;
    if (existing?.role === "ADMIN") fail(409, "This number belongs to an admin.");
    if (existing?.role === "DOCTOR") fail(409, "This number is already a doctor.");
    if (existing?.has_profile) fail(409, "This number already belongs to a patient. Use another number for the doctor.");
    const [u] = existing
      ? await tx`update users set role = 'DOCTOR', full_name = ${fields.full_name as string}, onboarding_completed = true
                 where id = ${existing.id} returning id`
      : await tx`insert into users (mobile, role, full_name, onboarding_completed)
                 values (${mobile}, 'DOCTOR', ${fields.full_name as string}, true) returning id`;
    await tx`insert into doctors ${tx({ id: u.id, ...fields })}`;
    return u.id as number;
  });
  const [d] = await sql`${doctorSelect()} where d.id = ${id}`;
  return ok(c, toDoctor(d), "Doctor added");
});

adminRoutes.patch("/admin/doctors/:doctorId", async (c) => {
  await requireAdmin(c);
  const id = intParam(c.req.param("doctorId"), "doctor");
  const fields = doctorFields(await body<DoctorInput>(c), false);
  const [exists] = await sql`select id from doctors where id = ${id}`;
  if (!exists) fail(404, "That doctor was not found.");
  if (Object.keys(fields).length) {
    await sql`update doctors set ${sql(fields)} where id = ${id}`;
    if (fields.full_name) await sql`update users set full_name = ${fields.full_name as string} where id = ${id}`;
    // a doctor taken off the rota keeps their booked consultations; their open times go
    if (fields.active === false)
      await sql`delete from doctor_slots where doctor_id = ${id} and status = 'Available' and slot_date >= ${todayIST()}::date`;
  }
  const [d] = await sql`${doctorSelect()} where d.id = ${id}`;
  return ok(c, toDoctor(d), "Saved");
});
