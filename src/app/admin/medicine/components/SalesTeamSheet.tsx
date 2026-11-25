"use client";

/*
  The sales team (23 Nov 2026): the list admin keeps, ranked, 1 the best. Each person shows how many
  patients they have, how many plans they sold that were paid for, and how many still wait for payment,
  so the ranking can follow the numbers. Admin moves someone up or down, corrects a name or a number,
  takes someone off the team (their patients keep their name until given to someone else) and brings
  them back. A patient's salesperson and the seller of a plan are chosen from this list, in this order
  (PatientSheet).
*/

import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import Sheet from "@/components/ui/Sheet";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import {
  isValidMobile,
  mobileDigitsFrom,
  spacedMobile,
} from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import {
  addSalesperson,
  listSalespeople,
  updateSalesperson,
} from "@/services/medicineOpsService";
import type { Salesperson } from "@/types/medicineOps";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import adminStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export default function SalesTeamSheet({
  open = true,
  inline = false,
  onClose,
  onChanged,
}: {
  /** on the Team page the list sits in the page (`inline`); elsewhere it opens as a sheet */
  open?: boolean;
  inline?: boolean;
  onClose?: () => void;
  /** a renamed salesperson changes the patient rows */
  onChanged: () => void;
}) {
  const team = useApiResource(open ? "salespeople" : null, listSalespeople);
  const toast = useToast();
  const [editing, setEditing] = useState<Salesperson | null>(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clear = () => {
    setEditing(null);
    setName("");
    setMobile("");
    setProblem(null);
  };

  /** One change to the list: runs it, says what happened, reloads. */
  const change = async (work: () => Promise<unknown>, done: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      toast(done);
      team.reload();
      onChanged();
    } catch (caught) {
      toast(errorMessage(caught, "That could not be saved. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (busy) return;
    if (name.trim().length < 2)
      return setProblem("Add the salesperson's full name.");
    if (mobile && !isValidMobile(mobile))
      return setProblem("Enter a 10-digit mobile number, or leave it empty.");
    setBusy(true);
    setProblem(null);
    try {
      if (editing)
        await updateSalesperson(editing.id, { fullName: name.trim(), mobile });
      else await addSalesperson({ fullName: name.trim(), mobile });
      toast(editing ? "Saved" : `${name.trim()} added`);
      clear();
      team.reload();
      onChanged();
    } catch (caught) {
      setProblem(errorMessage(caught, "That could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const active = (team.data ?? []).filter((p) => p.active);
  // people taken off the team stay out of the way until asked for
  const [showRemoved, setShowRemoved] = useState(false);
  const removed = (team.data ?? []).length - active.length;

  const body = (
    <div className={s.sheet}>
      {team.error && !team.data ? (
        <ErrorNotice message={team.error} onRetry={team.reload} />
      ) : !team.data ? (
        <LoadingSkeleton />
      ) : team.data.length === 0 ? (
        <p className={adminStyles.empty}>No salespeople yet.</p>
      ) : (
        <ul className={s.rows}>
          {(showRemoved ? team.data : active).map((p) => (
            <li key={p.id} className={s.row}>
              <span className={s.open}>
                <span className={s.what}>
                  {p.rank !== null && <span className="num">{p.rank}.</span>}
                  {p.fullName}
                  {!p.active && (
                    <span className={adminStyles.pill} data-tone="pending">
                      Removed
                    </span>
                  )}
                </span>
                <span className={`${s.sub} num`}>
                  {p.mobile && <span>{spacedMobile(p.mobile)}</span>}
                  {p.active && (
                    <span>
                      {p.canSignIn ? "Can sign in" : "Add a mobile to sign in"}
                    </span>
                  )}
                  <span>{count(p.patients, "patient", "patients")}</span>
                  <span>{count(p.plansSold, "plan sold", "plans sold")}</span>
                  {p.plansWaiting > 0 && (
                    <span>{p.plansWaiting} not paid yet</span>
                  )}
                </span>
                <span className={s.chips}>
                  {p.rank !== null && (
                    <>
                      <button
                        type="button"
                        className={s.chip}
                        disabled={busy || p.rank === 1}
                        aria-label={`Move ${p.fullName} up`}
                        onClick={() =>
                          change(
                            () =>
                              updateSalesperson(p.id, { rank: p.rank! - 1 }),
                            `${p.fullName} is now number ${p.rank! - 1}`,
                          )
                        }
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className={s.chip}
                        disabled={busy || p.rank === active.length}
                        aria-label={`Move ${p.fullName} down`}
                        onClick={() =>
                          change(
                            () =>
                              updateSalesperson(p.id, { rank: p.rank! + 1 }),
                            `${p.fullName} is now number ${p.rank! + 1}`,
                          )
                        }
                      >
                        Down
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className={s.chip}
                    disabled={busy}
                    aria-label={`Edit ${p.fullName}`}
                    onClick={() => {
                      setEditing(p);
                      setName(p.fullName);
                      setMobile(p.mobile ?? "");
                      setProblem(null);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={s.chip}
                    disabled={busy}
                    aria-label={`${p.active ? "Remove" : "Bring back"} ${p.fullName}`}
                    onClick={() =>
                      change(
                        () => updateSalesperson(p.id, { active: !p.active }),
                        p.active
                          ? `${p.fullName} is off the sales team`
                          : `${p.fullName} is back on the sales team`,
                      )
                    }
                  >
                    {p.active ? "Remove" : "Bring back"}
                  </button>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {removed > 0 && (
        <button
          type="button"
          className={adminStyles.textBtn}
          onClick={() => setShowRemoved(!showRemoved)}
        >
          {showRemoved ? "Hide removed" : `Show removed (${removed})`}
        </button>
      )}
      <h3 className={s.sectionHead}>
        {editing ? `Edit ${editing.fullName}` : "Add a salesperson"}
      </h3>
      <div className={s.formGrid} data-cols="2">
        <label className={formStyles.field}>
          <span className={formStyles.label}>Full name</span>
          <input
            className={s.input}
            value={name}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className={formStyles.field}>
          <span className={formStyles.label}>Mobile</span>
          <input
            className={s.input}
            type="tel"
            inputMode="numeric"
            value={spacedMobile(mobile)}
            placeholder="98765 43210"
            onChange={(e) => setMobile(mobileDigitsFrom(e.target.value))}
          />
        </label>
      </div>
      {problem && (
        <p className={formStyles.err} role="alert">
          {problem}
        </p>
      )}
      <button
        type="button"
        className={`btn ${formStyles.go}`}
        data-busy={busy}
        aria-busy={busy}
        disabled={busy}
        onClick={save}
      >
        <span>{editing ? "Save" : "Add salesperson"}</span>
        <span className="well" aria-hidden="true">
          {busy ? <i className={formStyles.spin} /> : <ArrowRight size={18} />}
        </span>
      </button>
      {editing && (
        <button type="button" className={adminStyles.textBtn} onClick={clear}>
          Cancel
        </button>
      )}
      <p className={formStyles.hint}>Number 1 is your best salesperson.</p>
    </div>
  );
  return inline ? (
    <section className={adminStyles.panel} aria-labelledby="sales-team-h">
      <div className={adminStyles.panelHead}>
        <h2 id="sales-team-h" className={adminStyles.h2}>
          Sales team
        </h2>
      </div>
      {body}
    </section>
  ) : (
    <Sheet open={open} onClose={onClose ?? (() => {})} title="Sales team">
      {body}
    </Sheet>
  );
}
