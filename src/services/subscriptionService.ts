/**
 * Programme plans and the patient's subscription. Plans start only through a verified payment
 * (paymentService), never from here. Doc: docs/backend/patient-dashboard.md
 *   GET /api/subscriptions/plans            the plans on offer (no auth)
 *   GET /api/subscriptions/status?userId=   whether the patient has an active plan
 *   GET /api/subscriptions/recommended      PROPOSED. The plan the doctor suggested -> { data: { planId, doctorName, note } }
 */

import { ApiError, apiRequest, listFrom } from "@/lib/http/apiClient";
import type {
  RecommendedPlan,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/types/subscription";

type RawPlan = {
  PlanId: number;
  PlanName: string;
  DurationMonths: number;
  Price: number | null;
  Mrp?: number | null;
  IsActive: boolean;
  Perks?: string[];
};
type RawStatus = {
  hasActivePlan?: boolean;
  isActive?: boolean;
  planId?: number;
};

export async function listPlans(): Promise<SubscriptionPlan[]> {
  const body = await apiRequest("/api/subscriptions/plans", {
    authenticated: false,
  });
  return listFrom<RawPlan>(body).map((raw) => ({
    id: raw.PlanId,
    name: raw.PlanName,
    durationMonths: raw.DurationMonths,
    priceRupees: raw.Price,
    mrpRupees: raw.Mrp ?? null,
    isActive: raw.IsActive,
    perks: raw.Perks ?? [],
  }));
}

export async function getSubscriptionStatus(
  userId: number,
): Promise<SubscriptionStatus> {
  const body = await apiRequest<RawStatus & { data?: RawStatus }>(
    "/api/subscriptions/status",
    { query: { userId } },
  );
  const source = body.data ?? body;
  return {
    hasActivePlan: Boolean(source.hasActivePlan ?? source.isActive),
    planId: source.planId ?? null,
  };
}

/** null when the doctor has not recommended a plan, or the backend does not have the endpoint yet. */
export async function getRecommendedPlan(): Promise<RecommendedPlan | null> {
  try {
    const body = await apiRequest<{
      data?: {
        planId?: number | string | null;
        doctorName?: string | null;
        note?: string | null;
      } | null;
    }>("/api/subscriptions/recommended");
    const raw = body.data;
    if (!raw || raw.planId == null) return null;
    return {
      planId: Number(raw.planId),
      doctorName: raw.doctorName ?? "",
      note: raw.note ?? "",
    };
  } catch (caught) {
    if (caught instanceof ApiError && caught.isMissingEndpoint) return null;
    throw caught;
  }
}
