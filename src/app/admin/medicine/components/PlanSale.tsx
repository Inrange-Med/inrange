"use client";

/*
  The patient's plan, and the sales form (19 Nov 2026 call). The doctor never chooses a plan: a salesperson
  sells it on the call and tells admin what was sold. Three states:
  - On a plan: its name and end, and how it was sold and paid for (who sold it, the coach asked for, the
    payment ID). Read only.
  - Put on a plan, not paid yet: it waits in the patient's app (with any medicines, one payment). Change it
    or withdraw it.
  - No plan: the form. The length, who sold it, the kind of coach the customer asked for, a note, and how
    it is paid: in the app (the usual way; the amount and payment ID then come from that payment by
    themselves), or already paid outside the app (a payment link, a transfer): admin types the amount and
    its payment ID and the plan starts at once.
*/

import { useState } from "react";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { shortDate } from "@/lib/format/dateTime";
import { formatRupees } from "@/lib/format/money";
import { errorMessage } from "@/lib/http/apiClient";
import { assignPlan, listSalespeople } from "@/services/medicineOpsService";
import { listPlans } from "@/services/subscriptionService";
import type { OpsPatient } from "@/types/medicineOps";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";
import s from "./Medicine.module.css";

type Paying = "APP" | "OUTSIDE";

export default function PlanSale({
  data,
  onSaved,
}: {
  data: OpsPatient;
  onSaved: () => void;
}) {
  const toast = useToast();
  const plans = useApiResource("plans-for-assigning", listPlans);
  const team = useApiResource("salespeople", listSalespeople);
  const sellers = team.data?.filter((p) => p.active) ?? [];
  const { patient } = data;
  const assigned = patient.assignedPlan;
  const [choosing, setChoosing] = useState(false);
  const [planId, setPlanId] = useState(assigned?.planId ?? "");
  // whoever sold it: the plan's seller, else the patient's salesperson
  const [seller, setSeller] = useState(
    assigned?.salespersonId ?? patient.salespersonId ?? "",
  );
  const [coachPreference, setCoachPreference] = useState(
    assigned?.coachPreference ?? "",
  );
  const [note, setNote] = useState(assigned?.note ?? "");
  const [paying, setPaying] = useState<Paying>("APP");
  const [amount, setAmount] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sale = patient.planSale;
  if (patient.plan)
    return (
      <>
        <span className={s.lineItem}>
          {patient.plan}
          {patient.planEndsAt ? `, until ${shortDate(patient.planEndsAt)}` : ""}
        </span>
        {sale && (
          <>
            <span className={`${s.lineItem} ${adminStyles.muted}`}>
              {sale.paid
                ? sale.paid.where === "APP"
                  ? `Paid in the app${sale.paid.at ? `, ${shortDate(sale.paid.at)}` : ""}. Payment ID `
                  : `Paid outside the app${sale.paid.amountRupees != null ? `, ${formatRupees(sale.paid.amountRupees)}` : ""}. Payment ID `
                : "Started without a payment on record."}
              {sale.paid && <span className="num">{sale.paid.ref}</span>}
            </span>
            {(sale.salesperson || sale.coachPreference) && (
              <span className={`${s.lineItem} ${adminStyles.muted}`}>
                {[
                  sale.salesperson && `Sold by ${sale.salesperson}`,
                  sale.coachPreference &&
                    `Coach asked for: ${sale.coachPreference}`,
                ]
                  .filter(Boolean)
                  .join(". ")}
              </span>
            )}
            {sale.note && (
              <span className={`${s.lineItem} ${adminStyles.muted}`}>
                Note: {sale.note}
              </span>
            )}
          </>
        )}
      </>
    );

  const save = async (withdraw = false) => {
    if (busy) return;
    const rupees = Number(amount);
    if (!withdraw && paying === "OUTSIDE") {
      if (!(rupees > 0)) return setProblem("Add the amount received.");
      if (paymentRef.trim().length < 4)
        return setProblem("Add the payment ID of that payment.");
    }
    setBusy(true);
    setProblem(null);
    try {
      toast(
        await assignPlan(
          patient.id,
          withdraw
            ? null
            : {
                planId,
                salespersonId: seller || null,
                coachPreference: coachPreference.trim(),
                note: note.trim(),
                paidOutside:
                  paying === "OUTSIDE"
                    ? { amountRupees: rupees, paymentRef: paymentRef.trim() }
                    : null,
              },
        ),
      );
      setChoosing(false);
      onSaved();
    } catch (caught) {
      setProblem(errorMessage(caught, "The plan could not be changed."));
    } finally {
      setBusy(false);
    }
  };

  if (!choosing)
    return (
      <>
        <span className={s.lineItem}>
          {assigned ? (
            <>
              {assigned.name},{" "}
              <span className="num">{formatRupees(assigned.priceRupees)}</span>:
              waiting for the patient to pay in the app
            </>
          ) : (
            "No plan yet"
          )}
        </span>
        {assigned && (
          <span className={`${s.lineItem} ${adminStyles.muted}`}>
            {[
              `Put on it ${shortDate(assigned.assignedAt)}`,
              assigned.salesperson && `sold by ${assigned.salesperson}`,
              assigned.coachPreference &&
                `coach asked for: ${assigned.coachPreference}`,
            ]
              .filter(Boolean)
              .join(", ")}
            {assigned.note ? `. Note: ${assigned.note}` : ""}
          </span>
        )}
        {problem && (
          <span className={`${s.lineItem} ${s.problem}`} role="alert">
            {problem}
          </span>
        )}
        <span className={s.chips}>
          <button
            type="button"
            className={s.chip}
            disabled={busy}
            onClick={() => setChoosing(true)}
          >
            {assigned ? "Change the sale" : "Fill in the sales form"}
          </button>
          {assigned && (
            <button
              type="button"
              className={s.chip}
              disabled={busy}
              onClick={() => save(true)}
            >
              Withdraw it
            </button>
          )}
        </span>
      </>
    );

  const offered = (plans.data ?? []).filter(
    (plan) => plan.isActive && plan.priceRupees,
  );
  const chosen = offered.find((plan) => String(plan.id) === planId);
  return (
    <div className={s.planForm}>
      {plans.error && !plans.data ? (
        <span className={adminStyles.muted}>The plans could not load.</span>
      ) : (
        <SegmentedControl
          label="Plan length"
          value={planId}
          options={offered.map((plan) => ({
            value: String(plan.id),
            label: `${plan.durationMonths} months`,
          }))}
          onChange={(id) => {
            setPlanId(id);
            const plan = offered.find((p) => String(p.id) === id);
            // the amount starts at the plan's price; admin corrects it if less was taken
            if (plan?.priceRupees) setAmount(String(plan.priceRupees));
          }}
        />
      )}
      {chosen && (
        <span className="num">
          {chosen.name}, {formatRupees(chosen.priceRupees!)}
        </span>
      )}
      <select
        className={s.input}
        value={sellers.some((p) => p.id === seller) ? seller : ""}
        aria-label="Sold by"
        onChange={(e) => setSeller(e.target.value)}
      >
        <option value="">Sold by: not recorded</option>
        {sellers.map((p) => (
          <option key={p.id} value={p.id}>
            Sold by {p.rank}. {p.fullName}
          </option>
        ))}
      </select>
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
        placeholder="Anything else from the sale, if any"
        aria-label="Note from the sale"
        onChange={(e) => setNote(e.target.value)}
      />
      <SegmentedControl
        label="How it is paid"
        value={paying}
        options={[
          { value: "APP", label: "Patient pays in the app" },
          { value: "OUTSIDE", label: "Already paid outside" },
        ]}
        onChange={setPaying}
      />
      {paying === "OUTSIDE" && (
        <>
          <input
            className={s.input}
            inputMode="numeric"
            value={amount}
            placeholder="Amount received, in rupees"
            aria-label="Amount received, in rupees"
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          />
          <input
            className={s.input}
            value={paymentRef}
            maxLength={80}
            placeholder="Payment ID (from Razorpay or the bank)"
            aria-label="Payment ID"
            onChange={(e) => setPaymentRef(e.target.value)}
          />
          <span className={adminStyles.muted}>
            The plan starts now and the app does not ask the patient to pay for
            it.
          </span>
        </>
      )}
      {problem && (
        <span className={s.problem} role="alert">
          {problem}
        </span>
      )}
      <span className={s.chips}>
        <button
          type="button"
          className={s.chip}
          disabled={!chosen || busy}
          onClick={() => save()}
        >
          {busy
            ? "Saving"
            : paying === "OUTSIDE"
              ? "Start this plan"
              : "Put on this plan"}
        </button>
        <button
          type="button"
          className={s.chip}
          disabled={busy}
          onClick={() => {
            setChoosing(false);
            setProblem(null);
          }}
        >
          Cancel
        </button>
      </span>
    </div>
  );
}
