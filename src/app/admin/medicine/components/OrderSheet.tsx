"use client";

/*
  One delivery. Opened from "Dispatch" it is the dispatch form (courier, tracking link or number,
  expected date: the patient is told on WhatsApp); from "Mark delivered" it asks once more, because a
  delivered order never moves back and the patient is told at once. Otherwise it shows where the order
  goes, what is in it and every step so far, with the two rarer actions while it is on its way: a new
  expected date (the patient is told), and cancel with a full refund, which asks for the reason and
  confirms the consequence first.
*/

import { useEffect, useState } from "react";
import { ArrowRight, Phone } from "@phosphor-icons/react";
import DatePicker from "@/components/ui/DatePicker";
import Sheet from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/ToastProvider";
import { spacedMobile } from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import {
  cancelOrder,
  delayOrder,
  moveOrder,
} from "@/services/medicineOpsService";
import { combineDateAndTime, toApiDate } from "@/lib/format/dateTime";
import type { OpsOrder } from "@/types/medicineOps";
import { ORDER_WORDS, when } from "./words";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";
import s from "./Medicine.module.css";

/** An India-time day as the end of that day's deliveries (7 pm). */
const dayToIso = (day: string) => combineDateAndTime(day, "19:00");
/** Why the chosen day cannot be sent, or null: empty, or already past 7 pm that day. */
const dayProblem = (day: string) =>
  !/^\d{4}-\d{2}-\d{2}$/.test(day)
    ? "Choose a date."
    : Date.parse(dayToIso(day)) <= Date.now()
      ? "Choose a later date."
      : null;

export type OrderSheetStart = "view" | "dispatch" | "deliver";
type Mode = OrderSheetStart | "delay" | "cancel";

export default function OrderSheet({
  order,
  start,
  onClose,
  onOpenPatient,
  onChanged,
}: {
  order: OpsOrder | null;
  /** what the sheet opens on: the order, the dispatch form, or the delivery confirmation */
  start: OrderSheetStart;
  onClose: () => void;
  onOpenPatient: (id: string) => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("view");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [day, setDay] = useState("");
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset when another order opens */
    setMode(start);
    setCourier(order?.courier ?? "");
    setTracking(order?.trackingUrl ?? order?.trackingNo ?? "");
    // the expected date, or (none yet, or already past on a late order) a day from now
    const expected = order?.expectedAt ? new Date(order.expectedAt) : null;
    setDay(
      toApiDate(
        // the form saves 7 pm of the chosen day, so the day is kept only while that is still ahead
        expected && Date.parse(dayToIso(toApiDate(expected))) > Date.now()
          ? expected
          : new Date(Date.now() + (expected ? 1 : 2) * 86400_000),
      ),
    );
    setReason("");
    setProblem(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    order?.id,
    start,
    order?.courier,
    order?.trackingUrl,
    order?.trackingNo,
    order?.expectedAt,
  ]);

  if (!order)
    return (
      <Sheet open={false} onClose={onClose} title="Order">
        {null}
      </Sheet>
    );
  const onTheWay = [
    "PLACED",
    "PACKED",
    "DISPATCHED",
    "OUT_FOR_DELIVERY",
  ].includes(order.status);

  const run = async (work: () => Promise<void>, done: string) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await work();
      toast(done);
      onChanged();
      onClose();
    } catch (caught) {
      setProblem(errorMessage(caught, "That could not be saved. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (mode === "dispatch") {
      if (!courier.trim()) return setProblem("Add the courier.");
      if (!tracking.trim())
        return setProblem("Add the tracking link or number.");
      // the server takes https:// links with no spaces; a phone keyboard's "Https" is fixed here
      const typed = tracking.trim().replace(/^https:/i, "https:");
      const link = /^https:\/\/\S+$/.test(typed);
      // a link the patient cannot open safely is refused, never saved as a "number"
      if (!link && /^http:|:\/\/|^www\.|^https:/i.test(typed))
        return setProblem("A tracking link must start with https://.");
      const late = dayProblem(day);
      if (late) return setProblem(late);
      return run(
        () =>
          moveOrder(order.id, {
            to: "DISPATCHED",
            courier: courier.trim(),
            ...(link
              ? { trackingUrl: typed }
              : { trackingNo: typed }),
            expectedAt: dayToIso(day),
          }),
        `${order.orderNumber} dispatched. The patient has the tracking.`,
      );
    }
    if (mode === "deliver")
      return run(
        () => moveOrder(order.id, { to: "DELIVERED" }),
        `${order.orderNumber} delivered. The patient was told.`,
      );
    if (mode === "delay") {
      const late = dayProblem(day);
      if (late) return setProblem(late);
      return run(
        () => delayOrder(order.id, dayToIso(day)),
        "New date sent to the patient",
      );
    }
    if (mode === "cancel") {
      if (reason.trim().length < 3)
        return setProblem("Say why the order is cancelled.");
      return run(
        () => cancelOrder(order.id, reason.trim()),
        "Cancelled. The refund is on its way to the patient.",
      );
    }
  };

  const title =
    mode === "dispatch"
      ? `Dispatch ${order.orderNumber}`
      : mode === "deliver"
        ? `Mark ${order.orderNumber} delivered`
        : mode === "delay"
          ? "A new expected date"
          : mode === "cancel"
            ? `Cancel ${order.orderNumber}`
            : order.orderNumber;

  return (
    <Sheet open onClose={onClose} title={title}>
      <div className={s.sheet}>
        {mode === "view" ? (
          <>
            <dl className={s.facts}>
              <div>
                <dt>Status</dt>
                <dd>{ORDER_WORDS[order.status]}</dd>
              </div>
              <div>
                <dt>Patient</dt>
                <dd>
                  <button
                    type="button"
                    className={adminStyles.textBtn}
                    onClick={() => onOpenPatient(order.patientId)}
                  >
                    {order.patientName}
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </dd>
              </div>
              <div>
                <dt>Mobile</dt>
                <dd>
                  <a href={`tel:+91${order.patientMobile}`} className="num">
                    <Phone size={14} aria-hidden="true" />{" "}
                    {spacedMobile(order.patientMobile)}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Deliver to</dt>
                <dd>{order.address || "No address on the order"}</dd>
              </div>
              <div>
                <dt>In the order</dt>
                <dd>
                  {order.items.map((i) => (
                    <span key={i.name} className={s.lineItem}>
                      {i.name}, <span className="num">{i.quantity}</span>
                    </span>
                  ))}
                </dd>
              </div>
              {order.courier && (
                <div>
                  <dt>Courier</dt>
                  <dd>
                    {order.courier}
                    {order.trackingUrl ? (
                      <>
                        {", "}
                        <a
                          href={order.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          tracking
                        </a>
                      </>
                    ) : order.trackingNo ? (
                      <span className="num">, {order.trackingNo}</span>
                    ) : null}
                  </dd>
                </div>
              )}
              {order.expectedAt && onTheWay && (
                <div>
                  <dt>Expected</dt>
                  <dd className="num">{when(order.expectedAt)}</dd>
                </div>
              )}
              <div>
                <dt>Paid</dt>
                <dd className="num">{when(order.placedAt)}</dd>
              </div>
            </dl>
            {/* a delivered order is not refunded from here: the patient has it (call them first) */}
            {onTheWay && (
              <div className={adminStyles.actions}>
                <button
                  type="button"
                  className={adminStyles.textBtn}
                  onClick={() => setMode("delay")}
                >
                  Give a new expected date
                </button>
                <button
                  type="button"
                  className={adminStyles.textBtn}
                  onClick={() => setMode("cancel")}
                >
                  Cancel and refund
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={s.formGrid}>
            {mode === "dispatch" && (
              <>
                <label className={formStyles.field}>
                  <span className={formStyles.label}>Courier</span>
                  <input
                    className={s.input}
                    value={courier}
                    maxLength={60}
                    placeholder="Delhivery, Shiprocket, our rider"
                    onChange={(e) => setCourier(e.target.value)}
                  />
                </label>
                <label className={formStyles.field}>
                  <span className={formStyles.label}>
                    Tracking link or number
                  </span>
                  <input
                    className={s.input}
                    value={tracking}
                    maxLength={300}
                    inputMode="url"
                    placeholder="https://..."
                    onChange={(e) => setTracking(e.target.value)}
                  />
                  <span className={formStyles.hint}>
                    A link the patient can open is best. A link must start with
                    https://.
                  </span>
                </label>
              </>
            )}
            {(mode === "dispatch" || mode === "delay") && (
              <div className={formStyles.field}>
                <span className={formStyles.label} aria-hidden="true">
                  {mode === "delay" ? "New expected date" : "Expected by"}
                </span>
                <DatePicker
                  value={day}
                  min={toApiDate(new Date())}
                  label={mode === "delay" ? "New expected date" : "Expected by"}
                  onChange={setDay}
                />
                {mode === "delay" && (
                  <span className={formStyles.hint}>
                    The patient gets the new date on WhatsApp, with an apology.
                  </span>
                )}
              </div>
            )}
            {mode === "deliver" && (
              <p className={adminStyles.confirm}>
                The patient is told the order has arrived and, two hours later,
                asked whether it came as it should. A delivered order cannot be
                moved back.
              </p>
            )}
            {mode === "cancel" && (
              <>
                <p className={adminStyles.confirm}>
                  The patient is refunded in full (
                  {order.items.length === 1
                    ? "one item"
                    : `${order.items.length} items`}
                  ) and told on WhatsApp. Upcoming dose reminders from this
                  order stop. This cannot be undone.
                </p>
                <label className={formStyles.field}>
                  <span className={formStyles.label}>
                    Reason (the patient sees this)
                  </span>
                  <textarea
                    className={s.textarea}
                    value={reason}
                    maxLength={500}
                    placeholder="Out of stock, or damaged in transit"
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              </>
            )}
            {problem && (
              <p className={formStyles.err} role="alert">
                {problem}
              </p>
            )}
            <div className={adminStyles.actions}>
              <button
                type="button"
                className={`btn ${formStyles.go}`}
                data-busy={busy}
                aria-busy={busy}
                disabled={busy}
                onClick={submit}
              >
                <span>
                  {busy
                    ? "Saving"
                    : mode === "dispatch"
                      ? "Dispatch and tell the patient"
                      : mode === "deliver"
                        ? "Mark delivered"
                        : mode === "delay"
                          ? "Send the new date"
                          : "Cancel and refund"}
                </span>
                <span className="well" aria-hidden="true">
                  {busy ? (
                    <i className={formStyles.spin} />
                  ) : (
                    <ArrowRight size={18} />
                  )}
                </span>
              </button>
              {start === "view" && (
                <button
                  type="button"
                  className={adminStyles.textBtn}
                  disabled={busy}
                  onClick={() => setMode("view")}
                >
                  Back
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
