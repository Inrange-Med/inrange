// Self-check for Razorpay signatures and the capture check (no network: fetch is stubbed). Run:
//   RAZORPAY_KEY_ID=k RAZORPAY_KEY_SECRET=ks RAZORPAY_WEBHOOK_SECRET=ws deno run --allow-env integrations/razorpay.check.ts
import { checkoutSignatureValid, paymentCaptured, webhookSignatureValid } from "./razorpay.ts";

async function hmac(secret: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}
const assert = (cond: boolean, what: string) => { if (!cond) throw new Error(`FAIL: ${what}`); };

const body = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_1","order_id":"order_1","amount":49900}}}}';
assert(await webhookSignatureValid(body, await hmac("ws", body)), "webhook: correct signature accepted");
assert(!(await webhookSignatureValid(body, await hmac("wrong", body))), "webhook: wrong secret refused");
assert(!(await webhookSignatureValid(body + " ", await hmac("ws", body))), "webhook: altered body refused");
assert(await checkoutSignatureValid("order_1", "pay_1", await hmac("ks", "order_1|pay_1")), "checkout: correct signature accepted");
assert(!(await checkoutSignatureValid("order_1", "pay_2", await hmac("ks", "order_1|pay_1"))), "checkout: other payment refused");

// paymentCaptured: Razorpay answers with this payment; a capture call turns "authorized" into "captured"
let payment: Record<string, unknown> = {};
let calls: string[] = [];
globalThis.fetch = ((url: string, init?: RequestInit) => {
  calls.push(`${init?.method} ${url}`);
  if (String(url).endsWith("/capture")) payment = { ...payment, status: "captured" };
  return Promise.resolve(new Response(JSON.stringify(payment)));
}) as typeof fetch;
const paid = (p: Record<string, unknown>) => { payment = { order_id: "order_1", amount: 49900, currency: "INR", ...p }; calls = []; };
paid({ status: "captured" });
assert(await paymentCaptured("pay_1", "order_1", 49900), "capture: captured payment accepted");
paid({ status: "authorized" });
assert(await paymentCaptured("pay_1", "order_1", 49900) && calls.length === 2, "capture: authorized payment captured");
paid({ status: "captured", order_id: "order_2" });
assert(!(await paymentCaptured("pay_1", "order_1", 49900)), "capture: another order's payment refused");
paid({ status: "captured", amount: 100 });
assert(!(await paymentCaptured("pay_1", "order_1", 49900)), "capture: wrong amount refused");
paid({ status: "failed" });
assert(!(await paymentCaptured("pay_1", "order_1", 49900)), "capture: failed payment refused");
paid({ status: "captured" });
assert(!(await paymentCaptured("pay_1/../orders", "order_1", 49900)) && calls.length === 0, "capture: odd id never sent");
console.log("razorpay signatures and capture: ok");
