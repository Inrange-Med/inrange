// The patient's own data: onboarding, profile, weight log, eligibility, plans, care packages,
// reports and saved addresses. Mounted at /api. Shapes follow src/services/* in the web app.
//   GET    /onboarding/config        GET /onboarding/status
//   PATCH  /onboarding/step          POST /onboarding/complete
//   GET    /patient/profile          PATCH /patient/profile | /patient/health-profile | /patient/reminders | /patient/privacy
//   POST   /patient/support
//   GET    /trackers/weight          POST /trackers/weight          DELETE /trackers/weight/:id
//   GET    /eligibility
//   GET    /subscriptions/plans (no auth)   GET /subscriptions/status   GET /subscriptions/recommended
//   GET    /care-packages
//   GET    /reports                  POST /reports (multipart)
//   GET    /address/my-addresses     POST /address/add              DELETE /address/:addressId
import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "../lib/db.ts";
import { body, fail, intParam, ok, todayIST } from "../lib/http.ts";
import { requirePatient } from "../lib/auth.ts";
import { setEligibility } from "../lib/eligibility.ts";
import { signedUrl, uploadFile } from "../lib/storage.ts";

export const patientRoutes = new Hono();

// ---------- onboarding ----------

const CONSENT_VERSION = "2026-09";
const REQUIRED_CONSENTS = ["TERMS", "PRIVACY", "HEALTH_DATA", "TELECONSULT"];
const EXPERIENCES = [
  { code: "FIRST_TIME", label: "This is my first real attempt" },
  { code: "SELF_DIET", label: "Diet and exercise on my own" },
  { code: "PROGRAMME", label: "A dietitian, gym programme or app" },
  { code: "DOCTOR_MEDS", label: "Medicine prescribed by a doctor" },
  { code: "SURGERY", label: "Weight-loss surgery" },
];
const CONDITIONS = [
  { code: "T2D", label: "Type 2 diabetes" },
  { code: "PREDIABETES", label: "Prediabetes" },
  { code: "BP", label: "High blood pressure" },
  { code: "PCOS", label: "PCOS" },
  { code: "THYROID", label: "Thyroid condition" },
  { code: "FATTY_LIVER", label: "Fatty liver" },
  { code: "LIPIDS", label: "High cholesterol" },
  { code: "SLEEP_APNOEA", label: "Sleep apnoea" },
  { code: "HEART", label: "Heart disease" },
  { code: "KIDNEY", label: "Kidney disease" },
  { code: "OTHER", label: "Something else" },
];
const CONSENTS = [
  { type: "TERMS", title: "Terms of service", line: "How InRange works, what it costs and how to cancel.",
    more: "You are 18 or over and the details you give are yours and true. Plans are paid only after your doctor's review, with an itemised price before you pay.", required: true },
  { type: "PRIVACY", title: "Privacy notice", line: "What we collect, why, and how to delete it.",
    more: "The full notice lists what we collect, why and who can see it. You can ask for a copy, a correction or deletion at any time, and complain to the Data Protection Board of India.", required: true },
  { type: "HEALTH_DATA", title: "Use of my health details", line: "Your doctor and care team read your answers and readings.",
    more: "Only the people treating you can see your health details. Every time a doctor opens your record, it is logged.", required: true },
  { type: "TELECONSULT", title: "Consultation by video", line: "Under India's Telemedicine Practice Guidelines 2020.",
    more: "Your doctor may decide a video consultation is not enough and ask you to see someone in person. InRange is not for emergencies: call 112.", required: true },
  { type: "AI", title: "Call transcription", line: "An AI scribe drafts your doctor's notes from your video calls.",
    more: "If you agree, your video calls are transcribed so an AI scribe can draft the notes. Your doctor reads, corrects and signs every note, and nothing reaches your record without them. If you say no, nothing about your care changes: your doctor writes the notes themselves.", required: false },
];
const CONSENT_TYPES = CONSENTS.map((c) => c.type);
const EXPERIENCE_CODES = EXPERIENCES.map((e) => e.code);
const CONDITION_CODES = CONDITIONS.map((c) => c.code);
const GENDERS = ["Male", "Female", "Other"];

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const num = (v: unknown) => (v === null || v === undefined || v === "" ? NaN : Number(v));
const tenth = (v: number) => Math.round(v * 10) / 10;

function check(cond: boolean, message: string) {
  if (!cond) fail(400, message);
}
const checkAge = (a: number) => check(Number.isInteger(a) && a >= 18 && a <= 90, "Enter an age between 18 and 90.");
const checkHeight = (h: number) => check(Number.isFinite(h) && h >= 120 && h <= 220, "Enter a height between 120 and 220 cm.");
const checkWeight = (w: number) => check(Number.isFinite(w) && w >= 30 && w <= 250, "Enter a weight between 30 and 250 kg.");
function genderOf(v: unknown): string {
  const g = GENDERS.find((x) => x.toLowerCase() === String(v ?? "").toLowerCase());
  check(Boolean(g), "Choose Male, Female or Other.");
  return g!;
}

async function ensureProfile(userId: number) {
  await sql`insert into patient_profiles (user_id) values (${userId}) on conflict (user_id) do nothing`;
}

async function activeConsents(userId: number) {
  return await sql`select consent_type, version from consents where user_id = ${userId} and revoked_at is null`;
}

patientRoutes.get("/onboarding/config", async (c) => {
  await requirePatient(c);
  return ok(c, {
    consentVersion: CONSENT_VERSION,
    genders: GENDERS.map((g) => ({ code: g, label: g })),
    experiences: EXPERIENCES,
    conditions: CONDITIONS,
    consents: CONSENTS,
  });
});

patientRoutes.get("/onboarding/status", async (c) => {
  const me = await requirePatient(c);
  const [u] = await sql`select full_name, email, onboarding_completed from users where id = ${me.id}`;
  const [p] = await sql`select * from patient_profiles where user_id = ${me.id}`;
  const consents = await activeConsents(me.id);
  const answers = {
    firstName: p?.first_name ?? undefined,
    lastName: p?.last_name ?? undefined,
    fullName: u.full_name ?? "",
    email: u.email ?? "",
    gender: p?.gender ?? null,
    ageYears: p?.age_years ?? null,
    heightCm: p?.height_cm ?? null,
    weightKg: p?.weight_kg ?? null,
    weightLossExperience: p?.weight_loss_experience ?? [],
    conditions: p?.conditions ?? null,
    noConditions: Boolean(p?.no_conditions),
    consents: consents.map((x) => ({ type: x.consent_type, version: x.version, accepted: true })),
  };
  const answered = [
    Boolean(p?.first_name), Boolean(p?.gender), p?.age_years != null, p?.height_cm != null,
    p?.weight_kg != null, (p?.weight_loss_experience ?? []).length > 0, p?.conditions != null,
    REQUIRED_CONSENTS.every((t) => consents.some((x) => x.consent_type === t)),
  ];
  const firstOpen = answered.findIndex((a) => !a);
  return ok(c, {
    currentStep: firstOpen === -1 ? 8 : firstOpen + 1,
    lastCompletedStep: p?.last_completed_step ?? 0,
    completed: u.onboarding_completed,
    answers,
  });
});

patientRoutes.patch("/onboarding/step", async (c) => {
  const me = await requirePatient(c);
  const b = await body(c);
  const step = Number(b.step);
  check(Number.isInteger(step) && step >= 1 && step <= 8, "That question is not one we know.");
  await ensureProfile(me.id);

  switch (step) {
    case 1: {
      const first = String(b.firstName ?? "").trim();
      const last = String(b.lastName ?? "").trim();
      const email = String(b.email ?? "").trim().toLowerCase();
      check(first.length > 0, "Enter your first name.");
      check(isEmail(email), "Enter a valid email address.");
      const full = String(b.fullName ?? `${first} ${last}`).trim();
      await sql`update patient_profiles set first_name = ${first}, last_name = ${last} where user_id = ${me.id}`;
      await sql`update users set full_name = ${full}, email = ${email} where id = ${me.id}`;
      break;
    }
    case 2:
      await sql`update patient_profiles set gender = ${genderOf(b.gender)} where user_id = ${me.id}`;
      break;
    case 3: {
      const age = num(b.ageYears);
      checkAge(age);
      await sql`update patient_profiles set age_years = ${age}, age_recorded_at = now() where user_id = ${me.id}`;
      break;
    }
    case 4: {
      const h = tenth(num(b.heightCm));
      checkHeight(h);
      await sql`update patient_profiles set height_cm = ${h} where user_id = ${me.id}`;
      break;
    }
    case 5: {
      const w = tenth(num(b.weightKg));
      checkWeight(w);
      await sql`update patient_profiles set weight_kg = ${w} where user_id = ${me.id}`;
      break;
    }
    case 6: {
      const codes = Array.isArray(b.weightLossExperience) ? b.weightLossExperience.map(String) : [];
      check(codes.length > 0 && codes.every((x) => EXPERIENCE_CODES.includes(x)), "Choose at least one answer.");
      check(!(codes.includes("FIRST_TIME") && codes.length > 1), "\"This is my first real attempt\" cannot be combined with another answer.");
      await sql`update patient_profiles set weight_loss_experience = ${codes} where user_id = ${me.id}`;
      break;
    }
    case 7: {
      const none = b.noConditions === true;
      const list = (Array.isArray(b.conditions) ? b.conditions : []) as { code?: string; otherText?: string }[];
      const clean = list.map((x) => {
        const code = String(x?.code ?? "");
        check(CONDITION_CODES.includes(code), "Choose conditions from the list.");
        if (code === "OTHER") {
          const other = String(x.otherText ?? "").trim();
          check(other.length > 0, "Tell us the other condition.");
          return { code, otherText: other.slice(0, 200) };
        }
        return { code };
      });
      check(none ? clean.length === 0 : clean.length > 0, "Choose a condition, or \"None of these\".");
      await sql`update patient_profiles set conditions = ${sql.json(clean)}, no_conditions = ${none} where user_id = ${me.id}`;
      break;
    }
    case 8: {
      const given = ((Array.isArray(b.consents) ? b.consents : []) as { type?: string; version?: string; accepted?: boolean }[])
        .filter((x) => x?.accepted !== false && CONSENT_TYPES.includes(String(x?.type)));
      const types = [...new Set(given.map((x) => String(x.type)))];
      check(REQUIRED_CONSENTS.every((t) => types.includes(t)), "Tick the four required consents to continue.");
      const version = String(given[0]?.version ?? CONSENT_VERSION);
      await sql.begin(async (tx) => {
        await tx`update consents set revoked_at = now()
                 where user_id = ${me.id} and revoked_at is null and consent_type <> all(${types})`;
        const active = (await tx`select consent_type from consents where user_id = ${me.id} and revoked_at is null`)
          .map((r) => r.consent_type);
        for (const t of types.filter((t) => !active.includes(t)))
          await tx`insert into consents (user_id, consent_type, version) values (${me.id}, ${t}, ${version})`;
      });
      break;
    }
  }
  await sql`update patient_profiles set last_completed_step = greatest(last_completed_step, ${step}), updated_at = now()
            where user_id = ${me.id}`;
  return ok(c, { currentStep: Math.min(8, step + 1) }, "Saved");
});

patientRoutes.post("/onboarding/complete", async (c) => {
  const me = await requirePatient(c);
  const b = await body(c);
  const fullName = String(b.fullName ?? "").trim();
  const email = String(b.email ?? "").trim().toLowerCase();
  check(fullName.length > 0, "Enter your name.");
  check(isEmail(email), "Enter a valid email address.");
  const gender = genderOf(b.gender);
  const age = num(b.ageYears);
  checkAge(age);
  const h = tenth(num(b.heightCm));
  checkHeight(h);
  const w = tenth(num(b.weightKg));
  checkWeight(w);

  await ensureProfile(me.id);
  const [p] = await sql`select weight_loss_experience, conditions from patient_profiles where user_id = ${me.id}`;
  check((p.weight_loss_experience ?? []).length > 0, "Answer \"Have you tried to lose weight before?\" first.");
  check(p.conditions != null, "Answer \"Do you have any of these?\" first.");
  const consents = await activeConsents(me.id);
  check(REQUIRED_CONSENTS.every((t) => consents.some((x) => x.consent_type === t)), "Tick the four required consents first.");

  const [first, ...rest] = fullName.split(/\s+/);
  await sql.begin(async (tx) => {
    await tx`update users set full_name = ${fullName}, email = ${email}, onboarding_completed = true where id = ${me.id}`;
    await tx`update patient_profiles set first_name = coalesce(first_name, ${first}), last_name = coalesce(last_name, ${rest.join(" ")}),
             gender = ${gender}, age_years = ${age}, age_recorded_at = now(), height_cm = ${h}, weight_kg = ${w},
             last_completed_step = 8, updated_at = now() where user_id = ${me.id}`;
    const [baseline] = await tx`select id from weight_logs where user_id = ${me.id} and source = 'ONBOARDING'`;
    if (baseline) await tx`update weight_logs set weight_kg = ${w} where id = ${baseline.id}`;
    else await tx`insert into weight_logs (user_id, weight_kg, source) values (${me.id}, ${w}, 'ONBOARDING')`;
    await tx`insert into eligibility (user_id) values (${me.id}) on conflict (user_id) do nothing`;
  });
  return ok(c, { bmi: tenth(w / (h / 100) ** 2) }, "Profile complete");
});

// ---------- profile ----------

function conditionsLine(p: Record<string, unknown> | undefined): string {
  if (!p) return "";
  if (p.conditions_text) return String(p.conditions_text);
  if (p.no_conditions) return "None";
  const list = (p.conditions ?? []) as { code: string; otherText?: string }[];
  return list.map((x) => x.code === "OTHER" ? x.otherText ?? "Other" : CONDITIONS.find((k) => k.code === x.code)?.label ?? x.code)
    .join(", ");
}

patientRoutes.get("/patient/profile", async (c) => {
  const me = await requirePatient(c);
  const [u] = await sql`select id, mobile, full_name, email from users where id = ${me.id}`;
  const [p] = await sql`select * from patient_profiles where user_id = ${me.id}`;
  const [w] = await sql`select weight_kg from weight_logs where user_id = ${me.id} order by logged_at desc limit 1`;
  const [plan] = await sql`
    select pl.name, s.status from subscriptions s join plans pl on pl.id = s.plan_id
    where s.user_id = ${me.id} and s.status = 'Active' and s.ends_at > now() order by s.starts_at desc limit 1`;
  const consents = await activeConsents(me.id);
  const reminders = (p?.reminders ?? {}) as Record<string, boolean>;
  const privacy = (p?.privacy ?? {}) as Record<string, boolean>;
  return ok(c, {
    patientId: u.id,
    fullName: u.full_name ?? "",
    email: u.email ?? "",
    phone: u.mobile,
    age: p?.age_years ?? null,
    gender: p?.gender ?? null,
    conditions: conditionsLine(p),
    height: p?.height_cm ?? null,
    weight: w?.weight_kg ?? p?.weight_kg ?? null,
    planName: plan?.name ?? "",
    planStatus: plan?.status ?? "",
    remindersEnabled: reminders.remindersEnabled ?? true,
    whatsappReminders: reminders.whatsappReminders ?? true,
    emailReminders: reminders.emailReminders ?? false,
    consentGiven: privacy.consentGiven ?? consents.some((x) => x.consent_type === "HEALTH_DATA"),
  });
});

patientRoutes.patch("/patient/profile", async (c) => {
  const me = await requirePatient(c);
  const b = await body(c);
  const fullName = String(b.fullName ?? "").trim();
  const email = String(b.email ?? "").trim().toLowerCase();
  check(fullName.length > 0, "Enter your name.");
  check(email === "" || isEmail(email), "Enter a valid email address.");
  // ponytail: the mobile number is the sign-in identity, so `phone` is not changed here
  await sql`update users set full_name = ${fullName}, email = ${email || null} where id = ${me.id}`;
  await ensureProfile(me.id);
  const [first, ...rest] = fullName.split(/\s+/);
  await sql`update patient_profiles set first_name = ${first}, last_name = ${rest.join(" ")}, updated_at = now() where user_id = ${me.id}`;
  if (b.age !== null && b.age !== undefined && b.age !== "") {
    const age = num(b.age);
    checkAge(age);
    await sql`update patient_profiles set age_years = ${age}, age_recorded_at = now() where user_id = ${me.id}`;
  }
  return ok(c, null, "Details saved");
});

patientRoutes.patch("/patient/health-profile", async (c) => {
  const me = await requirePatient(c);
  const b = await body(c);
  await ensureProfile(me.id);
  const height = b.height == null || b.height === "" ? null : tenth(num(b.height));
  const weight = b.weight == null || b.weight === "" ? null : tenth(num(b.weight));
  if (height !== null) checkHeight(height);
  if (weight !== null) checkWeight(weight);
  await sql`update patient_profiles set conditions_text = ${String(b.conditions ?? "").trim().slice(0, 500)},
            height_cm = coalesce(${height}, height_cm), weight_kg = coalesce(${weight}, weight_kg), updated_at = now()
            where user_id = ${me.id}`;
  if (weight !== null) {
    const [last] = await sql`select weight_kg from weight_logs where user_id = ${me.id} order by logged_at desc limit 1`;
    if (!last || Number(last.weight_kg) !== weight)
      await sql`insert into weight_logs (user_id, weight_kg, source) values (${me.id}, ${weight}, 'PROFILE')`;
  }
  return ok(c, null, "Health profile saved");
});

patientRoutes.patch("/patient/reminders", async (c) => {
  const me = await requirePatient(c);
  const b = await body(c);
  await ensureProfile(me.id);
  const reminders = {
    remindersEnabled: Boolean(b.remindersEnabled),
    whatsappReminders: Boolean(b.whatsappReminders),
    emailReminders: Boolean(b.emailReminders),
  };
  await sql`update patient_profiles set reminders = ${sql.json(reminders)}, updated_at = now() where user_id = ${me.id}`;
  return ok(c, reminders, "Reminders saved");
});

patientRoutes.patch("/patient/privacy", async (c) => {
  const me = await requirePatient(c);
  const b = await body(c);
  await ensureProfile(me.id);
  await sql`update patient_profiles set privacy = ${sql.json({ consentGiven: Boolean(b.consentGiven) })}, updated_at = now()
            where user_id = ${me.id}`;
  return ok(c, { consentGiven: Boolean(b.consentGiven) }, "Privacy choice saved");
});

patientRoutes.post("/patient/support", async (c) => {
  const me = await requirePatient(c);
  const b = await body(c);
  const subject = String(b.subject ?? "").trim().slice(0, 200);
  const message = String(b.message ?? "").trim().slice(0, 5000);
  check(message.length > 0, "Write a message for the support team.");
  await sql`insert into support_requests (user_id, body) values (${me.id}, ${sql.json({ subject, message })})`;
  return ok(c, null, "Message sent. The InRange team will reply on WhatsApp or email.");
});

// ---------- weight ----------

patientRoutes.get("/trackers/weight", async (c) => {
  const me = await requirePatient(c);
  const rows = await sql`select id, weight_kg as "weightKg", logged_at as "loggedAt" from weight_logs
                         where user_id = ${me.id} order by logged_at`;
  return ok(c, rows);
});

patientRoutes.post("/trackers/weight", async (c) => {
  const me = await requirePatient(c);
  const w = tenth(num((await body(c)).weightKg));
  checkWeight(w);
  const [row] = await sql`insert into weight_logs (user_id, weight_kg, source) values (${me.id}, ${w}, 'APP')
                          returning id, weight_kg as "weightKg", logged_at as "loggedAt"`;
  return ok(c, row, "Weight saved");
});

patientRoutes.delete("/trackers/weight/:id", async (c) => {
  const me = await requirePatient(c);
  const id = intParam(c.req.param("id"), "reading");
  const rows = await sql`delete from weight_logs where id = ${id} and user_id = ${me.id} returning id`;
  if (!rows.length) fail(400, "That reading could not be found.");
  return ok(c, null, "Reading deleted");
});

// ---------- eligibility, plans, packages ----------

patientRoutes.get("/eligibility", async (c) => {
  const me = await requirePatient(c);
  const [e] = await sql`select * from eligibility where user_id = ${me.id}`;
  // an active plan covers follow-ups ("Doctor review every 14 days, included"), so Book skips checkout
  const [{ covered }] = await sql`
    select exists (select 1 from subscriptions where user_id = ${me.id} and status = 'Active' and ends_at > now())
       and exists (select 1 from appointments where patient_id = ${me.id} and status <> 'Cancelled') as covered`;
  return ok(c, {
    path: e?.path ?? null,
    stage: e?.stage ?? "NOT_STARTED",
    reviewNote: e?.review_note ?? null,
    labBookingId: e?.lab_booking_id ?? null,
    consultationPaid: (Boolean(e?.consultation_paid) && !e?.consultation_used) || covered,
    updatedAt: e?.updated_at ?? null,
  });
});

patientRoutes.get("/subscriptions/plans", async (c) => {
  const rows = await sql`select * from plans where active order by sort_order, duration_months`;
  return ok(c, rows.map((p) => ({
    PlanId: p.id, PlanName: p.name, Description: p.description, DurationMonths: p.duration_months,
    Price: p.price_rupees, IsActive: p.active, Perks: p.features ?? [],
  })));
});

patientRoutes.get("/subscriptions/status", async (c) => {
  const me = await requirePatient(c);
  const [s] = await sql`select plan_id, ends_at from subscriptions where user_id = ${me.id} and status = 'Active' and ends_at > now()
                        order by starts_at desc limit 1`;
  return ok(c, { hasActivePlan: Boolean(s), isActive: Boolean(s), planId: s?.plan_id ?? null, endsAt: s?.ends_at ?? null });
});

patientRoutes.get("/subscriptions/recommended", async (c) => {
  const me = await requirePatient(c);
  const [r] = await sql`select r.plan_id, r.note, d.full_name from plan_recommendations r join doctors d on d.id = r.doctor_id
                        where r.patient_id = ${me.id} order by r.created_at desc limit 1`;
  return ok(c, r ? { planId: r.plan_id, doctorName: r.full_name, note: r.note ?? "" } : null);
});

patientRoutes.get("/care-packages", async (c) => {
  await requirePatient(c);
  const rows = await sql`select * from care_packages order by sort_order`;
  return ok(c, rows.map((p) => ({
    code: p.code, name: p.name, description: p.description, priceRupees: p.price_rupees,
    includesLabTests: p.includes_lab_tests, labPackageCode: p.lab_package_code, includes: p.includes ?? [],
  })));
});

// ---------- reports ----------

const REPORT_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };
const MAX_REPORT_BYTES = 10 * 1024 * 1024;

async function toReport(r: Record<string, unknown>) {
  return {
    id: r.id,
    title: r.title ?? "Report",
    reportDate: r.report_day ?? "",
    source: r.source === "LAB" ? "LAB_BOOKING" : "UPLOADED",
    fileUrl: r.source === "LAB" ? null : await signedUrl("reports", r.file_path as string | null),
    labBookingId: r.lab_booking_id ?? null,
    addedAt: r.uploaded_at,
    reviewStatus: r.review_status ?? null,
    reviewNote: r.review_note ?? null,
  };
}

const REPORT_COLUMNS = () => sql`id, title, source, file_path, lab_booking_id, uploaded_at, review_status, review_note,
  to_char(report_date, 'YYYY-MM-DD') as report_day`;

patientRoutes.get("/reports", async (c) => {
  const me = await requirePatient(c);
  const rows = await sql`select ${REPORT_COLUMNS()} from reports where user_id = ${me.id}
                         order by report_date desc nulls last, uploaded_at desc`;
  return ok(c, await Promise.all(rows.map(toReport)));
});

function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

patientRoutes.post("/reports", async (c: Context) => {
  const me = await requirePatient(c);
  let form: Record<string, string | File>;
  try {
    form = (await c.req.parseBody()) as Record<string, string | File>;
  } catch {
    return fail(422, "Send the report as a file upload.");
  }
  const file = form.file;
  if (!(file instanceof File)) return fail(422, "Choose a report file to upload.");
  const ext = REPORT_TYPES[file.type];
  if (!ext) fail(422, "Upload a PDF, PNG or JPEG file.");
  if (file.size > MAX_REPORT_BYTES) fail(422, "The file is over 10 MB. Upload a smaller copy.");
  const reportDate = String(form.reportDate ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate) || Number.isNaN(Date.parse(reportDate)))
    fail(422, "Enter the date printed on the report.");
  const age = daysBetween(reportDate, todayIST());
  if (age < 0) fail(422, "The report date cannot be in the future.");
  if (age > 90) fail(422, "This report is older than 3 months. Upload a newer one, or book a home blood test.");
  const forEligibility = String(form.purpose ?? "").toUpperCase() === "ELIGIBILITY";
  // file names ("report", "IMG_2041") make poor titles; a plain label reads better in both apps
  const title = String(form.title ?? "").trim().slice(0, 200) || (forEligibility ? "Blood test report" : "Uploaded report");

  const path = `${me.id}/${crypto.randomUUID()}.${ext}`;
  await uploadFile("reports", path, file, file.type);
  const reviewStatus = forEligibility ? "UNDER_REVIEW" : null;
  const [row] = await sql`
    insert into reports (user_id, purpose, source, title, file_path, file_name, mime_type, size_bytes, report_date, review_status, review_note)
    values (${me.id}, ${forEligibility ? "ELIGIBILITY" : "GENERAL"}, 'UPLOAD', ${title}, ${path}, ${file.name}, ${file.type},
            ${file.size}, ${reportDate}, ${reviewStatus}, null)
    returning ${REPORT_COLUMNS()}`;
  if (forEligibility) await setEligibility(sql, me.id, { path: "OWN_REPORT", stage: "UNDER_REVIEW" });
  return ok(c, await toReport(row), "Report uploaded");
});

// ---------- addresses ----------

patientRoutes.get("/address/my-addresses", async (c) => {
  const me = await requirePatient(c);
  const rows = await sql`select * from addresses where user_id = ${me.id} order by is_default desc, created_at desc`;
  return ok(c, rows.map((a) => ({
    AddressId: a.id, AddressLine: a.line1, Landmark: a.landmark ?? "", City: a.city ?? "", State: a.state ?? "",
    Pincode: a.pincode ?? "", Latitude: a.latitude, Longitude: a.longitude, IsPrimary: a.is_default,
  })));
});

patientRoutes.post("/address/add", async (c) => {
  const me = await requirePatient(c);
  const b = await body(c);
  const line = String(b.addressLine ?? "").trim();
  const pincode = String(b.pincode ?? "").trim();
  check(line.length >= 5, "Enter the house, street and area.");
  check(/^[1-9]\d{5}$/.test(pincode), "Enter a valid 6-digit pincode.");
  const coord = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const [{ count }] = await sql`select count(*)::int as count from addresses where user_id = ${me.id}`;
  const primary = Boolean(b.isPrimary) || count === 0;
  const [row] = await sql.begin(async (tx) => {
    if (primary) await tx`update addresses set is_default = false where user_id = ${me.id}`;
    return await tx`
      insert into addresses (user_id, line1, landmark, city, state, pincode, latitude, longitude, is_default)
      values (${me.id}, ${line.slice(0, 300)}, ${String(b.landmark ?? "").trim() || null}, ${String(b.city ?? "").trim() || null},
              ${String(b.state ?? "").trim() || null}, ${pincode}, ${coord(b.latitude)}, ${coord(b.longitude)}, ${primary})
      returning id`;
  });
  c.status(201);
  return ok(c, { addressId: row.id }, "Address saved");
});

patientRoutes.delete("/address/:addressId", async (c) => {
  const me = await requirePatient(c);
  const id = intParam(c.req.param("addressId"), "address");
  try {
    const [gone] = await sql`delete from addresses where id = ${id} and user_id = ${me.id} returning is_default`;
    if (!gone) fail(400, "That address could not be found.");
    if (gone.is_default)
      await sql`update addresses set is_default = true where id = (
                  select id from addresses where user_id = ${me.id} order by created_at desc limit 1)`;
  } catch (e) {
    if ((e as { code?: string }).code === "23503")
      fail(409, "This address is used by a lab booking, so it cannot be removed.");
    throw e;
  }
  return ok(c, null, "Address removed");
});
