"use client";

/**
 * The checkout for every purpose (PLAN, LAB_BOOKING, CONSULTATION_FEE), driven by the URL:
 *   ?purpose=PLAN&referenceId=<id>&returnTo=/patient-dashboard
 *
 * 1. Asks the backend for an order (it decides the amount), and shows it for review.
 * 2. Opens Razorpay Checkout with that order.
 * 3. Paid: the backend verifies the signature and fulfils the purpose; the receipt screen shows
 *    what was paid and what happens next, then Continue goes to returnTo.
 *    Closed: back to the review with a calm line. Failed: the reason, and the button tries again.
 *    Paid but not yet confirmed: the button retries the confirmation only, never a second payment.
 * Until the backend has /api/payments/*, the order request 404s and the page says payment is not
 * available yet. Nothing is ever activated without a verified payment.
 */

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import ErrorNotice from "@/components/ui/ErrorNotice";
import PageGhosts from "@/app/patient-dashboard/components/PageGhosts";
import { useShellFocus } from "@/app/patient-dashboard/components/shellFocus";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import { takePendingConsultationReason } from "@/lib/consultations/pendingConsultationReason";
import { ApiError, errorMessage } from "@/lib/http/apiClient";
import {
  isMockPayment,
  openRazorpayCheckout,
  usableRazorpayKey,
} from "@/lib/payments/razorpayCheckout";
import { getSessionUser } from "@/lib/session/authSession";
import { createPaymentOrder, verifyPayment } from "@/services/paymentService";
import {
  PAYMENT_PURPOSES,
  type PaymentOrder,
  type PaymentPurpose,
  type RazorpayPaymentResult,
} from "@/types/payment";
import CheckoutMessage from "./CheckoutMessage";
import OrderReview, { type CheckoutNotice } from "./OrderReview";
import PaymentReceived, { type PaidOrder } from "./PaymentReceived";
import pageStyles from "../CheckoutPage.module.css";

/** The page's own words per purpose; what is bought and its price always come from the order. */
const PURPOSE_WORDS: Record<
  PaymentPurpose,
  { title: string; sub: string | null; paid: string }
> = {
  PLAN: {
    title: "Pay for your plan",
    sub: null,
    paid: "Your plan is active. Your care team will be in touch about your next review.",
  },
  LAB_BOOKING: {
    title: "Pay for your home test",
    sub: "Your collection time is held while you pay.",
    paid: "Your home collection is confirmed. The lab's collector comes at the time you chose.",
  },
  CONSULTATION_FEE: {
    title: "Pay for your consultation",
    sub: "Your consultation time is held while you pay.",
    paid: "Your consultation is booked. You can join from Appointments 10 minutes before it starts.",
  },
};

const asPurpose = (value: string | null) =>
  PAYMENT_PURPOSES.find((purpose) => purpose === value) ?? null;

/** Only an in-app path, so a crafted link cannot send someone to another site after paying. */
const safeReturnPath = (value: string | null) =>
  value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/patient-dashboard";

async function loadOrder(
  purpose: PaymentPurpose | null,
  referenceId: string,
): Promise<PaymentOrder | null> {
  if (!purpose) return null;
  try {
    const reason =
      purpose === "CONSULTATION_FEE"
        ? takePendingConsultationReason(referenceId)
        : undefined;
    return await createPaymentOrder(purpose, referenceId, reason);
  } catch (error) {
    if (error instanceof ApiError && error.isMissingEndpoint) return null;
    throw error;
  }
}

export default function CheckoutFlow() {
  const params = useSearchParams();
  const purpose = asPurpose(params.get("purpose"));
  const referenceId = params.get("referenceId") ?? "";
  const returnTo = safeReturnPath(params.get("returnTo"));
  const isComplete = purpose !== null && referenceId !== "";
  const words = purpose ? PURPOSE_WORDS[purpose] : PURPOSE_WORDS.PLAN;
  // Back is always a link to returnTo (plans, pricing, a lab booking...; Home when missing), never
  // browser history, which a reopened link does not have. A consultation time can be taken while
  // the patient decides, so its Back goes to Book and says they can choose another.
  const back =
    purpose === "CONSULTATION_FEE"
      ? {
          href: "/patient-dashboard/appointments/book",
          label: "Choose another time",
        }
      : { href: returnTo, label: "Back" };

  const order = useApiResource(
    isComplete ? `payment-order-${purpose}-${referenceId}` : null,
    () => loadOrder(purpose, referenceId),
  );
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<CheckoutNotice>(null);
  const [unconfirmed, setUnconfirmed] = useState<RazorpayPaymentResult | null>(
    null,
  );
  const [paid, setPaid] = useState<PaidOrder | null>(null);
  // the shell's focus bar: its Close is the page's Back (same place, same name); once paid there is
  // no Back, so no Close
  useShellFocus({
    title: "Checkout",
    closeHref: paid ? undefined : back.href,
    closeLabel: back.label,
  });

  const confirm = async (
    current: PaymentOrder,
    result: RazorpayPaymentResult,
  ) => {
    setBusyLabel("Confirming payment");
    setNotice(null);
    try {
      await verifyPayment(result);
      setUnconfirmed(null);
      setPaid({
        title: current.title,
        amountPaise: current.amountPaise,
        paymentReference: result.razorpayPaymentId,
      });
    } catch (error) {
      setUnconfirmed(result);
      setNotice({
        tone: "error",
        text: errorMessage(
          error,
          "Your payment could not be confirmed yet. Please try again.",
        ),
      });
    } finally {
      setBusyLabel(null);
    }
  };

  const pay = async (current: PaymentOrder, themeColour: string) => {
    if (unconfirmed) return confirm(current, unconfirmed);
    setBusyLabel("Paying");
    setNotice(null);
    const user = getSessionUser();
    try {
      const outcome = await openRazorpayCheckout({
        orderId: current.orderId,
        amountPaise: current.amountPaise,
        currency: current.currency,
        keyId: current.razorpayKeyId,
        description: current.title,
        customerName: user?.fullName ?? "",
        customerMobile: user?.mobile ?? "",
        themeColour,
      });
      if (outcome.kind === "paid") return confirm(current, outcome.result);
      setNotice(
        outcome.failureMessage
          ? { tone: "error", text: outcome.failureMessage }
          : {
              tone: "calm",
              text: "Payment not completed. You can pay when you are ready.",
            },
      );
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    }
    setBusyLabel(null);
  };

  const content = () => {
    if (!isComplete)
      return (
        <CheckoutMessage
          title="Checkout"
          text="This payment link is incomplete."
          returnTo={returnTo}
          actionLabel="Go back"
        />
      );
    if (paid)
      return (
        <PaymentReceived
          paid={paid}
          nextStep={words.paid}
          continueTo={returnTo}
        />
      );
    if (order.error)
      return <ErrorNotice message={order.error} onRetry={order.reload} />;
    if (order.loading) return <PageGhosts heights={[300]} />;
    if (!order.data)
      return (
        <CheckoutMessage
          title="Checkout"
          text="Online payment is not available yet."
          returnTo={returnTo}
          actionLabel="Go back"
        />
      );
    const current = order.data;
    return (
      <OrderReview
        order={current}
        busyLabel={busyLabel}
        notice={notice}
        awaitingConfirmation={unconfirmed !== null}
        paymentReady={usableRazorpayKey(current.razorpayKeyId) !== null}
        pilotPayment={isMockPayment(current.razorpayKeyId)}
        onPay={(themeColour) => pay(current, themeColour)}
      />
    );
  };

  return (
    <>
      {/* Back is the focus bar's Close (same place, named for screen readers); the bar says
          Checkout, so the page's heading names what is being paid for */}
      <div className={pageStyles.head}>
        <PageHead
          title={paid ? "Payment received" : words.title}
          sub={isComplete && !paid ? words.sub : null}
        />
      </div>
      {content()}
    </>
  );
}
