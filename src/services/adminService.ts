/**
 * The inrange team's admin area (role ADMIN only). Doc: supabase/functions/api/routes/admin.ts
 *   GET   /api/admin/reviews               waiting reviews (oldest first), the last 20 decided, and patients waiting on a home test
 *   POST  /api/admin/reviews/:patientId    { decision, note? }: note required for NOT_APPROVED, shown to the patient
 *   POST  /api/admin/lab-bookings/:id/simulate  dry runs only { event: SAMPLE_COLLECTED | REPORT_READY }
 *   GET   /api/admin/doctors               every doctor, active first
 *   POST  /api/admin/doctors               a new doctor -> the doctor (409 with a message if the number is taken)
 *   PATCH /api/admin/doctors/:id           any field but the mobile, and { active } -> the doctor
 */

import { apiRequest, listFrom, type ApiEnvelope } from "@/lib/http/apiClient";
import type {
  AdminDoctor,
  DoctorChanges,
  NewDoctor,
  ReviewDecision,
  ReviewQueue,
} from "@/types/admin";

export async function listReviews(): Promise<ReviewQueue> {
  const body = await apiRequest<ApiEnvelope<ReviewQueue>>("/api/admin/reviews");
  return {
    waiting: body.data?.waiting ?? [],
    decided: body.data?.decided ?? [],
    awaitingLab: body.data?.awaitingLab ?? [],
    labSimulation: Boolean(body.data?.labSimulation),
  };
}

/** Dry runs only: walks a paid home test to the next lab step, as if the lab had sent it. */
export async function simulateLabStep(
  bookingId: string,
  event: "SAMPLE_COLLECTED" | "REPORT_READY",
): Promise<void> {
  await apiRequest(`/api/admin/lab-bookings/${bookingId}/simulate`, {
    method: "POST",
    body: { event },
  });
}

export async function decideReview(
  patientId: number,
  decision: ReviewDecision,
  note?: string,
): Promise<void> {
  await apiRequest(`/api/admin/reviews/${patientId}`, {
    method: "POST",
    body: { decision, note },
  });
}

export async function listDoctors(): Promise<AdminDoctor[]> {
  return listFrom<AdminDoctor>(await apiRequest("/api/admin/doctors"));
}

export async function addDoctor(doctor: NewDoctor): Promise<AdminDoctor> {
  const body = await apiRequest<ApiEnvelope<AdminDoctor>>(
    "/api/admin/doctors",
    { method: "POST", body: doctor },
  );
  return body.data as AdminDoctor;
}

export async function updateDoctor(
  id: number,
  changes: DoctorChanges,
): Promise<AdminDoctor> {
  const body = await apiRequest<ApiEnvelope<AdminDoctor>>(
    `/api/admin/doctors/${id}`,
    { method: "PATCH", body: changes },
  );
  return body.data as AdminDoctor;
}
