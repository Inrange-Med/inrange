"use client";

/* The patient's programme plan on the record: the active plan, or the doctor's suggestion, which the
   patient sees first on Plans. A suggestion is only offered while no plan is active. */

import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import Sheet from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/ToastProvider";
import { inIndiaTime, shortDate } from "@/lib/format/dateTime";
import { errorMessage } from "@/lib/http/apiClient";
import {
  recommendPlan,
  withdrawPlanRecommendation,
} from "@/services/patientRecordService";
import { listPlans } from "@/services/subscriptionService";
import type { PatientRecord } from "@/types/patientRecord";
import type { SubscriptionPlan } from "@/types/subscription";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import recordStyles from "../PatientRecordPage.module.css";
import styles from "./ProgrammePlanPanel.module.css";

/** "12 Feb", with the year when it is not this one ("12 Feb 2027") */
function dayMonth(iso: string) {
  const year = inIndiaTime(new Date(iso)).getUTCFullYear();
  return year === inIndiaTime(new Date()).getUTCFullYear()
    ? shortDate(iso)
    : `${shortDate(iso)} ${year}`;
}

export default function ProgrammePlanPanel({
  patientId,
  record,
  onChanged,
}: {
  patientId: string;
  record: Pick<PatientRecord, "planRecommendation" | "activePlan">;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const suggested = record.planRecommendation;

  const start = async () => {
    setOpen(true);
    setNote(suggested?.note ?? "");
    try {
      const active = (await listPlans()).filter((plan) => plan.isActive);
      setPlans(active);
      setPlanId(suggested?.planId ?? active[0]?.id ?? null);
    } catch (caught) {
      toast(errorMessage(caught));
      setOpen(false);
    }
  };

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast(done);
      setOpen(false);
      onChanged();
    } catch (caught) {
      toast(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="programme"
      className={`${clinicStyles.panel} ${recordStyles.full}`}
      aria-labelledby="programme-heading"
    >
      <div className={clinicStyles.panelHead}>
        <h2 id="programme-heading" className={clinicStyles.h2}>
          Programme plan
        </h2>
      </div>
      {record.activePlan ? (
        <div className={styles.plan}>
          <div className={styles.rxHead}>
            <strong>{record.activePlan.planName}</strong>
            <span className={`${clinicStyles.pill} num`} data-tone="ok">
              Active until {dayMonth(record.activePlan.endsAt)}
            </span>
          </div>
        </div>
      ) : (
        <div className={styles.body}>
          {suggested ? (
            <div className={styles.plan} data-draft="true">
              <div className={styles.rxHead}>
                <strong>{suggested.planName}</strong>
                <span className={`${clinicStyles.pill} num`} data-tone="draft">
                  Suggested {dayMonth(suggested.recommendedAt)}
                </span>
              </div>
              {suggested.note && (
                <blockquote className={styles.quote}>
                  <p>{suggested.note}</p>
                  <cite>Your note to the patient</cite>
                </blockquote>
              )}
            </div>
          ) : (
            <p className={clinicStyles.empty}>
              No plan yet. The patient sees your suggestion first on Plans.
            </p>
          )}
          <div className={styles.actions}>
            <button type="button" className="btn btn--ghost" onClick={start}>
              {suggested ? "Change the suggestion" : "Recommend a plan"}
            </button>
            {suggested && (
              <button
                type="button"
                className={clinicStyles.textBtn}
                disabled={busy}
                onClick={() =>
                  run(
                    () => withdrawPlanRecommendation(patientId),
                    "Suggestion withdrawn",
                  )
                }
              >
                Withdraw
              </button>
            )}
          </div>
        </div>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Recommend a plan"
      >
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (planId != null)
              run(
                () => recommendPlan(patientId, planId, note.trim()),
                "Plan recommended",
              );
          }}
        >
          <label className={formStyles.field}>
            <span className={formStyles.label}>Plan</span>
            <select
              className={formStyles.input}
              value={planId ?? ""}
              disabled={!plans}
              onChange={(event) => setPlanId(Number(event.target.value))}
            >
              {(plans ?? []).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
          <label className={formStyles.field}>
            <span className={formStyles.label}>Note for the patient</span>
            <textarea
              className={clinicStyles.textarea}
              rows={3}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="For example, a review every month for four months"
            />
          </label>
          <button
            type="submit"
            className={`btn ${formStyles.go}`}
            disabled={planId == null || busy}
          >
            <span>Recommend</span>
            <span className="well" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </button>
        </form>
      </Sheet>
    </section>
  );
}
