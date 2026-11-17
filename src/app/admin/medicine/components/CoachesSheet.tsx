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
import { addCoach, listCoaches } from "@/services/medicineOpsService";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";
import s from "./Medicine.module.css";

export default function CoachesSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const coaches = useApiResource(open ? "coaches" : null, listCoaches);
  const toast = useToast();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
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
      await addCoach({ fullName: name.trim(), mobile });
      toast("Coach added. They sign in with this number.");
      setName("");
      setMobile("");
      coaches.reload();
    } catch (caught) {
      setProblem(errorMessage(caught, "The coach could not be added."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Health coaches">
      <div className={s.sheet}>
        {coaches.error && !coaches.data ? (
          <ErrorNotice message={coaches.error} onRetry={coaches.reload} />
        ) : !coaches.data ? (
          <LoadingSkeleton />
        ) : coaches.data.length === 0 ? (
          <p className={adminStyles.empty}>
            No coaches yet. Add the first below, then assign patients from each
            patient&apos;s page.
          </p>
        ) : (
          <ul className={s.rows}>
            {coaches.data.map((c) => (
              <li key={c.id} className={s.row}>
                <span className={s.open}>
                  <span className={s.what}>{c.fullName}</span>
                  <span className={`${s.sub} num`}>
                    {spacedMobile(c.mobile)}
                  </span>
                </span>
                <span className={`${s.side} ${adminStyles.muted} num`}>
                  {c.patients} {c.patients === 1 ? "patient" : "patients"}
                </span>
              </li>
            ))}
          </ul>
        )}
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
          onClick={add}
        >
          <span>{busy ? "Adding" : "Add the coach"}</span>
          <span className="well" aria-hidden="true">
            {busy ? (
              <i className={formStyles.spin} />
            ) : (
              <ArrowRight size={18} />
            )}
          </span>
        </button>
      </div>
    </Sheet>
  );
}
