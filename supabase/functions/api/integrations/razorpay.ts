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
