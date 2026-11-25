"use client";

/*
  A patient's payment links, and the sales form that makes one (23 Nov 2026 call). Used by admin's patient
  sheet and by the salesperson's customer sheet; each passes its own calls, so this never decides who may do
  what (the API does).
  The form: the plan's length, the discount (up to what the plan allows this person), the kind of coach the
  customer asked for and anything else from the sale. The link is then copied and sent to the customer by any
  means; Razorpay also texts it. When it is paid the plan starts by itself, with the amount and the payment ID
  recorded from the payment: nobody types them. One link waits at a time: a new one replaces the last.
*/

import { useState } from "react";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/ToastProvider";
import { shortDate } from "@/lib/format/dateTime";
import { formatRupees } from "@/lib/format/money";
import { errorMessage } from "@/lib/http/apiClient";
import type { LinkForm, PaymentLink, PlanOnSale } from "@/types/sales";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import surfaceStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";
import a from "@/features/medicine-queue/OpsActions.module.css";

const STATUS: Record<PaymentLink["status"], string> = {
  CREATED: "Not paid yet",
  PAID: "Paid",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export default function PaymentLinks({
  links,
  plans,
  canMake,
  anyDiscount = false,
  sellers,
  defaultSeller = "",
  onMake,
  onAct,
  onChanged,
}: {
  links: PaymentLink[];
  plans: PlanOnSale[];
  /** false once the patient is on a plan */
  canMake: boolean;
  /** admin: any discount up to 90%; a salesperson: up to the plan's own limit */
  anyDiscount?: boolean;
  /** admin chooses who sold it; a salesperson's links are their own */
  sellers?: { id: string; label: string }[];
  defaultSeller?: string;
  /** makes the link; resolves with its address and the server's words */
  onMake: (form: LinkForm) => Promise<{ url: string; message: string }>;
  /** `simulate` is offered only for a test link (admin, dry runs) */
  onAct: (
    id: string,
    action: "check" | "cancel" | "simulate",
  ) => Promise<string>;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [making, setMaking] = useState(false);
  const [planId, setPlanId] = useState("");
  const [discount, setDiscount] = useState("");
  const [coachPreference, setCoachPreference] = useState("");
  const [note, setNote] = useState("");
  const [seller, setSeller] = useState(defaultSeller);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const plan = plans.find((p) => p.id === planId);
  const most = plan ? (anyDiscount ? 90 : plan.maxDiscountPercent) : 0;
  const percent = Number(discount) || 0;
  const amount = plan
    ? Math.round((plan.priceRupees * (100 - percent)) / 100)
    : 0;

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied. Send it to them.");
    } catch {
      toast(url);
    }
  };

  const act = async (id: string, action: "check" | "cancel" | "simulate") => {
    if (busy) return;
    setBusy(true);
    try {
      toast(await onAct(id, action));
      onChanged();
    } catch (caught) {
      toast(errorMessage(caught, "That did not work. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const make = async () => {
    if (busy || !plan) return;
    if (!Number.isInteger(percent) || percent < 0 || percent > most)
      return setProblem(
        most
          ? `The discount is a whole number from 0 to ${most}.`
          : "This plan has no discount.",
      );
    setBusy(true);
    setProblem(null);
    try {
      const made = await onMake({
        planId: plan.id,
        discountPercent: percent,
        coachPreference: coachPreference.trim(),
        note: note.trim(),
        ...(sellers ? { salespersonId: seller || null } : {}),
      });
      toast(made.message);
      await copy(made.url);
      setMaking(false);
      onChanged();
    } catch (caught) {
      setProblem(errorMessage(caught, "The link could not be made."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {links.slice(0, 4).map((link) => (
        <span key={link.id} className={s.lineItem}>
          <span>
            {link.planName},{" "}
            <span className="num">{formatRupees(link.amountRupees)}</span>
            {link.listRupees > link.amountRupees && (
              <span className={surfaceStyles.muted}>
                {" "}
                (list {formatRupees(link.listRupees)})
              </span>
            )}
            . {STATUS[link.status]}
            {link.status === "PAID" && link.paidAt
              ? ` ${shortDate(link.paidAt)}`
              : link.status === "CREATED"
                ? `. Made ${shortDate(link.createdAt)}, ends ${shortDate(link.expiresAt)}`
                : ""}
            .
          </span>
          {link.paymentId && (
            <span className={`${s.lineItem} ${surfaceStyles.muted}`}>
              Payment ID <span className="num">{link.paymentId}</span>
              {link.salesperson ? `. Sold by ${link.salesperson}` : ""}
            </span>
          )}
          {link.needsAttention && (
            <span className={`${s.lineItem} ${s.problem}`}>
              {link.needsAttention}
            </span>
          )}
          {link.status === "CREATED" && (
            <span className={a.actions}>
              <button
                type="button"
                className={a.btn}
                onClick={() => copy(link.url)}
              >
                Copy link
              </button>
              <button
                type="button"
                className={surfaceStyles.textBtn}
                disabled={busy}
                onClick={() => act(link.id, "check")}
              >
                Check if paid
              </button>
              <button
                type="button"
                className={surfaceStyles.textBtn}
                disabled={busy}
                onClick={() => act(link.id, "cancel")}
              >
                Cancel link
              </button>
              {sellers && link.test && (
                <button
                  type="button"
                  className={surfaceStyles.textBtn}
                  disabled={busy}
                  onClick={() => act(link.id, "simulate")}
                >
                  Test: mark paid
                </button>
              )}
            </span>
          )}
        </span>
      ))}
      {canMake &&
        (!making ? (
          <span className={a.actions}>
            {links.some((l) => l.status === "CREATED") ? (
              <button
                type="button"
                className={surfaceStyles.textBtn}
                onClick={() => setMaking(true)}
              >
                Make a new link
              </button>
            ) : (
              <button
                type="button"
                className={a.btn}
                onClick={() => setMaking(true)}
              >
                Make payment link
              </button>
            )}
          </span>
        ) : (
          <div className={a.form}>
            <>
              <SegmentedControl
                label="Plan"
                value={planId}
                options={plans.map((p) => ({
                  value: p.id,
                  label: `${p.months} months`,
                }))}
                onChange={(id) => {
                  setPlanId(id);
                  setDiscount("");
                  setProblem(null);
                }}
              />
            </>
            {plan && (
              <>
                <span className={surfaceStyles.muted}>
                  {[
                    plan.doctorConsults != null &&
                      `${plan.doctorConsults} doctor consultations`,
                    plan.coachCalls != null && `${plan.coachCalls} coach calls`,
                    plan.fitnessCalls != null &&
                      `${plan.fitnessCalls} fitness calls`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
                {most > 0 && (
                  <label className={formStyles.field}>
                    <span className={formStyles.label}>
                      Discount %, up to {most}
                    </span>
                    <input
                      className={s.input}
                      inputMode="numeric"
                      value={discount}
                      placeholder="0"
                      onChange={(e) =>
                        setDiscount(
                          e.target.value.replace(/\D/g, "").slice(0, 2),
                        )
                      }
                    />
                  </label>
                )}
                <span className="num">
                  {plan.name}. Customer pays {formatRupees(amount)}
                  {percent > 0
                    ? ` (${percent}% off ${formatRupees(plan.priceRupees)})`
                    : ""}
                </span>
              </>
            )}
            {sellers && (
              <label className={formStyles.field}>
                <span className={formStyles.label}>Sold by</span>
                <select
                  className={s.input}
                  value={sellers.some((p) => p.id === seller) ? seller : ""}
                  onChange={(e) => setSeller(e.target.value)}
                >
                  <option value="">Not recorded</option>
                  {sellers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className={formStyles.field}>
              <span className={formStyles.label}>Coach request</span>
              <input
                className={s.input}
                value={coachPreference}
                maxLength={200}
                placeholder="Language, timing"
                onChange={(e) => setCoachPreference(e.target.value)}
              />
            </label>
            <label className={formStyles.field}>
              <span className={formStyles.label}>Remarks</span>
              <input
                className={s.input}
                value={note}
                maxLength={1000}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <span className={surfaceStyles.muted}>
              The plan starts when they pay. The link lasts 7 days.
            </span>
            {problem && (
              <span className={s.problem} role="alert">
                {problem}
              </span>
            )}
            <span className={a.actions}>
              <button
                type="button"
                className={a.btn}
                disabled={!plan || busy}
                onClick={make}
              >
                {busy ? "Making" : "Make link"}
              </button>
              <button
                type="button"
                className={surfaceStyles.textBtn}
                disabled={busy}
                onClick={() => {
                  setMaking(false);
                  setProblem(null);
                }}
              >
                Cancel
              </button>
            </span>
          </div>
        ))}
    </>
  );
}
