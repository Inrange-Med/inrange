"use client";

/**
 * The order as the backend priced it: its title, line items and total (never added up here), a
 * note on who processes the payment, and one pay button styled as Arhaan's primary action.
 * `onPay` receives the button's resolved colour so Razorpay's window matches it. When online
 * payment is not switched on (no real Razorpay key yet), the review still shows and the button
 * says so instead of opening Razorpay. `autoPay`: the patient already checked the bill on the screen
 * before (a lab booking's review), so Razorpay opens once on arrival instead of asking for a second
 * tap; closing it leaves this review with its Pay button.
 */

import { useEffect, useRef } from "react";
import { ArrowRight, LockSimple } from "@phosphor-icons/react";
import ItemisedBill from "@/app/patient-dashboard/components/ItemisedBill";
import Card from "@/components/ui/Card";
import ErrorNotice from "@/components/ui/ErrorNotice";
import { formatRupees } from "@/lib/format/money";
import type { PaymentOrder } from "@/types/payment";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "./OrderReview.module.css";

export type CheckoutNotice = { tone: "calm" | "error"; text: string } | null;

export default function OrderReview({
  order,
  busyLabel,
  notice,
  awaitingConfirmation,
  paymentReady,
  pilotPayment,
  autoPay = false,
  onPay,
}: {
  order: PaymentOrder;
  busyLabel: string | null;
  notice: CheckoutNotice;
  awaitingConfirmation: boolean;
  paymentReady: boolean;
  /** pilot: the payment is simulated and nothing is charged */
  pilotPayment: boolean;
  autoPay?: boolean;
  onPay: (themeColour: string) => void;
}) {
  const payButton = useRef<HTMLButtonElement>(null);
  const autoPaid = useRef(false);
  const themeOf = (button: HTMLButtonElement) =>
    getComputedStyle(button).getPropertyValue("--btn-bg").trim();

  // once, when the order is ready: Razorpay opens without a second "Pay" tap
  useEffect(() => {
    if (!autoPay || !paymentReady || autoPaid.current || !payButton.current)
      return;
    autoPaid.current = true;
    onPay(themeOf(payButton.current));
  }, [autoPay, paymentReady, onPay]);

  const total = formatRupees(order.amountPaise / 100);
  const idleLabel = awaitingConfirmation
    ? "Confirm payment"
    : notice?.tone === "error"
      ? `Try again, pay ${total}`
      : `Pay ${total}`;

  return (
    <Card title={order.title}>
      <div className={styles.review}>
        <ItemisedBill
          lines={order.lineItems.map((item, index) => ({
            key: `${index}-${item.label}`,
            label: item.label,
            amount:
              item.amountPaise < 0
                ? `−${formatRupees(-item.amountPaise / 100)}`
                : formatRupees(item.amountPaise / 100),
          }))}
          total={{ label: "To pay now", amount: total }}
        />
        {/* standing conditions on a quiet plate (Arhaan Care .fast) */}
        {pilotPayment && (
          <p className={styles.fast} role="status">
            Pilot test payment. Nothing is charged.
          </p>
        )}
        {!paymentReady && (
          <p className={styles.fast} role="status">
            Online payment is not switched on yet. Nothing has been charged.
          </p>
        )}
        {notice &&
          (notice.tone === "error" ? (
            <ErrorNotice message={notice.text} />
          ) : (
            <p className={styles.calm} role="status">
              {notice.text}
            </p>
          ))}
        <button
          ref={payButton}
          type="button"
          className={`btn ${formStyles.go} ${styles.payDock}`}
          data-busy={busyLabel !== null}
          aria-busy={busyLabel !== null}
          disabled={!paymentReady}
          onClick={(event) =>
            busyLabel === null && onPay(themeOf(event.currentTarget))
          }
        >
          <span>
            {busyLabel ??
              (paymentReady ? idleLabel : "Payment not available yet")}
          </span>
          <span className="well" aria-hidden="true">
            {busyLabel !== null ? (
              <i className={formStyles.spin} />
            ) : (
              <ArrowRight size={18} />
            )}
          </span>
        </button>
        {/* the honest line under the action (Arhaan Onboarding a.demo) */}
        <p className={`${formStyles.demo} ${styles.secure}`}>
          <LockSimple size={13} aria-hidden="true" />
          <span>
            Pay by UPI, card, net banking or wallet. Payments are processed
            securely by Razorpay.
          </span>
        </p>
      </div>
    </Card>
  );
}
