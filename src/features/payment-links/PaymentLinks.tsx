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
import surfaceStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

const STATUS: Record<PaymentLink["status"], string> = {
  CREATED: "Waiting for payment",
  PAID: "Paid",
  CANCELLED: "Withdrawn",
  EXPIRED: "Ended unpaid",
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
      toast("Link copied. Send it to the customer.");
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
                ? `, made ${shortDate(link.createdAt)}, good until ${shortDate(link.expiresAt)}`
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
            <span className={s.chips}>
              <button
                type="button"
                className={s.chip}
                onClick={() => copy(link.url)}
              >
                Copy the link
              </button>
              <button
                type="button"
                className={s.chip}
                disabled={busy}
                onClick={() => act(link.id, "check")}
              >
                Check if paid
              </button>
              <button
                type="button"
                className={s.chip}
                disabled={busy}
                onClick={() => act(link.id, "cancel")}
              >
                Withdraw
              </button>
              {sellers && link.test && (
                <button
                  type="button"
                  className={s.chip}
                  disabled={busy}
                  onClick={() => act(link.id, "simulate")}
                >
                  Play the payment (test)
                </button>
              )}
            </span>
          )}
        </span>
      ))}
      {canMake &&
        (!making ? (
          <span className={s.chips}>
            <button
              type="button"
              className={s.chip}
              onClick={() => setMaking(true)}
            >
              {links.some((l) => l.status === "CREATED")
                ? "Make a new link instead"
                : "Make a payment link"}
            </button>
          </span>
        ) : (
          <div className={s.planForm}>
            <SegmentedControl
              label="Plan length"
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
                  <input
                    className={s.input}
                    inputMode="numeric"
                    value={discount}
                    placeholder={`Discount in percent, up to ${most}`}
                    aria-label={`Discount in percent, up to ${most}`}
                    onChange={(e) =>
                      setDiscount(e.target.value.replace(/\D/g, "").slice(0, 2))
                    }
                  />
                )}
                <span className="num">
                  {plan.name}: the customer pays {formatRupees(amount)}
                  {percent > 0
                    ? `, ${percent}% off ${formatRupees(plan.priceRupees)}`
                    : ""}
                </span>
              </>
            )}
            {sellers && (
              <select
                className={s.input}
                value={sellers.some((p) => p.id === seller) ? seller : ""}
                aria-label="Sold by"
                onChange={(e) => setSeller(e.target.value)}
              >
                <option value="">Sold by: not recorded</option>
                {sellers.map((p) => (
                  <option key={p.id} value={p.id}>
                    Sold by {p.label}
                  </option>
                ))}
              </select>
            )}
            <input
              className={s.input}
              value={coachPreference}
              maxLength={200}
              placeholder="The coach they asked for (language, timing), if any"
              aria-label="The kind of coach the customer asked for"
              onChange={(e) => setCoachPreference(e.target.value)}
            />
            <input
              className={s.input}
              value={note}
              maxLength={1000}
              placeholder="Remarks from the sale, if any"
              aria-label="Remarks from the sale"
              onChange={(e) => setNote(e.target.value)}
            />
            <span className={surfaceStyles.muted}>
              When the customer pays, the plan starts by itself and the payment
              is recorded. The link is good for 7 days.
            </span>
            {problem && (
              <span className={s.problem} role="alert">
                {problem}
              </span>
            )}
            <span className={s.chips}>
              <button
                type="button"
                className={s.chip}
                disabled={!plan || busy}
                onClick={make}
              >
                {busy ? "Making the link" : "Make the link"}
              </button>
              <button
                type="button"
                className={s.chip}
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
