/**
 * Packages a new patient buys before the first consultation (consultation only, or lab tests and
 * consultation). Prices come from the backend. Doc: docs/backend/onboarding.md
 *   GET /api/care-packages   PROPOSED. The packages on offer -> { data: CarePackage[] }
 */

import { ApiError, apiRequest, listFrom } from "@/lib/http/apiClient";
import type { CarePackage } from "@/types/carePackage";

/** null when the backend does not have the endpoint yet. */
export async function listCarePackages(): Promise<CarePackage[] | null> {
  try {
    return listFrom<CarePackage>(await apiRequest("/api/care-packages")).map(
      (p) => ({ ...p, mrpRupees: p.mrpRupees ?? null, addOns: p.addOns ?? [] }),
    );
  } catch (caught) {
    if (caught instanceof ApiError && caught.isMissingEndpoint) return null;
    throw caught;
  }
}
