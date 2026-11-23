"use client";

/*
  Payments (23 Nov 2026 call): who has paid, and for what. Every payment link, the waiting ones first, with
  the patient it was made for; a paid one has started that patient's plan by itself. Below, money Razorpay
  took that belongs to no order or link of ours (a link made in the Razorpay dashboard, a QR code): each is
  matched to the patient whose mobile number paid it, so admin opens that patient and records it against
  their plan ("Paid another way", with this payment ID), or sets it aside when it is not for a plan.
*/

import { useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { formatRupees } from "@/lib/format/money";
import { spacedMobile } from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import {
  actOnPaymentLink,
  getPayments,
  setPaymentAside,
} from "@/services/medicineOpsService";
import { when } from "@/features/medicine-queue/words";
import type { PaymentLink } from "@/types/sales";
import adminStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

const STATUS: Record<PaymentLink["status"], string> = {
  CREATED: "Waiting",
  PAID: "Paid",
  CANCELLED: "Withdrawn",
  EXPIRED: "Ended unpaid",
};
const TONE: Record<PaymentLink["status"], string | undefined> = {
  CREATED: "pending",
  PAID: "ok",
  CANCELLED: undefined,
  EXPIRED: undefined,
};

export default function PaymentsPanel({
  version,
  onOpenPatient,
  onChanged,
}: {
  version: number;
  onOpenPatient: (id: string) => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const payments = useApiResource(`admin-payments-${version}`, getPayments);
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<string | void>) => {
    if (busy) return;
    setBusy(true);
    try {
      const words = await work();
      if (words) toast(words);
      payments.reload();
      onChanged();
    } catch (caught) {
      toast(errorMessage(caught, "That did not work. Try again."));
    } finally {
      setBusy(false);
    }
  };

  if (payments.error && !payments.data)
    return <ErrorNotice message={payments.error} onRetry={payments.reload} />;
  if (!payments.data) return <LoadingSkeleton />;
  const { links, received } = payments.data;

  return (
    <div className={s.sheet}>
      {received.length > 0 && (
        <section className={adminStyles.panel} aria-labelledby="received-h">
          <div className={adminStyles.panelHead}>
            <h2 id="received-h" className={adminStyles.h2}>
              Paid outside a link
            </h2>
          </div>
          <ul className={s.rows}>
            {received.map((r) => (
              <li key={r.id}>
                <div className={s.row}>
                  <button
                    type="button"
                    className={s.open}
                    disabled={!r.patientId}
                    onClick={() => r.patientId && onOpenPatient(r.patientId)}
                  >
                    <span className={`${s.what} num`}>
                      {formatRupees(r.amountRupees)},{" "}
                      {r.patientName ?? "no patient with this number"}
                    </span>
                    <span className={s.sub}>
                      {r.mobile && (
                        <span className="num">{spacedMobile(r.mobile)}</span>
                      )}
                      <span className="num">{when(r.capturedAt)}</span>
                      <span className="num">Payment ID {r.id}</span>
                      {r.method && <span>{r.method}</span>}
                    </span>
                  </button>
                  <span className={s.side}>
                    <button
                      type="button"
                      className={s.chip}
                      disabled={busy}
                      onClick={() => run(() => setPaymentAside(r.id))}
                    >
                      Not for a plan
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className={adminStyles.muted}>
            To start a plan from one of these, open the patient, choose
            &quot;Paid another way&quot; under Plan and enter this payment ID.
          </p>
        </section>
      )}

      <section className={adminStyles.panel} aria-labelledby="links-h">
        <div className={adminStyles.panelHead}>
          <h2 id="links-h" className={adminStyles.h2}>
            Payment links
          </h2>
        </div>
        {links.length === 0 ? (
          <p className={adminStyles.empty}>
            No payment links yet. Make one from a patient, under Plan.
          </p>
        ) : (
          <ul className={s.rows}>
            {links.map((link) => (
              <li key={link.id}>
                <div className={s.row}>
                  <button
                    type="button"
                    className={s.open}
                    onClick={() => onOpenPatient(link.patientId)}
                  >
                    <span className={`${s.what} num`}>
                      {link.patientName}: {link.planName},{" "}
                      {formatRupees(link.amountRupees)}
                    </span>
                    <span className={s.sub}>
                      {link.patientMobile && (
                        <span className="num">
                          {spacedMobile(link.patientMobile)}
                        </span>
                      )}
                      <span className="num">
                        {link.status === "PAID" && link.paidAt
                          ? `Paid ${when(link.paidAt)}`
                          : `Made ${when(link.createdAt)}`}
                      </span>
                      {link.salesperson && (
                        <span>Sold by {link.salesperson}</span>
                      )}
                      {link.paymentId && (
                        <span className="num">Payment ID {link.paymentId}</span>
                      )}
                      {link.needsAttention && (
                        <span className={s.problem}>{link.needsAttention}</span>
                      )}
                    </span>
                  </button>
                  <span className={s.side}>
                    <span
                      className={adminStyles.pill}
                      data-tone={TONE[link.status]}
                    >
                      {STATUS[link.status]}
                    </span>
                    {link.status === "CREATED" && (
                      <button
                        type="button"
                        className={s.chip}
                        disabled={busy}
                        onClick={() =>
                          run(() => actOnPaymentLink(link.id, "check"))
                        }
                      >
                        Check if paid
                      </button>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
