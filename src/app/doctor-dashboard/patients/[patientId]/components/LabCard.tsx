"use client";

/*
  One lab report in the record (Arhaan's LabCard): what is out of range leads and the rest is one
  tap away, each result beside the previous report's value. A report waiting on the doctor has a
  review form: the note goes to the patient with the report.
*/

import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Certificate,
} from "@phosphor-icons/react";
import FileOpenButton from "@/components/ui/FileOpenButton";
import { useToast } from "@/components/ui/ToastProvider";
import { shortDate } from "@/lib/format/dateTime";
import { errorMessage } from "@/lib/http/apiClient";
import { getFile } from "@/services/fileService";
import { reviewLabReport } from "@/services/patientRecordService";
import type { LabReport } from "@/types/patientRecord";
import LabResultStatus from "./LabResultStatus";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "./LabCard.module.css";

/** Results keep the precision of their reference range: creatinine 1.0, never 1. */
const shown = (value: number, range: string) =>
  /\d\.\d/.test(range) ? value.toFixed(1) : String(value);

export default function LabCard({
  patientId,
  lab,
  older,
  onChanged,
}: {
  patientId: string;
  lab: LabReport;
  older?: LabReport;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const outOfRange = lab.results.filter((result) => result.flag !== "NORMAL");
  const [all, setAll] = useState(outOfRange.length === 0);
  const rows = all ? lab.results : outOfRange;
  const before = (test: string) =>
    older?.results.find((result) => result.test === test)?.value;
  const pending = lab.status === "DOCTOR_REVIEW_PENDING";
  // still at the lab: never called reviewed
  const waiting = lab.status === "PROCESSING";
  const uploaded = lab.source === "UPLOAD";

  const review = async () => {
    setSaving(true);
    try {
      await reviewLabReport(patientId, lab.id, comment.trim());
      toast("Report marked reviewed. The patient sees your note.");
      onChanged();
    } catch (caught) {
      toast(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.lab} data-pending={pending}>
      <div className={styles.labHead}>
        <div>
          <strong>{lab.packageName}</strong>
          <span>
            {uploaded ? "Dated" : "Collected"} {shortDate(lab.collectedAt)}
            {lab.reportedAt &&
              `, ${uploaded ? "uploaded" : "reported"} ${shortDate(lab.reportedAt)}`}
            , {uploaded ? "from the patient" : "partner lab"}
          </span>
        </div>
        {waiting ? (
          <span className={clinicStyles.pill} data-tone="pending">
            Awaiting results
          </span>
        ) : pending ? (
          <span className={clinicStyles.pill} data-tone="warn">
            Needs your review
          </span>
        ) : (
          <span className={clinicStyles.pill} data-tone="ok">
            <Certificate size={14} weight="fill" /> Reviewed{" "}
            {lab.reviewedAt && shortDate(lab.reviewedAt)}
          </span>
        )}
      </div>
      {waiting ? (
        <p className={clinicStyles.muted}>
          Sample collected {shortDate(lab.collectedAt)}. Results come from the
          partner lab and appear here for your review.
        </p>
      ) : !lab.results.length ? (
        <p className={clinicStyles.muted}>
          The values are in the report file.{" "}
          {lab.file && (
            <FileOpenButton
              className={`${clinicStyles.textBtn} ${styles.inlineOpen}`}
              load={() => getFile(lab.file ?? "")}
            >
              {(opening) => (opening ? "Opening" : "Open the report")}
            </FileOpenButton>
          )}
        </p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Test</th>
                  <th scope="col">Result</th>
                  {older && <th scope="col">Before</th>}
                  <th scope="col" className={styles.refCol}>
                    Reference
                  </th>
                  <th scope="col">
                    <span className="sr-only">Status</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((result) => {
                  const previous = before(result.test);
                  return (
                    <tr key={result.test}>
                      <th scope="row">{result.test}</th>
                      <td className="num">
                        <strong>{shown(result.value, result.range)}</strong>{" "}
                        {result.unit}
                        <small className={styles.refUnder}>
                          {result.range}
                        </small>
                      </td>
                      {older && (
                        <td className="num">
                          {previous !== undefined ? (
                            <span className={styles.trend}>
                              {shown(previous, result.range)}
                              {previous !== result.value &&
                                (result.value < previous ? (
                                  <ArrowDown size={13} aria-label="down" />
                                ) : (
                                  <ArrowUp size={13} aria-label="up" />
                                ))}
                            </span>
                          ) : (
                            "Not tested"
                          )}
                        </td>
                      )}
                      <td className={`num ${styles.refCol}`}>{result.range}</td>
                      <td>
                        <LabResultStatus
                          result={result}
                          before={previous}
                          reviewed={lab.status === "REVIEWED"}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {outOfRange.length > 0 && outOfRange.length < lab.results.length && (
            <button
              type="button"
              className={clinicStyles.textLink}
              onClick={() => setAll((showing) => !showing)}
            >
              {all
                ? "Out of range only"
                : `Show all ${lab.results.length} results`}
            </button>
          )}
        </>
      )}
      {pending && !waiting ? (
        <form
          className={styles.reviewForm}
          onSubmit={(event) => {
            event.preventDefault();
            review();
          }}
        >
          <label className={clinicStyles.label} htmlFor={`review-${lab.id}`}>
            Note for the patient{" "}
            <span className={clinicStyles.muted}>shown with the report</span>
          </label>
          <textarea
            id={`review-${lab.id}`}
            className={clinicStyles.textarea}
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="What these results mean for them, in plain words"
          />
          <button
            type="submit"
            className="btn"
            disabled={!comment.trim() || saving}
          >
            <span>Mark reviewed</span>
            <span className="well" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </button>
        </form>
      ) : (
        lab.doctorComment && (
          <blockquote className={styles.quote}>
            <p>{lab.doctorComment}</p>
            <cite>Your note to the patient</cite>
          </blockquote>
        )
      )}
    </div>
  );
}
