/**
 * The patient's eligibility review (see src/types/eligibility.ts for the two paths).
 * Doc: docs/backend/patient-dashboard.md
 *   GET /api/eligibility   PROPOSED. Where the patient's review stands -> { data: Eligibility }
 * The backend moves the stage: an uploaded report (POST /api/reports with purpose ELIGIBILITY), a
 * paid lab package, Redcliffe webhooks and the back office's decision all update it.
 */

import { ApiError, apiRequest } from "@/lib/http/apiClient";
import type { Eligibility } from "@/types/eligibility";

const NOT_STARTED: Eligibility = {
  path: null,
  stage: "NOT_STARTED",
  reviewNote: null,
  labBookingId: null,
  consultationPaid: false,
  labCredit: false,
  updatedAt: null,
};

/** null when the backend does not have the endpoint yet. */
export async function getMyEligibility(): Promise<Eligibility | null> {
  try {
    const body = await apiRequest<{ data?: Partial<Eligibility> }>(
      "/api/eligibility",
    );
    return {
      ...NOT_STARTED,
      ...body.data,
      labBookingId:
        body.data?.labBookingId != null ? String(body.data.labBookingId) : null,
    };
  } catch (caught) {
    if (caught instanceof ApiError && caught.isMissingEndpoint) return null;
    throw caught;
  }
}
