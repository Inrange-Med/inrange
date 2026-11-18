/**
 * The patient's Home (doctor portal v2). Doc: docs/backend/doctor-portal-v2.md, "The next step"
 *   GET /api/patient/next-step    the one next step, from blood test to delivery
 *   GET /api/care/prescriptions   every prescription the patient was sent, newest first
 */

import { apiRequest, type ApiEnvelope } from "@/lib/http/apiClient";
import type { NextStep, PatientPrescription } from "@/types/patientHome";

export async function getNextStep(): Promise<NextStep> {
  const body = await apiRequest<ApiEnvelope<NextStep>>(
    "/api/patient/next-step",
  );
  return body.data ?? { stage: "BLOOD_TEST_NEEDED" };
}

export async function listMyPrescriptions(): Promise<PatientPrescription[]> {
  const body = await apiRequest<
    ApiEnvelope<{ prescriptions: PatientPrescription[] }>
  >("/api/care/prescriptions");
  return body.data?.prescriptions ?? [];
}
