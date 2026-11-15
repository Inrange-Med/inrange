/**
 * Payments through Razorpay. The backend creates every order and decides every amount; the browser
 * only shows what the order says and hands the result back for verification.
 * Contract: docs/backend/payments-razorpay.md.
 */

/** What a payment is for. The backend fulfils each one differently once it is verified. */
export type PaymentPurpose =
  | "PLAN"
  | "LAB_BOOKING"
  | "CONSULTATION_FEE"
  | "MEDICINE_ORDER";

export const PAYMENT_PURPOSES: readonly PaymentPurpose[] = [
  "PLAN",
  "LAB_BOOKING",
  "CONSULTATION_FEE",
  "MEDICINE_ORDER",
];

export type PaymentLineItem = {
  label: string;
  amountPaise: number;
};

/** A Razorpay order created by POST /api/payments/orders. Amounts are in paise. */
export type PaymentOrder = {
  orderId: string;
  amountPaise: number;
  currency: string;
  /** Razorpay public key id; empty when the backend leaves it to the frontend env. */
  razorpayKeyId: string;
  title: string;
  lineItems: PaymentLineItem[];
};

/** What Razorpay Checkout hands back after a successful payment, to be verified by the backend. */
export type RazorpayPaymentResult = {
  orderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

/** The answer from POST /api/payments/verify. */
export type VerifiedPayment = {
  status: "PAID";
  purpose: PaymentPurpose;
  referenceId: string;
};

/** A paid order, as listed by GET /api/payments (the invoices list). */
export type PaymentRecord = {
  id: string;
  purpose: PaymentPurpose;
  title: string;
  amountPaise: number;
  paidAt: string;
  invoiceNumber: string;
  invoiceUrl: string | null;
};
