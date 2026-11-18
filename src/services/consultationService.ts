/**
 * The doctor's consultations and prescriptions (doctor portal v2). Doc: docs/backend/doctor-portal-v2.md
 *   GET  /api/doctor/consultations?date=YYYY-MM-DD          the day, and "Do this now" (any date)
 *   GET  /api/doctor/consultations/history?from=&to=&q=     past consultations, newest first
 *   GET  /api/doctor/consultations/:id                      the consultation page
 *   PUT  /api/doctor/consultations/:id/prescription         autosave
 *   POST /api/doctor/consultations/:id/prescription/pdf     Create PDF
 *   POST /api/doctor/consultations/:id/prescription/send    Send to patient
 *   POST /api/doctor/consultations/:id/prescription/resend  Send again
 *   POST /api/doctor/consultations/:id/prescription/revise  Edit and send new version
 *   GET  /api/medicines/search?q=                           the master list: { matches, didYouMean }
 */

import { apiRequest, type ApiEnvelope } from "@/lib/http/apiClient";
import type {
  ConsultationDay,
  ConsultationHistory,
  ConsultationPage,
  MedicineSearch,
  Prescription,
  PrescriptionDraft,
} from "@/types/consultation";

const base = "/api/doctor/consultations";

export async function getConsultationDay(date: string): Promise<ConsultationDay> {
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

export async function getConsultation(id: string): Promise<ConsultationPage> {
  const body = await apiRequest<ApiEnvelope<ConsultationPage>>(`${base}/${id}`);
  return body.data!;
}

export async function savePrescription(
  id: string,
  draft: Partial<PrescriptionDraft>,
  signal?: AbortSignal,
): Promise<Prescription> {
  const body = await apiRequest<ApiEnvelope<Prescription>>(
    `${base}/${id}/prescription`,
    { method: "PUT", body: draft, signal },
  );
  return body.data!;
}

async function act(
  id: string,
  step: "pdf" | "send" | "resend" | "revise",
): Promise<Prescription> {
  const body = await apiRequest<ApiEnvelope<Prescription>>(
    `${base}/${id}/prescription/${step}`,
    { method: "POST" },
  );
  return body.data!;
}

export const createPrescriptionPdf = (id: string) => act(id, "pdf");
export const sendPrescription = (id: string) => act(id, "send");
export const sendPrescriptionAgain = (id: string) => act(id, "resend");
export const revisePrescription = (id: string) => act(id, "revise");

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
