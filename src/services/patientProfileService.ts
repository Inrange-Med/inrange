/**
 * The patient's own profile and settings. Doc: docs/backend/patient-dashboard.md
 *   GET   /api/patient/profile          the profile, plan name and settings
 *   PATCH /api/patient/profile          personal details { fullName, email, phone, age }
 *   PATCH /api/patient/health-profile   health details { conditions, height, weight, bmi }
 *   PATCH /api/patient/reminders        reminder settings { remindersEnabled, whatsappReminders, emailReminders }
 *   PATCH /api/patient/privacy          data-sharing consent { consentGiven }
 *   POST  /api/patient/support          a message to support { subject, message }
 */

import { apiRequest } from "@/lib/http/apiClient";
import type { Gender } from "@/types/onboarding";
import type { PatientProfile } from "@/types/patientProfile";

type RawProfile = Record<string, unknown>;

const numberOrNull = (value: unknown) =>
  value === null || value === undefined || value === "" ? null : Number(value);

/** "male", "FEMALE", "Other" -> the app's Gender; anything else is null. */
function genderOrNull(value: unknown): Gender | null {
  const lower = String(value ?? "").toLowerCase();
  if (lower === "male") return "Male";
  if (lower === "female") return "Female";
  return lower === "other" ? "Other" : null;
}

function toPatientProfile(raw: RawProfile): PatientProfile {
  return {
    patientId: numberOrNull(raw.patientId ?? raw.PatientId),
    fullName: String(raw.fullName ?? raw.FullName ?? ""),
    email: String(raw.email ?? raw.Email ?? ""),
    phone: String(raw.phone ?? raw.Phone ?? raw.mobileNumber ?? ""),
    age: numberOrNull(raw.age ?? raw.Age),
    gender: genderOrNull(raw.gender ?? raw.Gender),
    conditions: String(raw.conditions ?? ""),
    heightCm: numberOrNull(raw.height ?? raw.heightCm),
    weightKg: numberOrNull(raw.weight ?? raw.weightKg),
    planName: String(raw.planName ?? ""),
    planStatus: String(raw.planStatus ?? ""),
    remindersEnabled: Boolean(raw.remindersEnabled),
    whatsappReminders: Boolean(raw.whatsappReminders),
    emailReminders: Boolean(raw.emailReminders),
    consentGiven: Boolean(raw.consentGiven),
  };
}

export async function getMyProfile(): Promise<PatientProfile> {
  const body = await apiRequest<{
    data?: { patient?: RawProfile } & RawProfile;
    patient?: RawProfile;
  }>("/api/patient/profile");
  return toPatientProfile(
    body.data?.patient ?? body.data ?? body.patient ?? (body as RawProfile),
  );
}

export async function updatePersonalDetails(
  details: Pick<PatientProfile, "fullName" | "email" | "phone" | "age">,
) {
  await apiRequest("/api/patient/profile", { method: "PATCH", body: details });
}

export async function updateHealthDetails(details: {
  conditions: string;
  heightCm: number | null;
  weightKg: number | null;
}) {
  const bmi =
    details.heightCm && details.weightKg
      ? Number((details.weightKg / (details.heightCm / 100) ** 2).toFixed(1))
      : null;
  await apiRequest("/api/patient/health-profile", {
    method: "PATCH",
    body: {
      conditions: details.conditions,
      height: details.heightCm,
      weight: details.weightKg,
      bmi,
    },
  });
}

/** Only the switches passed change (the others keep what the server has). */
export async function updateReminderSettings(
  settings: Partial<
    Pick<PatientProfile, "remindersEnabled" | "whatsappReminders" | "emailReminders">
  >,
) {
  await apiRequest("/api/patient/reminders", {
    method: "PATCH",
    body: settings,
  });
}

export async function updatePrivacyConsent(consentGiven: boolean) {
  await apiRequest("/api/patient/privacy", {
    method: "PATCH",
    body: { consentGiven },
  });
}

export async function contactSupport(subject: string, message: string) {
  await apiRequest("/api/patient/support", {
    method: "POST",
    body: { subject, message },
  });
}
