/**
 * The doctor's consultations and prescriptions (doctor portal v2). Doc: docs/backend/doctor-portal-v2.md
 *   GET  /api/doctor/consultations?date=YYYY-MM-DD          the day, and "Do this now" (any date)
 *   GET  /api/doctor/consultations/history?from=&to=&q=     past consultations, newest first
 *   GET  /api/doctor/consultations/:id                      the patient's page, opened from a consultation
 *   GET  /api/doctor/patients/:patientId/page               the same page, opened from the patient list
 * The prescription, for a consultation (`/consultations/:id`) or with no consultation (`/patients/:patientId`);
 * the page says which (`write`):
 *   PUT  .../prescription         autosave
 *   POST .../prescription/pdf     Create PDF
 *   POST .../prescription/send    Send to patient
 *   POST .../prescription/resend  Send again
 *   POST .../prescription/revise  Edit and send new version
 *   POST .../prescription/discard Keep the version already sent (or give up one written with no consultation)
 *   GET  /api/medicines/search?q=                           the master list: { matches, didYouMean }
 */

import { apiRequest, type ApiEnvelope } from "@/lib/http/apiClient";
import type {
  ConsultationDay,
  ConsultationHistory,
  MedicineSearch,
  PatientPageData,
  Prescription,
  PrescriptionDraft,
  RxTarget,
} from "@/types/consultation";

const base = "/api/doctor/consultations";

export async function getConsultationDay(
  date: string,
): Promise<ConsultationDay> {
  const body = await apiRequest<ApiEnvelope<ConsultationDay>>(base, {
    query: { date },
  });
  return body.data ?? { date, day: [], waiting: [] };
}

export async function getConsultationHistory(filters: {
  from?: string;
  to?: string;
  q?: string;
}): Promise<ConsultationHistory> {
  const query: Record<string, string> = {};
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;
  if (filters.q?.trim()) query.q = filters.q.trim();
  const body = await apiRequest<ApiEnvelope<ConsultationHistory>>(
    `${base}/history`,
    { query },
  );
  return body.data ?? { from: "", to: "", consultations: [] };
}

export async function getConsultation(id: string): Promise<PatientPageData> {
  const body = await apiRequest<ApiEnvelope<PatientPageData>>(`${base}/${id}`);
  return body.data!;
}

export async function getPatientPage(
  patientId: string,
): Promise<PatientPageData> {
  const body = await apiRequest<ApiEnvelope<PatientPageData>>(
    `/api/doctor/patients/${patientId}/page`,
  );
  return body.data!;
}

const rxPath = (target: RxTarget) =>
  target.kind === "consultation"
    ? `${base}/${target.id}/prescription`
    : `/api/doctor/patients/${target.id}/prescription`;

export async function savePrescription(
  target: RxTarget,
  draft: Partial<PrescriptionDraft>,
  signal?: AbortSignal,
): Promise<Prescription> {
  const body = await apiRequest<ApiEnvelope<Prescription>>(rxPath(target), {
    method: "PUT",
    body: draft,
    signal,
  });
  return body.data!;
}

async function act(
  target: RxTarget,
  step: "pdf" | "send" | "resend" | "revise" | "discard",
): Promise<Prescription | null> {
  const body = await apiRequest<ApiEnvelope<Prescription | null>>(
    `${rxPath(target)}/${step}`,
    { method: "POST" },
  );
  return body.data ?? null;
}

export const createPrescriptionPdf = async (target: RxTarget) =>
  (await act(target, "pdf"))!;
export const sendPrescription = async (target: RxTarget) =>
  (await act(target, "send"))!;
export const sendPrescriptionAgain = async (target: RxTarget) =>
  (await act(target, "resend"))!;
export const revisePrescription = async (target: RxTarget) =>
  (await act(target, "revise"))!;
/** Answers the sent prescription a consultation keeps; null when one written with no consultation was given up. */
export const discardNewVersion = (target: RxTarget) => act(target, "discard");

export async function searchMedicines(
  q: string,
  signal?: AbortSignal,
): Promise<MedicineSearch> {
  const body = await apiRequest<ApiEnvelope<MedicineSearch>>(
    "/api/medicines/search",
    { query: { q }, signal },
  );
  return body.data ?? { matches: [], didYouMean: [] };
}

/** How many consultations wait on the doctor (the Today badge). */
export async function countWaiting(date: string): Promise<number> {
  return (await getConsultationDay(date)).waiting.length;
}
