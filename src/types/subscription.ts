/** Programme plans and the patient's subscription. */

/** A plan from GET /api/subscriptions/plans. Price is in rupees. */
export type SubscriptionPlan = {
  id: number;
  name: string;
  durationMonths: number;
  priceRupees: number | null;
  /** the plan's MRP, shown struck through above the price; null when there is none */
  mrpRupees: number | null;
  isActive: boolean;
  perks: string[];
};

/** GET /api/subscriptions/status */
export type SubscriptionStatus = {
  hasActivePlan: boolean;
  planId: number | null;
};

/**
 * The plan the patient is to pay for (GET /api/subscriptions/recommended): since 20 Nov 2026 admin assigns it after
 * the salesperson's call (no doctor); older ones were a doctor's suggestion, with their note.
 */
export type RecommendedPlan = {
  planId: number;
  doctorName: string | null;
  note: string;
};
