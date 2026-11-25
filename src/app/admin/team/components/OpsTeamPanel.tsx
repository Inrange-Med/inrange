"use client";

/*
  The operations team (24 Nov 2026): the people who run the work between the patient and the doctor. Each has
  one or more desks, and signs in to Operations with only those: blood tests (calls the patients who have not
  booked, books and moves collections), consultations (books the doctor after the report, and the follow-ups),
  the pharmacy (the queue, orders and deliveries). Unticking every desk takes someone off the team and signs
  them out at once.
*/

import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
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
import type { Desk } from "@/lib/session/authSession";
import {
  addTeamMember,
  listTeam,
  setTeamDesks,
} from "@/services/medicineOpsService";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import adminStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

const DESKS: { value: Desk; label: string }[] = [
  { value: "BLOOD_TESTS", label: "Blood tests" },
  { value: "CONSULTATIONS", label: "Consultations" },
  { value: "MEDICINE", label: "Pharmacy" },
];

function DeskChips({
  desks,
  disabled,
  onToggle,
}: {
  desks: Desk[];
  disabled?: boolean;
  onToggle: (desk: Desk) => void;
}) {
  return (
    <span className={s.chips} role="group" aria-label="Desks">
      {DESKS.map((desk) => (
        <button
          key={desk.value}
          type="button"
          role="checkbox"
          aria-checked={desks.includes(desk.value)}
          data-on={desks.includes(desk.value) || undefined}
          className={s.chip}
          disabled={disabled}
          onClick={() => onToggle(desk.value)}
        >
          {desk.label}
        </button>
      ))}
    </span>
  );
}

const toggled = (desks: Desk[], desk: Desk) =>
  desks.includes(desk) ? desks.filter((d) => d !== desk) : [...desks, desk];

export default function OpsTeamPanel() {
  const team = useApiResource("ops-team", listTeam);
  const toast = useToast();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [desks, setDesks] = useState<Desk[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    try {
      toast(await work());
      team.reload();
      return true;
    } catch (caught) {
      setProblem(errorMessage(caught, "That could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (name.trim().length < 2) return setProblem("Add their full name.");
    if (!isValidMobile(mobile))
      return setProblem("Enter a 10-digit mobile number.");
    if (!desks.length) return setProblem("Choose at least one desk.");
    setProblem(null);
    if (
      await run(() => addTeamMember({ fullName: name.trim(), mobile, desks }))
    ) {
      setName("");
      setMobile("");
      setDesks([]);
    }
  };

  return (
    <section className={adminStyles.panel} aria-labelledby="ops-team-h">
      <div className={adminStyles.panelHead}>
        <h2 id="ops-team-h" className={adminStyles.h2}>
          Operations team
        </h2>
      </div>
      <div className={s.sheet}>
        {team.error && !team.data ? (
          <ErrorNotice message={team.error} onRetry={team.reload} />
        ) : !team.data ? (
          <LoadingSkeleton />
        ) : team.data.length === 0 ? (
          <p className={adminStyles.empty}>
            Nobody yet. Until someone is added, admins do this work from
            Operations.
          </p>
        ) : (
          <ul className={s.rows}>
            {team.data.map((member) => (
              <li key={member.id} className={s.row}>
                <span className={s.open}>
                  <span className={s.what}>
                    {member.fullName}
                    {member.desks.length === 0 && (
                      <span className={adminStyles.pill}>Not on the team</span>
                    )}
                  </span>
                  <span className={`${s.sub} num`}>
                    {spacedMobile(member.mobile)}
                  </span>
                  <DeskChips
                    desks={member.desks}
                    disabled={busy}
                    onToggle={(desk) =>
                      run(() =>
                        setTeamDesks(member.id, toggled(member.desks, desk)),
                      )
                    }
                  />
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
            <span className={formStyles.label}>Mobile, to sign in with</span>
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
        <DeskChips
          desks={desks}
          onToggle={(desk) => setDesks(toggled(desks, desk))}
        />
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
          <span>Add to the operations team</span>
          <span className="well" aria-hidden="true">
            {busy ? (
              <i className={formStyles.spin} />
            ) : (
              <ArrowRight size={18} />
            )}
          </span>
        </button>
      </div>
    </section>
  );
}
