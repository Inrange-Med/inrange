"use client";

/*
  The coach's side of a patient (23 Nov 2026 call), on the coach's own sheet and on admin's: the diet chart
  (the health coach), the exercise plan (the fitness coach) and the calls made, counted against what the plan
  includes. Saving a chart keeps the old one and shows the new one to the patient (Care) and to the doctor
  (the patient's page). `can` says which side this person may write; the API checks it again.
*/

import { useState } from "react";
import DatePicker from "@/components/ui/DatePicker";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/ToastProvider";
import { shortDate, toApiDate } from "@/lib/format/dateTime";
import { errorMessage } from "@/lib/http/apiClient";
import { logCoachCall, saveCoachPlan } from "@/services/coachService";
import type { CoachCall, CoachPlan } from "@/types/coach";
import surfaceStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

type Included = {
  coachCalls: number | null;
  fitnessCalls: number | null;
  healthCallsMade: number;
  fitnessCallsMade: number;
};

function PlanEditor({
  patientId,
  kind,
  plan,
  canWrite,
  onSaved,
}: {
  patientId: string;
  kind: "diet" | "fitness";
  plan: CoachPlan | null;
  canWrite: boolean;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(plan?.text ?? "");
  const [busy, setBusy] = useState(false);
  const title = kind === "diet" ? "Diet chart" : "Exercise plan";

  const save = async () => {
    if (busy || text.trim().length < 10) return;
    setBusy(true);
    try {
      toast(await saveCoachPlan(patientId, kind, text.trim()));
      setEditing(false);
      onSaved();
    } catch (caught) {
      toast(errorMessage(caught, "That was not saved. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={s.section} aria-label={title}>
      <h3 className={s.sectionHead}>
        {title}
        {plan && (
          <span className={surfaceStyles.muted}>
            {" "}
            {plan.by}, {shortDate(plan.at)}
            {plan.versions > 1 ? `, version ${plan.versions}` : ""}
          </span>
        )}
      </h3>
      {editing ? (
        <>
          <textarea
            className={s.textarea}
            rows={10}
            value={text}
            maxLength={8000}
            placeholder={
              kind === "diet"
                ? "Meal by meal: what to eat, how much, and when"
                : "Day by day: the exercise, how long, and how hard"
            }
            aria-label={title}
            onChange={(e) => setText(e.target.value)}
          />
          <span className={s.chips}>
            <button
              type="button"
              className={s.chip}
              disabled={busy || text.trim().length < 10}
              onClick={save}
            >
              {busy ? "Saving" : "Save. The patient and the doctor see it"}
            </button>
            <button
              type="button"
              className={s.chip}
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setText(plan?.text ?? "");
              }}
            >
              Cancel
            </button>
          </span>
        </>
      ) : (
        <>
          {plan ? (
            <p className={s.pre}>{plan.text}</p>
          ) : (
            <p className={surfaceStyles.empty}>
              {canWrite
                ? "Not written yet."
                : kind === "diet"
                  ? "Not written yet. The patient's health coach writes it."
                  : "Not written yet. The patient's fitness coach writes it."}
            </p>
          )}
          {canWrite && (
            <span className={s.chips}>
              <button
                type="button"
                className={s.chip}
                onClick={() => setEditing(true)}
              >
                {plan
                  ? "Write a new version"
                  : `Write the ${title.toLowerCase()}`}
              </button>
            </span>
          )}
        </>
      )}
    </section>
  );
}

export default function CoachingSections({
  patientId,
  can,
  diet,
  fitness,
  calls,
  included,
  onSaved,
}: {
  patientId: string;
  can: { health: boolean; fitness: boolean };
  diet: CoachPlan | null;
  fitness: CoachPlan | null;
  calls: CoachCall[];
  /** null while the patient has no plan */
  included: Included | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const today = toApiDate(new Date());
  const [calledOn, setCalledOn] = useState(today);
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<"HEALTH" | "FITNESS">(
    can.health ? "HEALTH" : "FITNESS",
  );
  const [busy, setBusy] = useState(false);
  const both = can.health && can.fitness;

  const log = async () => {
    if (busy) return;
    setBusy(true);
    try {
      toast(
        await logCoachCall(patientId, { calledOn, note: note.trim(), kind }),
      );
      setNote("");
      onSaved();
    } catch (caught) {
      toast(errorMessage(caught, "The call was not logged. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const counted = (made: number, of: number | null, what: string) =>
    of != null ? `${made} of ${of} ${what}` : `${made} ${what}`;

  return (
    <>
      <PlanEditor
        patientId={patientId}
        kind="diet"
        plan={diet}
        canWrite={can.health}
        onSaved={onSaved}
      />
      <PlanEditor
        patientId={patientId}
        kind="fitness"
        plan={fitness}
        canWrite={can.fitness}
        onSaved={onSaved}
      />
      <section className={s.section} aria-label="Calls">
        <h3 className={s.sectionHead}>
          Calls
          {included && (
            <span className={`${surfaceStyles.muted} num`}>
              {" "}
              {counted(
                included.healthCallsMade,
                included.coachCalls,
                "coach calls",
              )}
              ,{" "}
              {counted(
                included.fitnessCallsMade,
                included.fitnessCalls,
                "fitness calls",
              )}{" "}
              on this plan
            </span>
          )}
        </h3>
        {(can.health || can.fitness) && (
          <div className={s.planForm}>
            {both && (
              <SegmentedControl
                label="Which call"
                value={kind}
                options={[
                  { value: "HEALTH", label: "Coach call" },
                  { value: "FITNESS", label: "Fitness call" },
                ]}
                onChange={setKind}
              />
            )}
            <DatePicker
              label="Day of the call"
              value={calledOn}
              max={today}
              onChange={setCalledOn}
            />
            <input
              className={s.input}
              value={note}
              maxLength={2000}
              placeholder="What you covered, if you want to note it"
              aria-label="What the call covered"
              onChange={(e) => setNote(e.target.value)}
            />
            <span className={s.chips}>
              <button
                type="button"
                className={s.chip}
                disabled={busy}
                onClick={log}
              >
                {busy ? "Saving" : "Log this call"}
              </button>
            </span>
          </div>
        )}
        {calls.length === 0 ? (
          <p className={surfaceStyles.empty}>No calls logged yet.</p>
        ) : (
          <ol className={s.timeline}>
            {calls.map((call) => (
              <li key={call.id}>
                <time dateTime={call.calledOn}>{shortDate(call.calledOn)}</time>
                <span>
                  <strong>
                    {call.kind === "FITNESS" ? "Fitness call" : "Coach call"}
                    {call.note ? `: ${call.note}` : ""}
                  </strong>
                  <span className={s.reply}>{call.by}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
