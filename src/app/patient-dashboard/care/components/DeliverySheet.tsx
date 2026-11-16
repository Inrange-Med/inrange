"use client";

/**
 * One medicine delivery in full: where it is, what is in it, the courier and tracking while it is on the
 * way, and once delivered when it runs out and whether it arrived as it should (the same question
 * WhatsApp asks, for anyone using the app; "Something is wrong" says when the care team will call).
 */

import { useState } from "react";
import { ArrowRight, WarningCircle } from "@phosphor-icons/react";
import { shortDate } from "@/lib/format/dateTime";
import type { MedicineOrder } from "@/types/carePlan";
import {
  DELIVERY_STEPS,
  deliveryStepIndex,
  reachedAt,
  stepDates,
} from "./deliveryStatus";
import StepLine from "./StepLine";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import pageStyles from "../CarePage.module.css";
import styles from "./DeliverySheet.module.css";

function statusSentence(order: MedicineOrder) {
  if (order.status === "CANCELLED")
    return `Cancelled${order.cancelReason ? `: ${order.cancelReason.replace(/\.$/, "")}` : ""}. ${order.refundedPaise ? "Your payment is on its way back to how you paid, in 5 to 7 working days." : ""}`.trim();
  if (order.status === "DELIVERED")
    return `Delivered ${shortDate(order.deliveredAt ?? reachedAt(order, "DELIVERED") ?? order.placedAt)} from inrange's pharmacy.`;
  if (order.status === "OUT_FOR_DELIVERY")
    return "Out for delivery today. Keep your phone close for the courier.";
  if (order.status === "DISPATCHED") {
    const sent =
      order.dispatchedAt ?? reachedAt(order, "DISPATCHED") ?? order.placedAt;
    return `From inrange's pharmacy. Handed to ${order.courier ?? "the courier"} ${shortDate(sent)}${order.expectedAt ? `, due ${shortDate(order.expectedAt)}` : ""}.`;
  }
  const lastNote = order.history.at(-1)?.note;
  return lastNote
    ? `From inrange's pharmacy. ${lastNote.replace(/\.$/, "")}.`
    : "From inrange's pharmacy.";
}

export default function DeliverySheet({
  order,
  onRate,
}: {
  order: MedicineOrder;
  /** sends the rating; resolves with the line to show */
  onRate?: (rating: "GOOD" | "ISSUE", note: string) => Promise<string>;
}) {
  const [asking, setAsking] = useState<"choose" | "issue" | "done">(
    order.canGiveFeedback ? "choose" : "done",
  );
  const [note, setNote] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const onTheWay =
    order.status === "DISPATCHED" || order.status === "OUT_FOR_DELIVERY";
  const dates = stepDates(order);

  const rate = async (rating: "GOOD" | "ISSUE") => {
    if (!onRate) return;
    setBusy(true);
    setProblem(null);
    try {
      setAnswer(await onRate(rating, note.trim()));
      setAsking("done");
    } catch (caught) {
      setProblem(
        caught instanceof Error
          ? caught.message
          : "That was not sent. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={pageStyles.sheetBody}>
      <p className={pageStyles.sheetMeta}>{statusSentence(order)}</p>
      {order.status !== "CANCELLED" && (
        <StepLine
          label="Delivery status"
          steps={DELIVERY_STEPS.map((label, i) => ({
            label,
            when: dates[i] ? shortDate(dates[i]!) : null,
          }))}
          currentIndex={deliveryStepIndex(order)}
        />
      )}
      <div className={styles.items}>
        <p className={styles.groupHead}>In this delivery</p>
        <ul>
          {order.items.map((item) => (
            <li key={item.name}>
              <strong>{item.name}</strong>
              <span>{item.quantity}</span>
            </li>
          ))}
        </ul>
      </div>
      {(order.orderNumber || order.trackingNo || order.runOutOn) && (
        <dl className={pageStyles.facts}>
          {order.orderNumber && (
            <div>
              <dt>Order</dt>
              <dd className="num">{order.orderNumber}</dd>
            </div>
          )}
          {order.trackingNo && (
            <div>
              <dt>Tracking number</dt>
              <dd className="num">{order.trackingNo}</dd>
            </div>
          )}
          {order.status === "DELIVERED" && order.runOutOn && (
            <div>
              <dt>Lasts until about</dt>
              <dd className="num">{shortDate(order.runOutOn)}</dd>
            </div>
          )}
        </dl>
      )}
      {onTheWay && order.trackingUrl && (
        <a
          href={order.trackingUrl}
          className={`btn ${formStyles.go}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>Track with {order.courier ?? "the courier"}</span>
          <span className="well" aria-hidden="true">
            <ArrowRight size={18} />
          </span>
        </a>
      )}

      {order.status === "DELIVERED" && onRate && asking !== "done" && (
        <div className={styles.feedback}>
          <p className={styles.groupHead}>Did it arrive as it should?</p>
          {asking === "choose" ? (
            <div className={styles.feedbackRow}>
              <button
                type="button"
                className={`btn btn--ghost ${styles.choice}`}
                disabled={busy}
                onClick={() => rate("GOOD")}
              >
                All good
              </button>
              <button
                type="button"
                className={`btn btn--ghost ${styles.choice}`}
                disabled={busy}
                onClick={() => setAsking("issue")}
              >
                Something is wrong
              </button>
            </div>
          ) : (
            <>
              <label className={formStyles.field}>
                <span className={formStyles.label}>What happened?</span>
                <textarea
                  className={styles.note}
                  value={note}
                  maxLength={1000}
                  placeholder="A broken seal, something missing, a damaged pack"
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <button
                type="button"
                className={`btn ${formStyles.go}`}
                data-busy={busy}
                aria-busy={busy}
                onClick={() => rate("ISSUE")}
              >
                <span>{busy ? "Sending" : "Tell the care team"}</span>
                <span className="well" aria-hidden="true">
                  {busy ? (
                    <i className={formStyles.spin} />
                  ) : (
                    <ArrowRight size={18} />
                  )}
                </span>
              </button>
            </>
          )}
          {problem && (
            <p className={formStyles.err} role="alert">
              <WarningCircle size={16} weight="fill" aria-hidden="true" />
              <span>{problem}</span>
            </p>
          )}
        </div>
      )}
      {answer && (
        <p className={pageStyles.sheetMeta} role="status">
          {answer}
        </p>
      )}
      {order.status !== "CANCELLED" && (
        <p className={pageStyles.foot}>
          Scan the QR seal on each pack to check it is genuine.
        </p>
      )}
    </div>
  );
}
