"use client";

/*
  One delivery. Opened from "Dispatch" it is the dispatch form (courier, tracking link or number,
  expected date: the patient gets them on WhatsApp). Otherwise it shows where the order goes, what is in
  it and every step so far, with the two rarer actions: a new expected date (the patient is told), and
  cancel with a full refund, which asks for the reason and confirms the consequence first.
*/

import { useEffect, useState } from "react";
import { ArrowRight, Phone } from "@phosphor-icons/react";
import Sheet from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/ToastProvider";
import { spacedMobile } from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import {
  cancelOrder,
  delayOrder,
  moveOrder,
} from "@/services/medicineOpsService";
import type { OpsOrder } from "@/types/medicineOps";
import { ORDER_WORDS, when } from "./words";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";
import s from "./Medicine.module.css";

const dateInput = (d: Date) =>
  new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
/** An India-time day as the end of that day's deliveries (7 pm). */
const dayToIso = (day: string) =>
  new Date(`${day}T19:00:00+05:30`).toISOString();

type Mode = "view" | "dispatch" | "delay" | "cancel";

export default function OrderSheet({
  order,
  dispatch,
  onClose,
  onOpenPatient,
  onChanged,
}: {
  order: OpsOrder | null;
  dispatch: boolean;
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
    setMode(dispatch ? "dispatch" : "view");
    setCourier(order?.courier ?? "");
    setTracking(order?.trackingUrl ?? order?.trackingNo ?? "");
    setDay(
      dateInput(
        order?.expectedAt
          ? new Date(order.expectedAt)
          : new Date(Date.now() + 2 * 86400_000),
      ),
    );
    setReason("");
    setProblem(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    order?.id,
    dispatch,
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
      const link = /^https:\/\//.test(tracking.trim());
      return run(
        () =>
          moveOrder(order.id, {
            to: "DISPATCHED",
            courier: courier.trim(),
            ...(link
              ? { trackingUrl: tracking.trim() }
              : { trackingNo: tracking.trim() }),
            expectedAt: dayToIso(day),
          }),
        `${order.orderNumber} dispatched. The patient has the tracking.`,
      );
    }
    if (mode === "delay")
      return run(
        () => delayOrder(order.id, dayToIso(day)),
        "New date sent to the patient",
      );
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
            {order.status !== "CANCELLED" && (
              <div className={adminStyles.actions}>
                {onTheWay && (
                  <button
                    type="button"
                    className={adminStyles.textBtn}
                    onClick={() => setMode("delay")}
                  >
                    Give a new expected date
                  </button>
                )}
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
              <label className={formStyles.field}>
                <span className={formStyles.label}>
                  {mode === "delay" ? "New expected date" : "Expected by"}
                </span>
                <input
                  type="date"
                  className={s.input}
                  value={day}
                  min={dateInput(new Date())}
                  onChange={(e) => setDay(e.target.value)}
                />
                {mode === "delay" && (
                  <span className={formStyles.hint}>
                    The patient gets the new date on WhatsApp, with an apology.
                  </span>
                )}
              </label>
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
                  <span className={formStyles.label}>Reason</span>
                  <textarea
                    className={s.textarea}
                    value={reason}
                    maxLength={500}
                    placeholder="Out of stock, damaged in transit, patient asked"
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
                onClick={submit}
              >
                <span>
                  {busy
                    ? "Saving"
                    : mode === "dispatch"
                      ? "Dispatch and tell the patient"
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
              {!dispatch && (
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
