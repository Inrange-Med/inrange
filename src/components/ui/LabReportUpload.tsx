"use client";

/**
 * Upload a lab report: choose the file, then send it. There is no date to type: a typed date proves
 * nothing, so the medical team reads the date printed on the report (and the backend reads the file's
 * own details). Used on /onboarding and /patient-dashboard/reports; the page does the upload.
 */

import { useRef, useState } from "react";
import { ArrowRight, FileArrowUp, XCircle } from "@phosphor-icons/react";
import { errorMessage } from "@/lib/http/apiClient";
import type { NewReport } from "@/types/report";
import formStyles from "./styles/FormControls.module.css";
import styles from "./LabReportUpload.module.css";

const MAX_BYTES = 10 * 1024 * 1024;
// the picker's accept list is only a hint (a file manager can still offer "All files")
const REPORT_TYPES = ["application/pdf", "image/png", "image/jpeg"];

/** "820.4 KB", "2.1 MB" */
const fileSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function LabReportUpload({
  chooseLabel,
  submitLabel,
  onUpload,
}: {
  chooseLabel: string;
  submitLabel: string;
  onUpload: (report: NewReport) => Promise<void>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = Boolean(file);

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
      await onUpload({ file, title: file.name.replace(/\.[^.]+$/, "") });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.form}>
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
        onClick={() => fileInput.current?.click()}
      >
        <FileArrowUp size={28} aria-hidden="true" />
        <strong>{file ? file.name : chooseLabel}</strong>
        <span className="num">
          {file
            ? `${fileSize(file.size)}. Tap to change.`
            : "A PDF or a clear photo of the full report, from the last 3 months. Up to 10 MB."}
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
