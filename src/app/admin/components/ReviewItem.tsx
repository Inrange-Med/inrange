"use client";

/*
  One eligibility review: who, how they reached review, their reports (each with what the file itself
  says and any reason to look closely), and the decision. Waiting, it
  shows Approve and Not approved; Not approved asks for a note first (the patient sees it). Decided,
  it shows the decision, the note, who and when, and Change decision opens the same two actions.
*/

import { useState } from "react";
import {
  ArrowRight,
  ArrowSquareOut,
  CheckCircle,
  FileText,
  Warning,
} from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import FileOpenButton from "@/components/ui/FileOpenButton";
import { useToast } from "@/components/ui/ToastProvider";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import { clockTime, shortDate } from "@/lib/format/dateTime";
import { spacedMobile } from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import { decideReview } from "@/services/adminService";
import { getFile } from "@/services/fileService";
import type {
  EligibilityReview,
  ReviewDecision,
  ReviewReport,
} from "@/types/admin";
import { reportChecks } from "./reportChecks";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";

const PATH_LABEL = { OWN_REPORT: "Own report", LAB_TEST: "Home lab test" };

/** "12 min", "5 h", "3 days": how long a review has waited. */
function waitedFor(iso: string, now: number) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 6e4));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

const when = (iso: string) => `${shortDate(iso)}, ${clockTime(new Date(iso))}`;

export default function ReviewItem({
  review,
  now,
  onDecided,
}: {
  review: EligibilityReview;
  now: number;
  onDecided: (
    review: EligibilityReview,
    decision: ReviewDecision,
    note: string,
  ) => void;
}) {
  const toast = useToast();
  const waiting = review.stage === "UNDER_REVIEW";
  const [changing, setChanging] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [noteMissing, setNoteMissing] = useState(false);
  const [busy, setBusy] = useState<ReviewDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const noteId = `note-${review.patientId}`;
  const facts = [review.age, review.gender].filter(Boolean).join(", ");

  const decide = async (decision: ReviewDecision) => {
    const text = decision === "NOT_APPROVED" ? note.trim() : "";
    if (decision === "NOT_APPROVED" && !text) {
      setNoteMissing(true);
      return;
    }
    setBusy(decision);
    setError(null);
    try {
      await decideReview(review.patientId, decision, text || undefined);
      toast(
        `${review.name || "Patient"} ${decision === "APPROVED" ? "approved" : "marked not approved"}`,
      );
      setChanging(false);
      setNoteOpen(false);
      setNote("");
      onDecided(review, decision, text);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const showActions = waiting || changing;

  return (
    <li className={adminStyles.review}>
      <div className={adminStyles.itemHead}>
        <strong className={adminStyles.name}>
          {review.name || "Name not given"}
        </strong>
        {waiting ? (
          <span className={`${adminStyles.when} num`}>
            Waiting {waitedFor(review.waitingSince, now)}
          </span>
        ) : (
          <span
            className={adminStyles.pill}
            data-tone={review.stage === "APPROVED" ? "ok" : "pending"}
          >
            {review.stage === "APPROVED" ? "Approved" : "Not approved"}
          </span>
        )}
      </div>
      <p className={`${adminStyles.facts} num`}>
        {facts && <span>{facts}</span>}
        <a href={`tel:+91${review.mobile}`}>{spacedMobile(review.mobile)}</a>
        <span>{PATH_LABEL[review.path]}</span>
      </p>

      {review.reports.length > 0 ? (
        <ul className={adminStyles.reports} aria-label="Reports">
          {review.reports.map((report) => (
            <ReportEntry
              key={report.id}
              report={report}
              isNew={report.reviewStatus === "UNDER_REVIEW"}
              earlier={review.reports.length > 1}
            />
          ))}
        </ul>
      ) : (
        <p className={adminStyles.muted}>No report attached yet.</p>
      )}

      {!waiting && (
        <>
          {review.note && (
            <blockquote className={adminStyles.quote}>
              <p>{review.note}</p>
              <cite>Note to the patient</cite>
            </blockquote>
          )}
          <p className={adminStyles.muted}>
            {[review.decidedBy, review.decidedAt && when(review.decidedAt)]
              .filter(Boolean)
              .join(", ")}
          </p>
        </>
      )}

      {noteOpen && (
        <div className={adminStyles.reviewForm}>
          <label className={adminStyles.label} htmlFor={noteId}>
            Note for the patient{" "}
            <span id={`${noteId}-hint`} className={adminStyles.muted}>
              The patient reads this. Say what happens next.
            </span>
          </label>
          <textarea
            id={noteId}
            className={adminStyles.textarea}
            rows={3}
            maxLength={500}
            value={note}
            aria-invalid={noteMissing}
            aria-describedby={noteMissing ? `${noteId}-error` : undefined}
            onChange={(event) => {
              setNote(event.target.value);
              setNoteMissing(false);
            }}
          />
          {noteMissing && (
            <p id={`${noteId}-error`} className={formStyles.err}>
              Add a short note. The patient reads it.
            </p>
          )}
        </div>
      )}

      {error && <ErrorNotice message={error} />}

      {showActions ? (
        <div className={adminStyles.actions}>
          {noteOpen ? (
            <>
              <button
                type="button"
                className="btn"
                disabled={busy !== null}
                data-busy={busy === "NOT_APPROVED"}
                onClick={() => decide("NOT_APPROVED")}
              >
                <span>
                  {busy === "NOT_APPROVED" ? "Saving" : "Mark not approved"}
                </span>
                <span className="well" aria-hidden="true">
                  {busy === "NOT_APPROVED" ? (
                    <span className={formStyles.spin} />
                  ) : (
                    <ArrowRight size={18} />
                  )}
                </span>
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy !== null}
                data-busy={false}
                onClick={() => {
                  setNoteOpen(false);
                  setNoteMissing(false);
                }}
              >
                Back
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn"
                disabled={busy !== null}
                data-busy={busy === "APPROVED"}
                onClick={() => decide("APPROVED")}
              >
                <span>{busy === "APPROVED" ? "Approving" : "Approve"}</span>
                <span className="well" aria-hidden="true">
                  {busy === "APPROVED" ? (
                    <span className={formStyles.spin} />
                  ) : (
                    <CheckCircle size={18} />
                  )}
                </span>
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy !== null}
                data-busy={false}
                onClick={() => {
                  setNote(
                    review.stage === "NOT_APPROVED" ? (review.note ?? "") : "",
                  );
                  setNoteOpen(true);
                }}
              >
                Not approved
              </button>
              {changing && (
                <button
                  type="button"
                  className={adminStyles.textBtn}
                  onClick={() => setChanging(false)}
                >
                  Keep as it is
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          className={adminStyles.textBtn}
          onClick={() => setChanging(true)}
        >
          Change decision
        </button>
      )}
    </li>
  );
}

/** One report: open it, what the file says about itself, and any reason to look closely. */
function ReportEntry({
  report,
  isNew,
  earlier,
}: {
  report: ReviewReport;
  isNew: boolean;
  /** the patient has more than one report here, so new and earlier are marked */
  earlier: boolean;
}) {
  const { facts, warnings } = reportChecks(report);
  const file = report.file;
  return (
    <li className={adminStyles.report}>
      <div className={adminStyles.reportHead}>
        {file ? (
          <FileOpenButton
            className={adminStyles.reportOpen}
            load={() => getFile(file)}
          >
            {(opening) => (
              <>
                <FileText size={18} aria-hidden="true" />
                {opening ? "Opening" : report.title}
                <ArrowSquareOut size={14} aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </>
            )}
          </FileOpenButton>
        ) : (
          <span className={adminStyles.reportMissing}>
            <FileText size={18} aria-hidden="true" />
            {report.title}: the file is missing
          </span>
        )}
        {earlier && (
          <span
            className={adminStyles.pill}
            data-tone={isNew ? "new" : "pending"}
          >
            {isNew
              ? "New"
              : report.reviewStatus === "NOT_APPROVED"
                ? "Earlier, not approved"
                : "Earlier"}
          </span>
        )}
      </div>
      <p className={`${adminStyles.muted} num`}>
        {report.source === "LAB" ? "Received " : "Uploaded "}
        {when(report.uploadedAt)}, {facts.join(", ")}
      </p>
      {warnings.length > 0 && (
        <ul className={adminStyles.warnings} aria-label="Look closely">
          {warnings.map((warning) => (
            <li key={warning}>
              <Warning size={16} weight="bold" aria-hidden="true" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
