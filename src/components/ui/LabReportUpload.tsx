"use client";

/**
 * Upload a lab report: the date on the report first, then the file. The care team reviews reports
 * from the last 90 days only (the team's rule; the backend checks it again), so the file can be
 * chosen once the date passes. Used on /pricing, /onboarding and /patient-dashboard/reports; the
 * page does the upload.
 */

import { useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  FileArrowUp,
  XCircle,
} from "@phosphor-icons/react";
import { toApiDate } from "@/lib/format/dateTime";
import { errorMessage } from "@/lib/http/apiClient";
import type { NewReport } from "@/types/report";
import formStyles from "./styles/FormControls.module.css";
import styles from "./LabReportUpload.module.css";

const MAX_AGE_DAYS = 90;
const MAX_BYTES = 10 * 1024 * 1024;
// the picker's accept list is only a hint (a file manager can still offer "All files")
const REPORT_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const DAY_MS = 864e5;

/** Whole days from the report's date to today, both India dates ("2026-10-28" parses as UTC midnight). */
const daysSince = (isoDate: string) =>
  Math.round(
    (Date.parse(toApiDate(new Date())) - Date.parse(isoDate)) / DAY_MS,
  );

/** Whether the report is recent enough to be reviewed, worded for the person. */
function dateCheck(isoDate: string, tooOldAdvice: string) {
  const days = daysSince(isoDate);
  if (days < 0)
    return { valid: false, message: "Report date cannot be in the future." };
  if (days <= MAX_AGE_DAYS)
    return {
      valid: true,
      message: `Report verified (${days} days old). Valid for consultation (Within 3 months limit).`,
    };
  return {
    valid: false,
    message: `Report is ${days} days old (>90 days). Doctor consultation requires a report under 3 months.${tooOldAdvice ? ` ${tooOldAdvice}` : ""}`,
  };
}

/** "820.4 KB", "2.1 MB" */
const fileSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function LabReportUpload({
  dateLabel,
  chooseLabel,
  submitLabel,
  tooOldAdvice = "",
  onUpload,
}: {
  dateLabel: string;
  chooseLabel: string;
  submitLabel: string;
  tooOldAdvice?: string;
  onUpload: (report: NewReport) => Promise<void>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [reportDate, setReportDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = reportDate ? dateCheck(reportDate, tooOldAdvice) : null;
  const ready = Boolean(check?.valid && file);

  const pick = (chosen: File | undefined) => {
    if (!chosen) return;
    const problem = !REPORT_TYPES.includes(chosen.type)
      ? "Choose a PDF, PNG or JPEG file."
      : chosen.size > MAX_BYTES
        ? "This file is over 10 MB. Choose a smaller one."
        : null;
    setError(problem);
    setFile(problem ? null : chosen);
  };

  const submit = async () => {
    if (!ready || !file || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onUpload({
        file,
        reportDate,
        title: file.name.replace(/\.[^.]+$/, ""),
      });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.form}>
      <label className={formStyles.field}>
        <span className={formStyles.label}>{dateLabel}</span>
        <input
          type="date"
          className={formStyles.input}
          value={reportDate}
          max={toApiDate(new Date())}
          aria-invalid={check ? !check.valid : undefined}
          onChange={(event) => setReportDate(event.target.value)}
        />
      </label>
      {check && (
        <p
          className={check.valid ? styles.ok : formStyles.err}
          role={check.valid ? "status" : "alert"}
        >
          {check.valid ? (
            <CheckCircle size={16} weight="bold" aria-hidden="true" />
          ) : (
            <XCircle size={16} weight="bold" aria-hidden="true" />
          )}
          <span>{check.message}</span>
        </p>
      )}

      <input
        ref={fileInput}
        type="file"
        accept=".pdf,image/png,image/jpeg"
        hidden
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className={styles.zone}
        disabled={!check?.valid}
        onClick={() => fileInput.current?.click()}
      >
        <FileArrowUp size={28} aria-hidden="true" />
        <strong>{file ? file.name : chooseLabel}</strong>
        <span className="num">
          {file
            ? `${fileSize(file.size)}. Tap to change.`
            : check?.valid
              ? "A PDF or photo, up to 10 MB"
              : "Enter the date on the report first, within the last 3 months"}
        </span>
      </button>

      {error && (
        <p className={formStyles.err} role="alert">
          <XCircle size={16} weight="bold" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      <button
        type="button"
        className={`btn ${formStyles.go}`}
        disabled={!ready}
        onClick={submit}
        data-busy={busy}
        aria-busy={busy}
      >
        <span>{busy ? "Uploading" : submitLabel}</span>
        <span className="well" aria-hidden="true">
          {busy ? <i className={formStyles.spin} /> : <ArrowRight size={18} />}
        </span>
      </button>
    </div>
  );
}
