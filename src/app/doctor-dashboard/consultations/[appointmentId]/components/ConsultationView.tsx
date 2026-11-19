"use client";

/*
  One consultation, top to bottom (doctor portal v2 PRD, "The consultation page"; 17 Nov 2026 call:
  "wherever the patient's profile opens, keep everything right there"):
  1. The patient and the consultation, with Join video call (a new tab, so this page stays open).
  2. Reports: every report on the account, any date, each opening its PDF.
  3. The last prescription (follow-ups), with Copy into today's.
  4. The prescription: what we know filled in (age, sex, height, weight, BMI, allergies), then diagnosis
     (the only required field), history, remarks, medicines and advice. It saves as the doctor types.
  5. A bar fixed at the bottom with the one next step: Create PDF, then Send to patient (the PDF shows on
     the page first, and that is the check: no "are you sure"), then "Sent to patient, 7:42 pm" with
     Send again and Edit and send new version.
  Data: GET /api/doctor/consultations/:id and the prescription routes (consultationService).
*/

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, VideoCamera } from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import FileOpenButton from "@/components/ui/FileOpenButton";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { useNow } from "@/hooks/useNow";
import { openCallTab } from "@/lib/consultations/callTab";
import { clockTime, shortDate } from "@/lib/format/dateTime";
import { errorMessage } from "@/lib/http/apiClient";
import { medicineLineWords } from "@/lib/format/medicineLine";
import {
  createPrescriptionPdf,
  discardNewVersion,
  getConsultation,
  revisePrescription,
  sendPrescription,
  sendPrescriptionAgain,
} from "@/services/consultationService";
import { getFile } from "@/services/fileService";
import type {
  ConsultationPage,
  MedicineLine,
  Prescription,
} from "@/types/consultation";
import ClinicSkeleton from "@/app/doctor-dashboard/components/ClinicSkeleton";
import {
  factsLine,
  sentWords,
  whenWords,
} from "@/app/doctor-dashboard/components/consultations/consultationWords";
import MedicineLines, { newKey } from "./MedicineLines";
import PdfPanel from "./PdfPanel";
import { usePrescriptionDraft, type SaveState } from "./usePrescriptionDraft";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "./ConsultationPage.module.css";

const BACK = { href: "/doctor-dashboard", label: "Today" };

export default function ConsultationView({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const page = useApiResource(`consultation-${appointmentId}`, () =>
    getConsultation(appointmentId),
  );
  if (page.error && !page.data) {
    return (
      <main className={`${clinicStyles.page} ${styles.page}`}>
        <PageHead
          className={clinicStyles.pageHead}
          title="Consultation"
          back={BACK}
        />
        <ErrorNotice message={page.error} onRetry={page.reload} />
      </main>
    );
  }
  if (!page.data) {
    return (
      <main className={`${clinicStyles.page} ${styles.page}`}>
        <ClinicSkeleton />
      </main>
    );
  }
  return <Loaded key={appointmentId} data={page.data} reload={page.reload} />;
}

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

function Loaded({
  data,
  reload,
}: {
  data: ConsultationPage;
  reload: () => void;
}) {
  const toast = useToast();
  const now = useNow(30_000);
  const { consultation: c, patient: p } = data;
  const rx = usePrescriptionDraft(c.id, data.prescription);
  const { draft, change, saved } = rx;
  const [busy, setBusy] = useState<
    null | "pdf" | "send" | "again" | "revise" | "keep"
  >(null);
  const [problem, setProblem] = useState<{
    text: string;
    field?: "diagnosis";
    line?: string;
  } | null>(null);
  const diagnosisRef = useRef<HTMLTextAreaElement>(null);
  const sent = saved?.status === "SENT";
  // a new version of a sent prescription is being written
  const revising = saved?.status === "DRAFT" && Boolean(c.sentAt);
  const pdfReady = Boolean(
    saved &&
      saved.status === "DRAFT" &&
      saved.pdf &&
      saved.pdfMadeAt &&
      rx.state === "saved",
  );

  // the call: open from 10 minutes before the start until the doctor ends it (the server decides; it stays
  // open after a mid-call send, so a dropped call can be rejoined from here)
  const callOpen =
    c.callOpen ||
    (c.state === "UPCOMING" && Date.parse(c.startsAt) - 10 * 60_000 <= now);
  // the prescription is written ahead if the doctor likes, but made and sent only once the call opens
  const beforeCall = c.state === "UPCOMING" && !callOpen;
  const opensAt = clockTime(new Date(Date.parse(c.startsAt) - 10 * 60_000));
  useEffect(() => {
    // the page learns when the call opens or ends while it sits open
    const back = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, [reload]);

  // the prescription moved on elsewhere (sent from Today's row, or in another tab): the page catches up, unless
  // the doctor has typed something not yet saved (then the save's refusal says what happened). Only a fresh
  // answer from the server counts: the page's own steps (a new version, a send) are already in `saved`.
  const server = data.prescription;
  const seen = useRef(server);
  useEffect(() => {
    if (server === seen.current || rx.state === "saving") return;
    seen.current = server;
    if (!server || !saved) return;
    if (server.id === saved.id && server.status === saved.status) return;
    rx.reset(server);
  }, [server, saved, rx]);

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
      // without a plan (the nano plan) the prescription is for one month: said here, as the server does
      const days =
        line.durationValue *
        (line.durationUnit === "MONTHS"
          ? 30
          : line.durationUnit === "WEEKS"
            ? 7
            : 1);
      if (!p.onPlan && days > 31)
        return {
          text: `This patient is not on a plan yet, so the prescription is for one month. Set ${which} to 1 month or less.`,
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
      const made = await createPrescriptionPdf(c.id);
      rx.setSaved(made);
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
      const done = await sendPrescription(c.id);
      // the bar now reads "Sent to patient, 7:42 pm": no toast saying it twice over the bar
      rx.reset(done);
      reload();
    } catch (caught) {
      fail(caught, "The prescription was not sent. Try again.");
    } finally {
      setBusy(null);
    }
  });

  const again = once(async () => {
    setBusy("again");
    try {
      const done = await sendPrescriptionAgain(c.id);
      rx.setSaved(done); // the bar adds "again at 7:50 pm"
    } catch (caught) {
      toast(errorMessage(caught, "It was not sent again. Try again."));
    } finally {
      setBusy(null);
    }
  });

  const revise = once(async () => {
    setBusy("revise");
    try {
      rx.reset(await revisePrescription(c.id));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      toast(
        errorMessage(caught, "The new version could not be opened. Try again."),
      );
    } finally {
      setBusy(null);
    }
  });

  const keepSent = once(async () => {
    setBusy("keep");
    try {
      rx.reset(await discardNewVersion(c.id));
      reload();
    } catch (caught) {
      toast(errorMessage(caught, "That did not work. Try again."));
    } finally {
      setBusy(null);
    }
  });

  const copyLast = () => {
    const last = data.lastPrescription;
    if (!last) return;
    const have = new Set(
      draft.medicines.map((m) => m.medicineId ?? m.name.toLowerCase()),
    );
    const add = last.medicines
      .filter((m) => !have.has(m.medicineId ?? m.name.toLowerCase()))
      .map(
        (m): MedicineLine => ({
          key: newKey(),
          medicineId: m.medicineId,
          name: m.name,
          genericName: m.genericName ?? null,
          dose: m.dose,
          frequency: m.frequency,
          frequencyOther: m.frequencyOther,
          durationValue: m.durationValue ?? 30,
          durationUnit: m.durationUnit ?? "DAYS",
          intake: m.intake,
          unlisted: m.unlisted,
        }),
      );
    change({ medicines: [...draft.medicines, ...add] });
    toast(
      add.length
        ? `Copied ${add.length} ${add.length === 1 ? "medicine" : "medicines"} from ${shortDate(last.at)}`
        : "Those medicines are already on today's",
    );
  };

  const vitals = [
    p.age ? `Age ${p.age}` : null,
    p.sex || null,
    p.heightCm ? `Height ${p.heightCm} cm` : null,
    p.weightKg
      ? `Weight ${p.weightKg} kg${p.monthChangeKg ? ` (${p.monthChangeKg < 0 ? "down" : "up"} ${Math.abs(p.monthChangeKg)} kg in the last month)` : ""}`
      : null,
    p.bmi ? `BMI ${p.bmi}` : null,
  ].filter(Boolean);

  const field = (
    key: "diagnosis" | "patientHistory" | "remarks" | "advice",
    label: string,
    hint?: string,
  ) => (
    <label
      className={styles.field}
      data-problem={problem?.field === key || undefined}
    >
      <span className={styles.fieldLabel}>
        {label}
        {hint && <span className={styles.fieldHint}>{hint}</span>}
      </span>
      <textarea
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
    </label>
  );

  return (
    <main className={`${clinicStyles.page} ${styles.page}`}>
      <PageHead
        className={clinicStyles.pageHead}
        back={BACK}
        title={p.name}
        sub={
          <>
            {factsLine(c)}.{" "}
            <span className="num">{whenWords(c.startsAt, now)}</span>
          </>
        }
      />
      {(c.reason || callOpen || c.state === "UPCOMING") && (
        // the call has its own row under the name, so a long name keeps one line and a phone gets a full-width Join
        <div className={styles.callRow}>
          {c.reason && (
            <p className={styles.reason}>Reason for the visit: {c.reason}</p>
          )}
          {callOpen ? (
            <button
              type="button"
              className={`btn ${styles.join}`}
              onClick={() => openCallTab(c.id)}
            >
              <span>Join video call</span>
              <span className="well" aria-hidden="true">
                <VideoCamera size={18} weight="fill" />
              </span>
            </button>
          ) : c.state === "UPCOMING" ? (
            <span className={styles.opens}>The call opens at {opensAt}</span>
          ) : null}
        </div>
      )}

      <section className={clinicStyles.panel} aria-labelledby="reports-heading">
        <h2 id="reports-heading" className={clinicStyles.h2}>
          Reports
        </h2>
        {data.reports.length === 0 ? (
          <p className={clinicStyles.empty}>No reports on this account yet.</p>
        ) : (
          <ul className={styles.reports}>
            {data.reports.map((r) => (
              <li key={r.id} className={styles.report}>
                <span className={styles.reportName}>
                  <strong>{r.title}</strong>
                  <span>
                    {r.source === "UPLOAD"
                      ? "Uploaded by the patient"
                      : "From the lab"}
                  </span>
                </span>
                <span className={`${styles.reportDate} num`}>
                  {shortDate(r.at)} {new Date(r.at).getFullYear()}
                </span>
                <FileOpenButton
                  load={() => getFile(r.file)}
                  className={`btn btn--ghost ${styles.open}`}
                >
                  {(opening) => (opening ? "Opening" : "Open")}
                </FileOpenButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.lastPrescription && (
        <section className={clinicStyles.panel} aria-labelledby="last-heading">
          <div className={clinicStyles.panelHead}>
            <h2 id="last-heading" className={clinicStyles.h2}>
              Last prescription
            </h2>
            <span className={`${clinicStyles.muted} num`}>
              {shortDate(data.lastPrescription.at)},{" "}
              {data.lastPrescription.doctorName}
            </span>
          </div>
          {data.lastPrescription.diagnosis && (
            <p className={styles.lastText}>{data.lastPrescription.diagnosis}</p>
          )}
          <ul className={styles.lastList}>
            {data.lastPrescription.medicines.map((m, i) => (
              <li key={`${m.key}-${i}`}>
                <strong>{m.name}</strong>
                <span>{medicineLineWords(m)}</span>
              </li>
            ))}
          </ul>
          <div className={styles.lastActions}>
            {!sent && data.lastPrescription.medicines.length > 0 && (
              <button
                type="button"
                className={`btn btn--ghost ${styles.open}`}
                onClick={copyLast}
              >
                Copy into today&apos;s
              </button>
            )}
            <FileOpenButton
              load={() => getFile(data.lastPrescription?.pdf ?? "")}
              className={styles.textBtn}
            >
              {(opening) => (opening ? "Opening" : "View its PDF")}
            </FileOpenButton>
          </div>
        </section>
      )}

      {!sent && (
        <section className={clinicStyles.panel} aria-labelledby="rx-heading">
          <div className={clinicStyles.panelHead}>
            <h2 id="rx-heading" className={clinicStyles.h2}>
              {revising ? "Prescription, new version" : "Prescription"}
            </h2>
            <SavedLine
              state={rx.state}
              savedAt={saved?.savedAt ?? null}
              problem={rx.problem}
            />
          </div>
          <div className={styles.known}>
            <p className="num">
              {vitals.length
                ? vitals.join("  ·  ")
                : "Age, height and weight are not recorded yet."}
            </p>
            <p>
              Allergies: {p.allergies || "not recorded"}
              {p.conditions.length > 0 && (
                <>. Conditions: {p.conditions.join(", ")}</>
              )}
            </p>
          </div>
          {field("diagnosis", "Diagnosis", "Needed for the PDF")}
          {field("patientHistory", "Patient history")}
          {field("remarks", "Remarks")}
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Medicines
              {!p.onPlan && (
                // the nano plan (12 Nov 2026 call): said before the doctor writes, not found out at Create PDF
                <span className={styles.fieldHint}>
                  One month at most: this patient is not on a plan yet
                </span>
              )}
            </span>
            <MedicineLines
              lines={draft.medicines}
              problemKey={problem?.line ?? null}
              onChange={(medicines) => {
                change({ medicines });
                if (problem?.line) setProblem(null);
              }}
            />
          </div>
          {field("advice", "Advice")}
        </section>
      )}

      {saved?.pdf && (sent || pdfReady) && (
        <PdfPanel
          path={saved.pdf}
          version={saved.pdfMadeAt ?? saved.id}
          heading={
            sent
              ? `Prescription, version ${saved.version}`
              : "The PDF the patient will get"
          }
        />
      )}

      <div className={styles.bar} role="region" aria-label="Prescription">
        <div className={styles.barInner}>
          {problem && (
            <p className={styles.barProblem} role="alert">
              {problem.text}
            </p>
          )}
          {sent ? (
            <SentBar
              rx={saved!}
              busy={busy}
              onAgain={again}
              onRevise={revise}
            />
          ) : pdfReady ? (
            <div className={styles.barRow}>
              <p className={styles.barText}>
                Check the PDF above, then send it.
              </p>
              <button
                type="button"
                className={`btn ${styles.barGo}`}
                onClick={send}
                data-busy={busy === "send"}
                aria-busy={busy === "send"}
              >
                <span>{busy === "send" ? "Sending" : "Send to patient"}</span>
                <span className="well" aria-hidden="true">
                  {busy === "send" ? (
                    <i className={formStyles.spin} />
                  ) : (
                    <ArrowRight size={18} />
                  )}
                </span>
              </button>
            </div>
          ) : beforeCall ? (
            <div className={styles.barRow}>
              <p className={styles.barText}>
                You can write now. The PDF can be made once the call opens at{" "}
                {opensAt}.
              </p>
            </div>
          ) : (
            <div className={styles.barRow}>
              <p className={styles.barText}>
                {revising
                  ? "This new version replaces the one the patient has, once sent."
                  : "The PDF shows here before anything is sent."}
              </p>
              {revising && (
                <button
                  type="button"
                  className={`btn btn--ghost ${styles.open}`}
                  onClick={keepSent}
                  disabled={busy !== null}
                >
                  {busy === "keep"
                    ? "Keeping it"
                    : "Keep the version already sent"}
                </button>
              )}
              <button
                type="button"
                className={`btn ${styles.barGo}`}
                onClick={createPdf}
                data-busy={busy === "pdf"}
                aria-busy={busy === "pdf"}
              >
                <span>
                  {busy === "pdf" ? "Creating the PDF" : "Create PDF"}
                </span>
                <span className="well" aria-hidden="true">
                  {busy === "pdf" ? (
                    <i className={formStyles.spin} />
                  ) : (
                    <ArrowRight size={18} />
                  )}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function SentBar({
  rx,
  busy,
  onAgain,
  onRevise,
}: {
  rx: Prescription;
  busy: string | null;
  onAgain: () => void;
  onRevise: () => void;
}) {
  return (
    <div className={styles.barRow}>
      <p className={`${styles.barText} ${styles.sentText} num`}>
        <Check size={18} weight="bold" aria-hidden="true" />
        {rx.sentAt
          ? `${sentWords(rx.sentAt).replace(/^Sent/, "Sent to patient,")}`
          : "Sent to patient"}
        {rx.resentAt && (
          <span className={styles.again}>
            , again at {clockTime(new Date(rx.resentAt))}
          </span>
        )}
      </p>
      <div className={styles.barButtons}>
        <button
          type="button"
          className={`btn btn--ghost ${styles.open}`}
          onClick={onAgain}
          disabled={busy !== null}
        >
          {busy === "again" ? "Sending" : "Send again"}
        </button>
        <button
          type="button"
          className={`btn btn--ghost ${styles.open}`}
          onClick={onRevise}
          disabled={busy !== null}
        >
          {busy === "revise" ? "Opening" : "Edit and send new version"}
        </button>
      </div>
    </div>
  );
}
