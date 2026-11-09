"use client";

/*
  One eligibility review: who, how they reached review, their reports, and the decision. Waiting, it
  shows Approve and Not approved; Not approved asks for a note first (the patient sees it). Decided,
  it shows the decision, the note, who and when, and Change decision opens the same two actions.
*/

import { useState } from "react";
import { ArrowSquareOut, FileText } from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import { useToast } from "@/components/ui/ToastProvider";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import { clockTime, shortDate } from "@/lib/format/dateTime";
import { spacedMobile } from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import { decideReview } from "@/services/adminService";
import type { EligibilityReview, ReviewDecision } from "@/types/admin";
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
    <li className={adminStyles.item}>
      <div className={adminStyles.itemHead}>
        <strong className={adminStyles.name}>
          {review.name || "Name not given"}
        </strong>
        {waiting ? (
          <span className={`${adminStyles.pill} num`} data-tone="pending">
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
            <li key={report.id}>
              {report.url ? (
                <a href={report.url} target="_blank" rel="noopener noreferrer">
                  <FileText size={18} aria-hidden="true" />
                  {report.title}, {shortDate(report.uploadedAt)}
                  <ArrowSquareOut size={14} aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : (
                <span>
                  <FileText size={18} aria-hidden="true" />
                  {report.title}: the file could not be opened
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={adminStyles.muted}>No report attached yet.</p>
      )}

      {!waiting && (
        <>
          {review.note && <p className={adminStyles.note}>{review.note}</p>}
          <p className={adminStyles.muted}>
            {[review.decidedBy, review.decidedAt && when(review.decidedAt)]
              .filter(Boolean)
              .join(", ")}
          </p>
        </>
      )}

      {noteOpen && (
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor={noteId}>
            Note for the patient
          </label>
          <textarea
            id={noteId}
            className={adminStyles.textarea}
            rows={3}
            maxLength={500}
            value={note}
            aria-invalid={noteMissing}
            aria-describedby={`${noteId}-hint`}
            onChange={(event) => {
              setNote(event.target.value);
              setNoteMissing(false);
            }}
          />
          <p
            id={`${noteId}-hint`}
            className={noteMissing ? formStyles.err : formStyles.hint}
          >
            {noteMissing
              ? "Add a short note. The patient reads it."
              : "The patient reads this. Say what happens next."}
          </p>
        </div>
      )}

      {error && <ErrorNotice message={error} />}

      {showActions ? (
        <div className={adminStyles.actions}>
          {noteOpen ? (
            <>
              <button
                type="button"
                className={`btn ${adminStyles.solid}`}
                disabled={busy !== null}
                data-busy={busy === "NOT_APPROVED"}
                onClick={() => decide("NOT_APPROVED")}
              >
                {busy === "NOT_APPROVED" && (
                  <span className={formStyles.spin} aria-hidden="true" />
                )}
                {busy === "NOT_APPROVED" ? "Saving" : "Mark not approved"}
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
                className={`btn ${adminStyles.solid}`}
                disabled={busy !== null}
                data-busy={busy === "APPROVED"}
                onClick={() => decide("APPROVED")}
              >
                {busy === "APPROVED" && (
                  <span className={formStyles.spin} aria-hidden="true" />
                )}
                {busy === "APPROVED" ? "Approving" : "Approve"}
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
