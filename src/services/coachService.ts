/**
 * The coach's panel: a coach's own patients, the diet chart and exercise plan, the calls made and the remarks
 * for the doctor. Docs: docs/backend/sales-and-coach.md
 *   GET  /api/coach/patients?q=                   my patients
 *   GET  /api/coach/patients/:id                  one patient
 *   PUT  /api/coach/patients/:id/plans/:kind      { text } kind diet | fitness: a new version
 *   POST /api/coach/patients/:id/calls            { calledOn, note, kind? } a call made
 *   POST /api/admin/medicine/patients/:id/remarks { text } a remark for the doctor (medicineOpsService.addCoachRemark)
 */

import { apiRequest, listFrom, type ApiEnvelope } from "@/lib/http/apiClient";
import type { CoachPatient, CoachPatientRow } from "@/types/coach";

export async function listCoachPatients(q = ""): Promise<CoachPatientRow[]> {
  return listFrom<CoachPatientRow>(
    await apiRequest(
      `/api/coach/patients${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
    "patients",
  );
}

export async function getCoachPatient(id: string): Promise<CoachPatient> {
  return (
    await apiRequest<ApiEnvelope<CoachPatient>>(`/api/coach/patients/${id}`)
  ).data!;
}

/** Saves a new version of the diet chart or the exercise plan; returns the server's words. */
export async function saveCoachPlan(
  patientId: string,
  kind: "diet" | "fitness",
  text: string,
): Promise<string> {
  const body = await apiRequest<{ message?: string }>(
    `/api/coach/patients/${patientId}/plans/${kind}`,
    { method: "PUT", body: { text } },
  );
  return body?.message ?? "Saved";
}

export async function logCoachCall(
  patientId: string,
  call: { calledOn: string; note: string; kind?: "HEALTH" | "FITNESS" },
): Promise<string> {
  const body = await apiRequest<{ message?: string }>(
    `/api/coach/patients/${patientId}/calls`,
    { method: "POST", body: call },
  );
  return body?.message ?? "Call logged";
}
