"use client";

/*
  Writing a prescription (doctor portal v2 PRD; 19 Nov 2026 call): diagnosis (the only required field, from a
  list or typed), history, remarks, medicines and advice. It saves as the doctor types. A follow-up starts
  from the last prescription, so the doctor changes only what is different. The bar held at the bottom has
  the one next step: Create PDF, then Send to patient (the PDF shows on the page first, and that is the
  check: no "are you sure").
  It opens only when the doctor asks for it on the patient's page ("Write prescription"), and writes to the
  target the page was given: a consultation's prescription, or one with no consultation. The doctor never
  chooses a plan: a salesperson sells it.
*/

import { useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import FileOpenButton from "@/components/ui/FileOpenButton";
import { useToast } from "@/components/ui/ToastProvider";
import { clockTime, shortDate } from "@/lib/format/dateTime";
import { errorMessage } from "@/lib/http/apiClient";
import {
  createPrescriptionPdf,
  discardNewVersion,
  sendPrescription,
} from "@/services/consultationService";
import { getFile } from "@/services/fileService";
import type {
  Prescription,
  PrescriptionEntry,
  RxTarget,
} from "@/types/consultation";
import MedicineLines, { daysOf } from "./MedicineLines";
import PdfPanel from "./PdfPanel";
import QuickPicks from "./QuickPicks";
import {
  startFrom,
  usePrescriptionDraft,
  type SaveState,
} from "./usePrescriptionDraft";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "./PatientPage.module.css";

// the usual words, one tap each; the box takes anything else (to confirm with the client's doctors)
const DIAGNOSES = [
  "Obesity",
  "Overweight",
  "Type 2 diabetes",
  "Prediabetes",
  "High blood pressure",
  "High cholesterol",
  "Fatty liver",
  "PCOS",
  "Hypothyroidism",
];
const ADVICE = [
  "Eat protein with every meal",
  "Drink 2 to 3 litres of water a day",
  "Walk 30 minutes a day",
  "Strength exercise twice a week",
  "Small meals, stop when full",
  "Inject on the same day each week",
  "Call us for severe stomach pain or vomiting",
];

function SavedLine({
  state,
  savedAt,
  problem,
}: {
  state: SaveState;
  savedAt: string | null;
  problem: string | null;
}) {
  // a lost connection keeps trying on its own; a refusal says why (it will not change by waiting)
  if (state === "error" || state === "refused")
    return (
      <span className={styles.saveLine} data-state="error" role="status">
        {state === "error"
          ? "Not saved yet. Trying again."
          : (problem ?? "Not saved.")}
      </span>
    );
  if (state === "saving")
    return <span className={styles.saveLine}>Saving</span>;
  if (savedAt)
    return (
      <span className={`${styles.saveLine} num`}>
        Saved {clockTime(new Date(savedAt))}
      </span>
    );
  return null;
}

export default function PrescriptionWriter({
  target,
  initial,
  last,
  onClose,
  onSent,
  onDropped,
}: {
  target: RxTarget;
  /** the prescription already begun there, if any */
  initial: Prescription | null;
  /** the patient's latest prescription: a new one starts from it */
  last: PrescriptionEntry | null;
  /** without a plan a prescription is for one month */
  /** back to the patient's prescriptions; what was written stays saved */
  onClose: () => void;
  onSent: (sent: Prescription) => void;
  /** the draft was given up (a new version dropped, or one with no consultation discarded) */
  onDropped: () => void;
}) {
  const toast = useToast();
  const rx = usePrescriptionDraft(
    target,
    initial,
    initial ? null : startFrom(last),
  );
  // opened with nothing written yet: it starts as a copy of the last one
  const [fromLast] = useState(() => !initial && Boolean(last));
  const { draft, change, saved } = rx;
  const [busy, setBusy] = useState<null | "pdf" | "send" | "drop">(null);
  const [problem, setProblem] = useState<{
    text: string;
    field?: "diagnosis";
    line?: string;
  } | null>(null);
  const diagnosisRef = useRef<HTMLTextAreaElement>(null);
  // a new version of a sent prescription ("Edit and send new version")
  const revising = Boolean((saved ?? initial)?.revising);
  const pdfReady = Boolean(
    saved &&
      saved.status === "DRAFT" &&
      saved.pdf &&
      saved.pdfMadeAt &&
      rx.state === "saved",
  );

  const fail = (caught: unknown, fallback: string) => {
    const text = errorMessage(caught, fallback);
    setProblem({
      text,
      field: /diagnosis/i.test(text) ? "diagnosis" : undefined,
    });
  };

  /** The same checks the server makes, before the trip: the first gap, where it is. */
  const missing = (): typeof problem => {
    if (!draft.diagnosis.trim())
      return { text: "Write the diagnosis first.", field: "diagnosis" };
    for (const [i, line] of draft.medicines.entries()) {
      const which =
        draft.medicines.length > 1 ? `medicine ${i + 1}` : "the medicine";
      if (
        !line.frequency ||
        (line.frequency === "OTHER" && !line.frequencyOther.trim())
      )
        return { text: `Choose how often for ${which}.`, line: line.key };
      if (!line.durationValue)
        return { text: `Write for how long for ${which}.`, line: line.key };
      // every prescription is for one month, plan or not (23 Nov 2026 call): said here, as the server does
      if (daysOf(line.durationValue, line.durationUnit) > 31)
        return {
          text: `Every prescription is for one month. Set ${which} to 1 month or less.`,
          line: line.key,
        };
    }
    return null;
  };

  // one press at a time: a double click must not make two PDFs or send twice
  const acting = useRef(false);
  const once = (run: () => Promise<void>) => async () => {
    if (acting.current) return;
    acting.current = true;
    try {
      await run();
    } finally {
      acting.current = false;
    }
  };

  const createPdf = once(async () => {
    const gap = missing();
    setProblem(gap);
    if (gap) {
      if (gap.field === "diagnosis") diagnosisRef.current?.focus();
      else
        document
          .querySelector(`[data-problem="true"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy("pdf");
    try {
      await rx.flush();
      rx.setSaved(await createPrescriptionPdf(target));
      window.setTimeout(
        () =>
          document
            .getElementById("pdf")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        60,
      );
    } catch (caught) {
      fail(caught, "The PDF was not made. Try again.");
    } finally {
      setBusy(null);
    }
  });

  const send = once(async () => {
    setBusy("send");
    setProblem(null);
    try {
      onSent(await sendPrescription(target));
    } catch (caught) {
      fail(caught, "The prescription was not sent. Try again.");
    } finally {
      setBusy(null);
    }
  });

  const drop = once(async () => {
    setBusy("drop");
    try {
      await discardNewVersion(target);
      onDropped();
    } catch (caught) {
      toast(errorMessage(caught, "That did not work. Try again."));
    } finally {
      setBusy(null);
    }
  });

  const field = (
    key: "diagnosis" | "patientHistory" | "remarks" | "advice",
    label: string,
    hint?: string,
    picks?: { options: string[]; perLine?: boolean; menu?: boolean },
  ) => (
    <div
      className={styles.field}
      data-problem={problem?.field === key || undefined}
    >
      <label htmlFor={`rx-${key}`} className={styles.fieldLabel}>
        {label}
        {hint && <span className={styles.fieldHint}>{hint}</span>}
      </label>
      {picks && (
        <QuickPicks
          label={label}
          options={picks.options}
          perLine={picks.perLine}
          menu={picks.menu}
          text={draft[key]}
          onChange={(text) => {
            change({ [key]: text });
            if (problem?.field === key) setProblem(null);
          }}
        />
      )}
      <textarea
        id={`rx-${key}`}
        ref={key === "diagnosis" ? diagnosisRef : undefined}
        className={styles.textarea}
        value={draft[key]}
        rows={key === "diagnosis" ? 2 : 3}
        maxLength={key === "diagnosis" || key === "remarks" ? 2000 : 4000}
        aria-invalid={problem?.field === key || undefined}
        onChange={(e) => {
          change({ [key]: e.target.value });
          if (problem?.field === key) setProblem(null);
        }}
      />
    </div>
  );

  // a draft that can be given up: a new version (the sent one stays), or one written with no consultation
  const droppable = revising || (target.kind === "patient" && Boolean(saved));

  return (
    <>
      <section className={clinicStyles.panel} aria-labelledby="rx-heading">
        <div className={clinicStyles.panelHead}>
          <h2 id="rx-heading" className={clinicStyles.h2}>
            {revising ? "Prescription, new version" : "Prescription"}
          </h2>
          <span className={styles.writerSide}>
            <SavedLine
              state={rx.state}
              savedAt={saved?.savedAt ?? null}
              problem={rx.problem}
            />
            <button type="button" className={styles.textBtn} onClick={onClose}>
              Close
            </button>
          </span>
        </div>
        {last && !revising && (
          <div className={styles.fromLast}>
            <span className="num">
              {fromLast
                ? `Filled in from the last prescription, ${last.sentAt ? shortDate(last.sentAt) : ""}, ${last.doctorName}. Change only what is different.`
                : `Last prescription: ${last.sentAt ? shortDate(last.sentAt) : ""}, ${last.doctorName}.`}
            </span>
            {last.pdf && (
              <FileOpenButton
                load={() => getFile(last.pdf!)}
                className={styles.textBtn}
              >
                {(opening) => (opening ? "Opening" : "View it")}
              </FileOpenButton>
            )}
          </div>
        )}
        {field("diagnosis", "Diagnosis", "Needed for the PDF", {
          options: DIAGNOSES,
          menu: true,
        })}
        {field("patientHistory", "Patient history")}
        {field("remarks", "Remarks")}
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Medicines
            {/* said before the doctor writes, not found out at Create PDF */}
            <span className={styles.fieldHint}>One month at most</span>
          </span>
          <MedicineLines
            lines={draft.medicines}
            maxDays={31}
            problemKey={problem?.line ?? null}
            onChange={(medicines) => {
              change({ medicines });
              if (problem?.line) setProblem(null);
            }}
          />
        </div>
        {field("advice", "Advice", undefined, {
          options: ADVICE,
          perLine: true,
        })}
      </section>

      {saved?.pdf && pdfReady && (
        <PdfPanel
          path={saved.pdf}
          version={saved.pdfMadeAt ?? saved.id}
          heading="The PDF the patient will get"
        />
      )}

      <div className={styles.bar} role="region" aria-label="Prescription">
        <div className={styles.barInner}>
          {problem && (
            <p className={styles.barProblem} role="alert">
              {problem.text}
            </p>
          )}
          <div className={styles.barRow}>
            <p className={styles.barText}>
              {pdfReady
                ? "Check the PDF above, then send it."
                : revising
                  ? "This new version replaces the one the patient has, once sent."
                  : "The PDF shows here before anything is sent."}
            </p>
            {droppable && !pdfReady && (
              <button
                type="button"
                className={`btn btn--ghost ${styles.open}`}
                onClick={drop}
                disabled={busy !== null}
              >
                {busy === "drop"
                  ? "One moment"
                  : revising
                    ? "Keep the version already sent"
                    : "Discard this prescription"}
              </button>
            )}
            <button
              type="button"
              className={`btn ${styles.barGo}`}
              onClick={pdfReady ? send : createPdf}
              data-busy={busy === "pdf" || busy === "send"}
              aria-busy={busy === "pdf" || busy === "send"}
            >
              <span>
                {pdfReady
                  ? busy === "send"
                    ? "Sending"
                    : "Send to patient"
                  : busy === "pdf"
                    ? "Creating the PDF"
                    : "Create PDF"}
              </span>
              <span className="well" aria-hidden="true">
                {busy === "pdf" || busy === "send" ? (
                  <i className={formStyles.spin} />
                ) : (
                  <ArrowRight size={18} />
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
