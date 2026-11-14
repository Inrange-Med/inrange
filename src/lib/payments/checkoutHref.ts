/** The link to the shared checkout (/patient-dashboard/checkout); it asks the backend for the price and goes to returnTo once paid. */

import type { PaymentPurpose } from "@/types/payment";

export function checkoutHref({
  purpose,
  referenceId,
  returnTo,
  payNow = false,
}: {
  purpose: PaymentPurpose;
  referenceId: string | number;
  returnTo: string;
  /** the screen before already showed the bill: Razorpay opens on arrival, without a second tap */
  payNow?: boolean;
}): string {
  const query = new URLSearchParams({
    purpose,
    referenceId: String(referenceId),
    returnTo,
  });
  if (payNow) query.set("pay", "now");
  return `/patient-dashboard/checkout?${query}`;
}
