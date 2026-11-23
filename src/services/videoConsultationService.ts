/**
 * The video call for a consultation (a 100ms room behind the backend), for both roles.
 * Doc: docs/backend/consultations-and-care.md
 *   GET  /api/video/appointments/:appointmentId/join   the room link and role -> { data: { joinLink, role } }
 *        ?record=1|0 (the patient only): their yes or no to this call being recorded
 *   POST /api/video/appointments/:appointmentId/end    ends it for everyone (doctor only)
 */

import { apiRequest } from "@/lib/http/apiClient";
import type { VideoRoom } from "@/types/appointment";

export async function joinVideoConsultation(
  appointmentId: string,
  /** the patient's choice on their Join screen; left out for the doctor */
  record?: boolean,
): Promise<VideoRoom> {
  const body = await apiRequest<{
    data?: { joinLink?: string; role?: string };
  }>(`/api/video/appointments/${appointmentId}/join`, {
    query: record === undefined ? undefined : { record: record ? "1" : "0" },
  });
  if (!body.data?.joinLink)
    throw new Error("The call link is not ready yet. Try again in a minute.");
  return {
    joinLink: body.data.joinLink,
    role: body.data.role === "doctor" ? "doctor" : "patient",
  };
}

export async function endVideoConsultation(
  appointmentId: string,
): Promise<void> {
  await apiRequest(`/api/video/appointments/${appointmentId}/end`, {
    method: "POST",
  });
}
