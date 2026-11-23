// Razorpay (Standard Checkout + Orders API). LIVE when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set
// (webhooks also need RAZORPAY_WEBHOOK_SECRET); otherwise MOCK: orders are "order_mock_..." with key id
// "rzp_mock", and the web app's checkout completes them without opening Razorpay.
// Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
import { env, live } from "../lib/env.ts";

export const razorpayLive = live.razorpay;
export const MOCK_KEY_ID = "rzp_mock";

// deno-lint-ignore no-explicit-any
async function api(path: string, body?: unknown): Promise<Record<string, any>> {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env.razorpayKeyId}:${env.razorpayKeySecret}`)}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("razorpay", path, res.status, out?.error?.code, out?.error?.description);
    throw new Error(`Razorpay ${path} failed`);
  }
  return out;
}

export async function createOrder(amountPaise: number, receipt: string, notes: Record<string, string>): Promise<string> {
  if (!razorpayLive()) return `order_mock_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
  const out = await api("/orders", {
    amount: amountPaise, currency: "INR", receipt: receipt.slice(0, 40), notes,
    // capture on the order itself, so it never depends on the Dashboard's capture setting. A payment
    // authorised after 12 minutes is not auto-captured: /payments/verify captures it while the patient
    // waits, otherwise Razorpay refunds it (https://razorpay.com/docs/payments/payments/capture-settings/api/)
    payment: { capture: "automatic", capture_options: { automatic_expiry_period: 12, refund_speed: "normal" } },
  });
  if (!out.id) throw new Error("Razorpay order has no id");
  return out.id;
}

/**
 * True once Razorpay holds the money for our order: the payment belongs to that order, is for its exact
 * amount in INR, and is captured. One still `authorized` (auto-capture has not run yet) is captured here.
 * Razorpay's rule: deliver only after capture, since uncaptured payments are refunded.
 */
export async function paymentCaptured(paymentId: string, orderId: string, amountPaise: number) {
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) return false;
  let p = await api(`/payments/${paymentId}`);
  if (p.order_id !== orderId || p.amount !== amountPaise || p.currency !== "INR") return false;
  if (p.status === "authorized")
    p = await api(`/payments/${paymentId}/capture`, { amount: amountPaise, currency: "INR" })
      .catch(() => api(`/payments/${paymentId}`)); // auto-capture got there first
  return p.status === "captured";
}

/**
 * The captured payment on one of our orders, if any (the nightly reconciliation: a payment Razorpay holds
 * whose webhook and verify never reached us). Mock orders were never sent to Razorpay, so they have none.
 */
export async function capturedPaymentFor(orderId: string, amountPaise: number): Promise<string | null> {
  if (!razorpayLive() || !orderId.startsWith("order_") || orderId.startsWith("order_mock_")) return null;
  const out = await api(`/orders/${orderId}/payments`);
  const paid = (out.items ?? []).find((p: Record<string, unknown>) =>
    p.status === "captured" && p.amount === amountPaise && p.currency === "INR");
  return paid ? String(paid.id) : null;
}

/** A full refund of a captured payment (an order the pharmacy cannot fill, or the patient cancels). */
export async function refundPayment(paymentId: string, amountPaise: number, notes: Record<string, string>): Promise<string> {
  if (!razorpayLive() || !paymentId.startsWith("pay_")) return `rfnd_mock_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
  const out = await api(`/payments/${paymentId}/refund`, { amount: amountPaise, speed: "normal", notes });
  if (!out.id) throw new Error("Razorpay refund has no id");
  return out.id;
}

// ---------------------------------------------------------------- payment links
// https://razorpay.com/docs/api/payments/payment-links/ (read 23 Nov 2026). A link is made for one amount and one
// customer; `reference_id` is ours and must be new for every link; only a link still "created" can be cancelled;
// the amount can never be changed, so a new price is a new link. Paid in full: status "paid", with the captured
// payment in `payments`. We never trust the customer's return or a webhook's body for that: both only make us
// fetch the link again.

export type LinkState = { status: "created" | "partially_paid" | "paid" | "cancelled" | "expired"; amountPaidPaise: number; paymentId: string | null };
export const isMockLink = (id: string) => id.startsWith("plink_mock_");

export async function createPaymentLink(o: {
  amountPaise: number; description: string; referenceId: string; customer: { name: string; mobile: string };
  expiresAt: Date; notes: Record<string, string>; callbackUrl: string; textTheCustomer: boolean; mock?: boolean;
}): Promise<{ id: string; shortUrl: string; provider: "razorpay" | "mock" }> {
  if (o.mock || !razorpayLive()) {
    const id = `plink_mock_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
    return { id, shortUrl: `${env.appUrl}/pay/${id}`, provider: "mock" };
  }
  const out = await api("/payment_links", {
    amount: o.amountPaise, currency: "INR", accept_partial: false, description: o.description.slice(0, 2000),
    reference_id: o.referenceId.slice(0, 40), customer: { name: o.customer.name.slice(0, 80), contact: `+91${o.customer.mobile}` },
    notify: { sms: o.textTheCustomer, email: false }, reminder_enable: o.textTheCustomer,
    expire_by: Math.floor(o.expiresAt.getTime() / 1000), notes: o.notes, callback_url: o.callbackUrl, callback_method: "get",
  });
  if (!out.id || !out.short_url) throw new Error("Razorpay payment link has no id");
  return { id: String(out.id), shortUrl: String(out.short_url), provider: "razorpay" };
}

export async function fetchPaymentLink(id: string): Promise<LinkState> {
  const out = await api(`/payment_links/${id}`);
  const paid = (out.payments ?? []).find((p: Record<string, unknown>) => p.status === "captured");
  return { status: out.status, amountPaidPaise: Number(out.amount_paid ?? 0), paymentId: paid ? String(paid.payment_id) : null };
}

/** Cancels a link nobody has paid. False when Razorpay refuses (it was paid, or has ended already). */
export async function cancelPaymentLink(id: string): Promise<boolean> {
  if (isMockLink(id)) return true;
  return await api(`/payment_links/${id}/cancel`, {}).then(() => true).catch(() => false);
}

/** A payment by its id, as Razorpay holds it; null when there is none (or in mock mode). */
export async function fetchPayment(paymentId: string): Promise<{ status: string; amountPaise: number; currency: string; mobile: string | null } | null> {
  if (!razorpayLive() || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) return null;
  const p = await api(`/payments/${paymentId}`).catch(() => null);
  if (!p?.id) return null;
  return { status: String(p.status), amountPaise: Number(p.amount), currency: String(p.currency), mobile: mobileOf(p.contact) };
}

/** "+919876543210" -> "9876543210" */
export const mobileOf = (contact: unknown): string | null => {
  const digits = String(contact ?? "").replace(/\D/g, "").slice(-10);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
};

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string compare (same length required). */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Checkout's signature: HMAC_SHA256(orderId|paymentId) with the key secret. */
export async function checkoutSignatureValid(orderId: string, paymentId: string, signature: string) {
  if (!env.razorpayKeySecret) return false;
  return safeEqual(await hmacHex(env.razorpayKeySecret, `${orderId}|${paymentId}`), String(signature ?? "").toLowerCase());
}

/** Webhook signature over the raw body with the webhook secret. */
export async function webhookSignatureValid(rawBody: string, signature: string) {
  if (!env.razorpayWebhookSecret) return false;
  return safeEqual(await hmacHex(env.razorpayWebhookSecret, rawBody), String(signature ?? "").toLowerCase());
}
