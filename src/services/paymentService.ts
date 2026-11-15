/**
 * Payments through Razorpay. Doc: docs/backend/payments-razorpay.md
 *   POST /api/payments/orders   PROPOSED. Creates an order { purpose, referenceId, reason? } -> { data: PaymentOrder }
 *   POST /api/payments/verify   PROPOSED. Checks the signature and fulfils { orderId, razorpayPaymentId, razorpaySignature }
 *   GET  /api/payments          PROPOSED. The patient's paid orders (invoices) -> { data: PaymentRecord[] }
 * referenceId: the plan id (PLAN), the lab booking id (LAB_BOOKING), the slot id (CONSULTATION_FEE) or the
 * medicine cart id (MEDICINE_ORDER).
 * The backend computes every amount and fulfils the purpose after verifying the signature, so this
 * file never sends a price and never activates anything itself.
 */

import { apiRequest, listFrom, type ApiEnvelope } from "@/lib/http/apiClient";
import type {
  PaymentOrder,
  PaymentPurpose,
  PaymentRecord,
  RazorpayPaymentResult,
  VerifiedPayment,
} from "@/types/payment";

type RawOrder = Partial<PaymentOrder>;
type RawPaymentRecord = Partial<PaymentRecord>;

/** `reason`: for CONSULTATION_FEE, what the patient wants to discuss; the backend saves it on the booking. */
export async function createPaymentOrder(
  purpose: PaymentPurpose,
  referenceId: string,
  reason?: string,
): Promise<PaymentOrder> {
  const body = await apiRequest<ApiEnvelope<RawOrder>>("/api/payments/orders", {
    method: "POST",
    body: { purpose, referenceId, reason },
  });
  const raw = body.data ?? {};
  if (!raw.orderId || typeof raw.amountPaise !== "number")
    throw new Error("The payment could not be prepared. Please try again.");
  return {
    orderId: raw.orderId,
    amountPaise: raw.amountPaise,
    currency: raw.currency ?? "INR",
    razorpayKeyId: raw.razorpayKeyId ?? "",
    title: raw.title ?? "Payment",
    lineItems: raw.lineItems ?? [],
  };
}

export async function verifyPayment(
  result: RazorpayPaymentResult,
): Promise<VerifiedPayment> {
  const body = await apiRequest<ApiEnvelope<VerifiedPayment>>(
    "/api/payments/verify",
    { method: "POST", body: result },
  );
  if (body.data?.status !== "PAID")
    throw new Error(
      "Your payment could not be confirmed yet. Please try again.",
    );
  return body.data;
}

export async function listPayments(): Promise<PaymentRecord[]> {
  const body = await apiRequest("/api/payments");
  return listFrom<RawPaymentRecord>(body).map((raw) => ({
    id: String(raw.id ?? raw.invoiceNumber ?? ""),
    purpose: raw.purpose ?? "PLAN",
    title: raw.title ?? "Payment",
    amountPaise: raw.amountPaise ?? 0,
    paidAt: raw.paidAt ?? "",
    invoiceNumber: raw.invoiceNumber ?? "",
    invoiceUrl: raw.invoiceUrl ?? null,
  }));
}
