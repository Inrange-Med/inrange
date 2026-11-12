/**
 * Opens Razorpay Checkout (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/)
 * for an order the backend already created, and resolves with what happened.
 *
 * The script loads once, on first use. The key id comes from the order (the API's RAZORPAY_KEY_ID,
 * so it always matches the account that created the order); the secret never reaches the browser.
 * The pilot API answers key id "rzp_mock" until it has Razorpay keys: then no window opens and the
 * payment is simulated (the API refuses a mock signature once keys are set). A missing or
 * placeholder key (e.g. "rzp_test_xxxxxxxxxxxx") never opens Razorpay: the checkout says online
 * payment is not switched on yet.
 *
 * A failed attempt resolves at once with Razorpay's reason (retry is off), so our page shows it
 * and the button can try again; Razorpay's own error page never stays on screen.
 */

import type { RazorpayPaymentResult } from "@/types/payment";

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill: { name?: string; contact?: string };
  theme: { color?: string };
  config: {
    display: { hide: { method: string; flows: string[] }[] };
  };
  handler: (response: RazorpaySuccessResponse) => void;
  modal: { ondismiss: () => void };
  retry: { enabled: boolean };
};

type RazorpayInstance = {
  open: () => void;
  on: (
    event: "payment.failed",
    callback: (response: { error?: { description?: string } }) => void,
  ) => void;
};

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

type CheckoutRequest = {
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  description: string;
  customerName: string;
  customerMobile: string;
  /** A resolved colour value (read from a design token at runtime). */
  themeColour: string;
};

/** A real Razorpay key id: rzp_test_ or rzp_live_ followed by its 14-character id. */
const RAZORPAY_KEY_PATTERN = /^rzp_(test|live)_[A-Za-z0-9]{14}$/;

/** The pilot API's key id while it has no Razorpay keys: the payment is simulated, nothing is charged. */
export const MOCK_RAZORPAY_KEY = "rzp_mock";

export const isMockPayment = (orderKeyId: string) =>
  orderKeyId === MOCK_RAZORPAY_KEY;

type CheckoutOutcome =
  | { kind: "paid"; result: RazorpayPaymentResult }
  | { kind: "closed"; failureMessage: string | null };

const CHECKOUT_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

let scriptLoading: Promise<RazorpayConstructor> | null = null;

/** The key Razorpay should use for this order, or null when payments are not set up yet. */
export function usableRazorpayKey(orderKeyId: string): string | null {
  if (isMockPayment(orderKeyId)) return MOCK_RAZORPAY_KEY;
  return RAZORPAY_KEY_PATTERN.test(orderKeyId) ? orderKeyId : null;
}

function loadCheckoutScript(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  scriptLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.Razorpay
        ? resolve(window.Razorpay)
        : reject(
            new Error("The payment window could not start. Please try again."),
          );
    script.onerror = () => {
      scriptLoading = null;
      script.remove();
      reject(
        new Error(
          "The payment window could not load. Check your connection and try again.",
        ),
      );
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

export async function openRazorpayCheckout(
  request: CheckoutRequest,
): Promise<CheckoutOutcome> {
  const key = usableRazorpayKey(request.keyId);
  if (!key) throw new Error("Online payment is not switched on yet.");
  if (key === MOCK_RAZORPAY_KEY) {
    // pilot: a short beat stands in for the payment window; the API accepts this only in mock mode
    await new Promise((resolve) => setTimeout(resolve, 900));
    return {
      kind: "paid",
      result: {
        orderId: request.orderId,
        razorpayPaymentId: `pay_mock_${crypto.randomUUID().slice(0, 12)}`,
        razorpaySignature: "mock",
      },
    };
  }
  const Razorpay = await loadCheckoutScript();

  return new Promise((resolve) => {
    const checkout = new Razorpay({
      key,
      amount: request.amountPaise,
      currency: request.currency,
      order_id: request.orderId,
      name: "inrange",
      description: request.description,
      prefill: {
        name: request.customerName || undefined,
        // Razorpay's format: + and country code; sign-in keeps the 10-digit Indian number
        contact: request.customerMobile
          ? `+91${request.customerMobile}`
          : undefined,
      },
      theme: { color: request.themeColour || undefined },
      // NPCI retired UPI Collect (typing a UPI id) on 28 Feb 2026; Razorpay shows a QR on desktop and
      // opens the UPI app on phones instead (razorpay.com/docs/announcements/upi-collect-migration)
      config: {
        display: { hide: [{ method: "upi", flows: ["collect"] }] },
      },
      handler: (response) =>
        resolve({
          kind: "paid",
          result: {
            orderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          },
        }),
      modal: {
        ondismiss: () => resolve({ kind: "closed", failureMessage: null }),
      },
      retry: { enabled: false },
    });
    checkout.on("payment.failed", (response) =>
      resolve({
        kind: "closed",
        failureMessage:
          response.error?.description || "The payment did not go through.",
      }),
    );
    checkout.open();
  });
}
