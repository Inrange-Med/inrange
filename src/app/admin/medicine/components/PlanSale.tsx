"use client";

/*
  The patient's plan, as its own section of the patient sheet (19 Nov 2026 call). The doctor never chooses a
  plan: a salesperson sells it on the call and tells admin what was sold. Three states:
  - On a plan: label and value rows: the plan, its end, how it was paid, the payment ID, who sold it, the
    coach asked for, the note. Read only.
  - Put on a plan, not paid yet: it waits in the patient's app (with any medicines, one payment). "Change"
    or "Remove plan".
  - No plan: a payment link (PaymentLinks, under this in the sheet) is the usual way since the 23 Nov 2026
    call: its payment starts the plan by itself. "Add plan without a link" opens the form for the other two
    ways: the length, who sold it, the coach the customer asked for, a note, and how it is paid: in the app
    (the amount and payment ID then come from that payment by themselves), or already paid outside the app
    (a transfer, a Razorpay dashboard link): admin types the amount and its payment ID and the plan starts
    at once.
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
import formStyles from "@/components/ui/styles/FormControls.module.css";
import adminStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";
import a from "@/features/medicine-queue/OpsActions.module.css";

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
      <dl className={s.facts}>
        <div>
          <dt>Plan</dt>
          <dd>{patient.plan}</dd>
        </div>
        {patient.planEndsAt && (
          <div>
            <dt>Ends</dt>
            <dd className="num">{shortDate(patient.planEndsAt)}</dd>
          </div>
        )}
        {sale && (
          <>
            <div>
              <dt>Paid</dt>
              <dd className="num">
                {sale.paid
                  ? [
                      sale.paid.where === "APP"
                        ? "In the app"
                        : sale.paid.where === "LINK"
                          ? "Payment link"
                          : "Outside the app",
                      sale.paid.where !== "APP" &&
                        sale.paid.amountRupees != null &&
                        formatRupees(sale.paid.amountRupees),
                      sale.paid.where !== "OUTSIDE" &&
                        sale.paid.at &&
                        shortDate(sale.paid.at),
                    ]
                      .filter(Boolean)
                      .join(", ")
                  : "No payment on record"}
              </dd>
            </div>
            {sale.paid && (
              <div>
                <dt>Payment ID</dt>
                <dd className="num">{sale.paid.ref}</dd>
              </div>
            )}
            {sale.salesperson && (
              <div>
                <dt>Sold by</dt>
                <dd>{sale.salesperson}</dd>
              </div>
            )}
            {sale.coachPreference && (
              <div>
                <dt>Coach request</dt>
                <dd>{sale.coachPreference}</dd>
              </div>
            )}
            {sale.note && (
              <div>
                <dt>Note</dt>
                <dd>{sale.note}</dd>
              </div>
            )}
          </>
        )}
      </dl>
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
        {assigned ? (
          <dl className={s.facts}>
            <div>
              <dt>Plan</dt>
              <dd>
                {assigned.name},{" "}
                <span className="num">
                  {formatRupees(assigned.priceRupees)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>Not paid yet. They pay in the app.</dd>
            </div>
            <div>
              <dt>Added</dt>
              <dd className="num">{shortDate(assigned.assignedAt)}</dd>
            </div>
            {assigned.salesperson && (
              <div>
                <dt>Sold by</dt>
                <dd>{assigned.salesperson}</dd>
              </div>
            )}
            {assigned.coachPreference && (
              <div>
                <dt>Coach request</dt>
                <dd>{assigned.coachPreference}</dd>
              </div>
            )}
            {assigned.note && (
              <div>
                <dt>Note</dt>
                <dd>{assigned.note}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className={adminStyles.empty}>
            {data.links.some((link) => link.status === "CREATED")
              ? "No plan. Payment link sent."
              : "No plan."}
          </p>
        )}
        {problem && (
          <span className={s.problem} role="alert">
            {problem}
          </span>
        )}
        <div className={a.actions}>
          <button
            type="button"
            className={adminStyles.textBtn}
            disabled={busy}
            onClick={() => setChoosing(true)}
          >
            {assigned ? "Change" : "Add plan without a link"}
          </button>
          {assigned && (
            <button
              type="button"
              className={adminStyles.textBtn}
              disabled={busy}
              onClick={() => save(true)}
            >
              Remove plan
            </button>
          )}
        </div>
      </>
    );

  const offered = (plans.data ?? []).filter(
    (plan) => plan.isActive && plan.priceRupees,
  );
  const chosen = offered.find((plan) => String(plan.id) === planId);
  return (
    <div className={a.form}>
      {plans.error && !plans.data ? (
        <span className={adminStyles.muted}>The plans could not load.</span>
      ) : (
        <span className={s.seg}>
          <SegmentedControl
            label="Plan"
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
        </span>
      )}
      {chosen && (
        <span className="num">
          {chosen.name}, {formatRupees(chosen.priceRupees!)}
        </span>
      )}
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
              {p.rank}. {p.fullName}
            </option>
          ))}
        </select>
      </label>
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
        <span className={formStyles.label}>Note</span>
        <input
          className={s.input}
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <span className={s.seg}>
        <SegmentedControl
          label="Payment"
          value={paying}
          options={[
            { value: "APP", label: "Pays in the app" },
            { value: "OUTSIDE", label: "Already paid" },
          ]}
          onChange={setPaying}
        />
      </span>
      {paying === "OUTSIDE" && (
        <>
          <label className={formStyles.field}>
            <span className={formStyles.label}>Amount received (rupees)</span>
            <input
              className={s.input}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </label>
          <label className={formStyles.field}>
            <span className={formStyles.label}>Payment ID</span>
            <input
              className={s.input}
              value={paymentRef}
              maxLength={80}
              placeholder="From Razorpay or the bank"
              onChange={(e) => setPaymentRef(e.target.value)}
            />
          </label>
          <span className={adminStyles.muted}>The plan starts now.</span>
        </>
      )}
      {problem && (
        <span className={s.problem} role="alert">
          {problem}
        </span>
      )}
      <div className={a.actions}>
        <button
          type="button"
          className={a.btn}
          disabled={!chosen || busy}
          onClick={() => save()}
        >
          {busy ? "Saving" : paying === "OUTSIDE" ? "Start plan" : "Add plan"}
        </button>
        <button
          type="button"
          className={adminStyles.textBtn}
          disabled={busy}
          onClick={() => {
            setChoosing(false);
            setProblem(null);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
