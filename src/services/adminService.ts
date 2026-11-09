/**
 * The InRange team's admin area (role ADMIN only). Doc: supabase/functions/api/routes/admin.ts
 *   GET   /api/admin/reviews               waiting reviews (oldest first) and the last 20 decided
 *   POST  /api/admin/reviews/:patientId    { decision, note? }: note required for NOT_APPROVED, shown to the patient
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
  };
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
