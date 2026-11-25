"use client";

/*
  The health coaches: who they are and how many patients each has, and adding one (name and mobile;
  they sign in with that number and see only the patients assigned to them).
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
  addCoach,
  listCoaches,
  setCoachKind,
} from "@/services/medicineOpsService";
import type { CoachKind } from "@/types/medicineOps";

const KINDS: { value: CoachKind; label: string }[] = [
  { value: "HEALTH", label: "Health coach" },
  { value: "FITNESS", label: "Fitness coach" },
  { value: "BOTH", label: "Health and fitness" },
];
import formStyles from "@/components/ui/styles/FormControls.module.css";
import adminStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

export default function CoachesSheet({
  open = true,
  inline = false,
  onClose,
}: {
  open?: boolean;
  inline?: boolean;
  onClose?: () => void;
}) {
  const coaches = useApiResource(open ? "coaches" : null, listCoaches);
  const toast = useToast();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [kind, setKind] = useState<CoachKind>("HEALTH");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (busy) return;
    if (name.trim().length < 2) return setProblem("Add the coach's full name.");
    if (!isValidMobile(mobile))
      return setProblem("Enter a 10-digit mobile number.");
    setBusy(true);
    setProblem(null);
    try {
      await addCoach({ fullName: name.trim(), mobile, kind });
      toast("Coach added");
      setName("");
      setMobile("");
      coaches.reload();
    } catch (caught) {
      setProblem(errorMessage(caught, "The coach could not be added."));
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <div className={s.sheet}>
      {coaches.error && !coaches.data ? (
        <ErrorNotice message={coaches.error} onRetry={coaches.reload} />
      ) : !coaches.data ? (
        <LoadingSkeleton />
      ) : coaches.data.length === 0 ? (
        <p className={adminStyles.empty}>No coaches yet.</p>
      ) : (
        <ul className={s.rows}>
          {coaches.data.map((c) => (
            <li key={c.id} className={s.row}>
              <span className={s.open}>
                <span className={s.what}>{c.fullName}</span>
                <span className={`${s.sub} num`}>{spacedMobile(c.mobile)}</span>
              </span>
              <span className={s.side}>
                <span className={`${adminStyles.muted} num`}>
                  {c.patients + c.fitnessPatients}{" "}
                  {c.patients + c.fitnessPatients === 1
                    ? "patient"
                    : "patients"}
                </span>
                <select
                  className={s.input}
                  value={c.kind}
                  aria-label={`Type of coach: ${c.fullName}`}
                  onChange={async (e) => {
                    try {
                      await setCoachKind(c.id, e.target.value as CoachKind);
                      toast("Saved");
                      coaches.reload();
                    } catch (caught) {
                      toast(errorMessage(caught, "That was not saved."));
                    }
                  }}
                >
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </span>
            </li>
          ))}
        </ul>
      )}
      <h3 className={s.sectionHead}>Add a coach</h3>
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
      <label className={formStyles.field}>
        <span className={formStyles.label}>Type</span>
        <select
          className={s.input}
          value={kind}
          onChange={(e) => setKind(e.target.value as CoachKind)}
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
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
        onClick={add}
      >
        <span>{busy ? "Adding" : "Add coach"}</span>
        <span className="well" aria-hidden="true">
          {busy ? <i className={formStyles.spin} /> : <ArrowRight size={18} />}
        </span>
      </button>
    </div>
  );
  return inline ? (
    <section className={adminStyles.panel} aria-labelledby="coaches-h">
      <div className={adminStyles.panelHead}>
        <h2 id="coaches-h" className={adminStyles.h2}>
          Coaches
        </h2>
      </div>
      {body}
    </section>
  ) : (
    <Sheet open={open} onClose={onClose ?? (() => {})} title="Coaches">
      {body}
    </Sheet>
  );
}
