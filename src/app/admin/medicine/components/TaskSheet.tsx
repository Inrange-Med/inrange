"use client";

/*
  One task: who and why (with a call link), what happened so far, then the outcome. Every outcome needs
  a short note (PRD 9.1: the next person picks it up from there). "Call back later" asks when; "No
  answer" moves it to the next working morning. Both keep the task open. Sending the order link and
  taking the task are quiet actions above the outcome; "Save" is the one primary.
*/

import { useEffect, useState } from "react";
import { ArrowRight, Phone } from "@phosphor-icons/react";
import Sheet from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/ToastProvider";
import { useSessionUser } from "@/hooks/useSessionUser";
import { combineDateAndTime, inIndiaTime } from "@/lib/format/dateTime";
import { spacedMobile } from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import {
  assignTask,
  finishTask,
  sendOrderLink,
} from "@/services/medicineOpsService";
import type { OpsTask, TaskOutcome } from "@/types/medicineOps";
import {
  CART_KINDS,
  dueWords,
  KIND_WORDS,
  OUTCOME_WORDS,
  outcomesFor,
  when,
} from "./words";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";
import s from "./Medicine.module.css";

/** "2026-11-18T10:00" for a datetime-local input, in India time. */
const localInput = (d: Date) => inIndiaTime(d).toISOString().slice(0, 16);

export default function TaskSheet({
  task,
  now,
  onClose,
  onOpenPatient,
  onChanged,
}: {
  task: OpsTask | null;
  now: number;
  onClose: () => void;
  onOpenPatient: (id: string) => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { user } = useSessionUser();
  const [outcome, setOutcome] = useState<TaskOutcome | null>(null);
  const [note, setNote] = useState("");
  const [callBackAt, setCallBackAt] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "link" | "take" | null>(null);
  const [assigned, setAssigned] = useState<string | null>(null);

  // a fresh form for each task opened
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset when another task opens */
    setOutcome(null);
    setNote("");
    setProblem(null);
    setCallBackAt(localInput(new Date(Date.now() + 2 * 3600_000)));
    setAssigned(task?.assignedTo ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [task?.id, task?.assignedTo]);

  if (!task)
    return (
      <Sheet open={false} onClose={onClose} title="Task">
        {null}
      </Sheet>
    );
  const open = task.status === "OPEN";
  const due = dueWords(task.dueAt, now);
  const mine = assigned === String(user?.userId);

  const save = async () => {
    if (busy) return;
    if (!outcome) return setProblem("Choose what happened.");
    if (note.trim().length < 3)
      return setProblem("Add a short note on what happened.");
    // the input gives India time ("2026-11-18T10:00"); an empty or past one is asked again
    const callBackIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(callBackAt)
      ? combineDateAndTime(callBackAt.slice(0, 10), callBackAt.slice(11, 16))
      : null;
    if (outcome === "CALL_BACK" && !callBackIso)
      return setProblem("Choose when to call back.");
    if (outcome === "CALL_BACK" && Date.parse(callBackIso!) < Date.now())
      return setProblem("Choose a later time to call back.");
    setBusy("save");
    setProblem(null);
    try {
      const result = await finishTask(task.id, {
        outcome,
        note: note.trim(),
        ...(outcome === "CALL_BACK" ? { callBackAt: callBackIso! } : {}),
      });
      toast(result.status === "OPEN" ? "Moved to the call-back time" : "Done");
      onChanged();
      onClose();
    } catch (caught) {
      setProblem(errorMessage(caught, "That could not be saved. Try again."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open onClose={onClose} title={task.title}>
      <div className={s.sheet}>
        <dl className={s.facts}>
          {task.patientName && (
            <div>
              <dt>Patient</dt>
              <dd>
                <button
                  type="button"
                  className={adminStyles.textBtn}
                  onClick={() =>
                    task.patientId && onOpenPatient(task.patientId)
                  }
                >
                  {task.patientName}
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </dd>
            </div>
          )}
          {task.patientMobile && (
            <div>
              <dt>Mobile</dt>
              <dd>
                <a href={`tel:+91${task.patientMobile}`} className="num">
                  <Phone size={14} aria-hidden="true" />{" "}
                  {spacedMobile(task.patientMobile)}
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt>{open ? "Due" : "Done"}</dt>
            <dd className="num">
              {open ? (
                <span className={s.due} data-late={due.late}>
                  {due.text}
                </span>
              ) : (
                `${task.outcome ? OUTCOME_WORDS[task.outcome] : "Done"}, ${task.doneAt ? when(task.doneAt) : ""}`
              )}
            </dd>
          </div>
          <div>
            <dt>Kind</dt>
            <dd>
              {KIND_WORDS[task.kind]}
              {task.orderNumber ? `, ${task.orderNumber}` : ""}
            </dd>
          </div>
          {task.detail && (
            <div>
              <dt>Details</dt>
              <dd>{task.detail}</dd>
            </div>
          )}
          {!open && task.outcomeNote && (
            <div>
              <dt>Note</dt>
              <dd>{task.outcomeNote}</dd>
            </div>
          )}
        </dl>

        {open && (
          <>
            <div className={adminStyles.actions}>
              {!mine && (
                <button
                  type="button"
                  className={adminStyles.textBtn}
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy("take");
                    try {
                      await assignTask(task.id, "me");
                      setAssigned(String(user?.userId));
                      toast("It is yours");
                      onChanged();
                    } catch (caught) {
                      toast(
                        errorMessage(caught, "That could not be assigned."),
                      );
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {busy === "take" ? "Taking it" : "Take this task"}
                </button>
              )}
              {task.cartId && CART_KINDS.includes(task.kind) && (
                <button
                  type="button"
                  className={adminStyles.textBtn}
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy("link");
                    try {
                      await sendOrderLink(task.id);
                      toast("Order link sent on WhatsApp");
                    } catch (caught) {
                      toast(
                        errorMessage(caught, "The link could not be sent."),
                      );
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {busy === "link" ? "Sending" : "Send the order link"}
                </button>
              )}
            </div>

            <fieldset className={s.section}>
              <legend className={s.sectionHead}>What happened</legend>
              <div className={s.choices} role="radiogroup">
                {outcomesFor(task.kind).map((value) => (
                  <label key={value} className={s.choice}>
                    <input
                      type="radio"
                      name={`outcome-${task.id}`}
                      checked={outcome === value}
                      onChange={() => {
                        setOutcome(value);
                        setProblem(null);
                      }}
                    />
                    {OUTCOME_WORDS[value]}
                  </label>
                ))}
              </div>
            </fieldset>
            {outcome === "CALL_BACK" && (
              <label className={formStyles.field}>
                <span className={formStyles.label}>When to call back</span>
                <input
                  type="datetime-local"
                  className={s.input}
                  value={callBackAt}
                  min={localInput(new Date())}
                  onChange={(e) => setCallBackAt(e.target.value)}
                />
              </label>
            )}
            <label className={formStyles.field}>
              <span className={formStyles.label}>Note</span>
              <textarea
                className={s.textarea}
                value={note}
                maxLength={2000}
                aria-invalid={
                  problem === "Add a short note on what happened." || undefined
                }
                placeholder="What was said, and what happens next"
                onChange={(e) => {
                  setNote(e.target.value);
                  setProblem(null);
                }}
              />
            </label>
            {problem && (
              <p className={formStyles.err} role="alert">
                {problem}
              </p>
            )}
            <button
              type="button"
              className={`btn ${formStyles.go}`}
              data-busy={busy === "save"}
              aria-busy={busy === "save"}
              disabled={busy !== null}
              onClick={save}
            >
              <span>{busy === "save" ? "Saving" : "Save"}</span>
              <span className="well" aria-hidden="true">
                {busy === "save" ? (
                  <i className={formStyles.spin} />
                ) : (
                  <ArrowRight size={18} />
                )}
              </span>
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
