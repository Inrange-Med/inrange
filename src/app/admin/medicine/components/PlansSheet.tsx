"use client";

/*
  The plans (23 Nov 2026 call: "3 months: 3 doctor consultations, 12 coach calls, 12 fitness calls"): what
  each plan includes, which the team and the coaches count against, and the most a salesperson may take off
  its price on a payment link without asking (admin can give any discount). Prices are not changed here.
*/

import { useState } from "react";
import Sheet from "@/components/ui/Sheet";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { formatRupees } from "@/lib/format/money";
import { errorMessage } from "@/lib/http/apiClient";
import { listStaffPlans, updatePlan } from "@/services/medicineOpsService";
import type { PlanOnSale } from "@/types/sales";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import adminStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

const FIELDS = [
  { key: "doctorConsults", label: "Doctor consultations" },
  { key: "coachCalls", label: "Coach calls" },
  { key: "fitnessCalls", label: "Fitness calls" },
  { key: "maxDiscountPercent", label: "Most a salesperson can take off, %" },
] as const;
type Key = (typeof FIELDS)[number]["key"];

function PlanRow({ plan, onSaved }: { plan: PlanOnSale; onSaved: () => void }) {
  const toast = useToast();
  const [values, setValues] = useState<Record<Key, string>>({
    doctorConsults: String(plan.doctorConsults ?? ""),
    coachCalls: String(plan.coachCalls ?? ""),
    fitnessCalls: String(plan.fitnessCalls ?? ""),
    maxDiscountPercent: String(plan.maxDiscountPercent),
  });
  const [busy, setBusy] = useState(false);
  const changed = FIELDS.some(
    (f) => values[f.key] !== String(plan[f.key] ?? ""),
  );

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await updatePlan(
        plan.id,
        Object.fromEntries(FIELDS.map((f) => [f.key, Number(values[f.key])])),
      );
      toast(`${plan.name} saved`);
      onSaved();
    } catch (caught) {
      toast(errorMessage(caught, "That could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={s.section} aria-label={plan.name}>
      <h3 className={s.sectionHead}>
        {plan.name},{" "}
        <span className="num">{formatRupees(plan.priceRupees)}</span>
      </h3>
      <div className={s.formGrid} data-cols="2">
        {FIELDS.map((f) => (
          <label key={f.key} className={formStyles.field}>
            <span className={formStyles.label}>{f.label}</span>
            <input
              className={s.input}
              inputMode="numeric"
              value={values[f.key]}
              onChange={(e) =>
                setValues({
                  ...values,
                  [f.key]: e.target.value.replace(/\D/g, "").slice(0, 3),
                })
              }
            />
          </label>
        ))}
      </div>
      {changed && (
        <span className={s.chips}>
          <button
            type="button"
            className={s.chip}
            disabled={busy}
            onClick={save}
          >
            {busy ? "Saving" : "Save"}
          </button>
        </span>
      )}
    </section>
  );
}

export default function PlansSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const plans = useApiResource(open ? "staff-plans" : null, listStaffPlans);
  return (
    <Sheet open={open} onClose={onClose} title="Plans">
      <div className={s.sheet}>
        {plans.error && !plans.data ? (
          <ErrorNotice message={plans.error} onRetry={plans.reload} />
        ) : !plans.data ? (
          <LoadingSkeleton />
        ) : (
          plans.data.map((plan) => (
            <PlanRow
              key={`${plan.id}-${plan.doctorConsults}-${plan.coachCalls}-${plan.fitnessCalls}-${plan.maxDiscountPercent}`}
              plan={plan}
              onSaved={plans.reload}
            />
          ))
        )}
        <p className={adminStyles.muted}>
          A change counts for everyone on the plan from now, and for links made
          from now.
        </p>
      </div>
    </Sheet>
  );
}
