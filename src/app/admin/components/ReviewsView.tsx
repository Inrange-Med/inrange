"use client";

/*
  /admin: eligibility reviews. Waiting first, oldest at the top; a decision takes the patient off the
  list at once (once the backend has saved it) and puts them at the top of Recently decided, folded
  away below, where a decision can be changed. Below Waiting: patients whose home blood test is still
  under way, so the team sees what is coming (their report joins Waiting by itself when it arrives).
*/

import { CaretDown } from "@phosphor-icons/react";
import { useState } from "react";
import Card from "@/components/ui/Card";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import { useNow } from "@/hooks/useNow";
import { useSessionUser } from "@/hooks/useSessionUser";
import { clockTime, shortDate } from "@/lib/format/dateTime";
import { spacedMobile } from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import { listReviews, simulateLabStep } from "@/services/adminService";
import { useToast } from "@/components/ui/ToastProvider";
import type {
  AwaitingLab,
  EligibilityReview,
  ReviewDecision,
} from "@/types/admin";
import surfaceStyles from "@/components/ui/styles/CardSurface.module.css";
import ReviewItem from "./ReviewItem";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";

const LAB_WORDS: Record<NonNullable<AwaitingLab["status"]>, string> = {
  PAYMENT_PENDING: "Not paid yet",
  BOOKED: "Collection booked",
  COLLECTOR_ASSIGNED: "Collector assigned",
  SAMPLE_COLLECTED: "Sample collected",
  PROCESSING: "Being tested",
  REPORT_READY: "Report received",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

/** "Sample collected. Collection 13 Nov, 10:00 am" */
function labLine(entry: AwaitingLab) {
  const status = entry.status ? LAB_WORDS[entry.status] : "No booking";
  if (!entry.slotDate) return status;
  const at = entry.slotStart
    ? `, ${clockTime(new Date(`${entry.slotDate}T${entry.slotStart.slice(0, 5)}:00+05:30`))}`
    : "";
  return `${status}. Collection ${shortDate(entry.slotDate)}${at}`;
}

/** Dry runs only: the next lab step, done by hand as if Redcliffe had sent it. */
function SimulateStep({
  entry,
  onDone,
}: {
  entry: AwaitingLab;
  onDone: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const step =
    entry.status === "BOOKED" || entry.status === "COLLECTOR_ASSIGNED"
      ? ({ event: "SAMPLE_COLLECTED", label: "Mark sample collected" } as const)
      : entry.status === "SAMPLE_COLLECTED" || entry.status === "PROCESSING"
        ? ({ event: "REPORT_READY", label: "Send sample report" } as const)
        : null;
  if (!step || !entry.bookingId) return null;
  const bookingId = entry.bookingId;
  return (
    <button
      type="button"
      className={adminStyles.textBtn}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await simulateLabStep(bookingId, step.event);
          onDone();
        } catch (caught) {
          toast(errorMessage(caught, "That step could not be done."));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Working" : `${step.label} (dry run)`}
    </button>
  );
}

export default function ReviewsView() {
  const reviews = useApiResource("admin-reviews", listReviews);
  const { user } = useSessionUser();
  const now = useNow(60_000);

  const onDecided = (
    review: EligibilityReview,
    decision: ReviewDecision,
    note: string,
  ) => {
    if (!reviews.data) return;
    const decided: EligibilityReview = {
      ...review,
      stage: decision,
      note: note || null,
      decidedAt: new Date().toISOString(),
      decidedBy: user?.fullName || "You",
    };
    const others = (list: EligibilityReview[]) =>
      list.filter((entry) => entry.patientId !== review.patientId);
    reviews.setData({
      ...reviews.data,
      waiting: others(reviews.data.waiting),
      decided: [decided, ...others(reviews.data.decided)],
    });
  };

  const waiting = [...(reviews.data?.waiting ?? [])].sort((a, b) =>
    a.waitingSince.localeCompare(b.waitingSince),
  );
  const decided = reviews.data?.decided ?? [];
  const awaitingLab = reviews.data?.awaitingLab ?? [];

  return (
    <main className={adminStyles.page}>
      <PageHead
        className={adminStyles.pageHead}
        title="Reviews"
        sub="Eligibility checks waiting for a decision, oldest first. On each report, check the patient's name, the lab and the date printed on it: it must be from the last 3 months. A note on Not approved is shown to the patient."
      />
      {reviews.error && !reviews.data ? (
        <ErrorNotice message={reviews.error} onRetry={reviews.reload} />
      ) : !reviews.data ? (
        <LoadingSkeleton />
      ) : (
        <div className={adminStyles.stack}>
          <Card
            title="Waiting"
            action={
              <span className={`${adminStyles.count} num`}>
                {waiting.length}
              </span>
            }
          >
            {waiting.length === 0 ? (
              <p className={adminStyles.empty}>
                Nothing is waiting. New eligibility checks appear here as soon
                as a patient sends a report or a home test result arrives.
              </p>
            ) : (
              <ul className={adminStyles.list}>
                {waiting.map((review) => (
                  <ReviewItem
                    key={review.patientId}
                    review={review}
                    now={now}
                    onDecided={onDecided}
                  />
                ))}
              </ul>
            )}
          </Card>

          {awaitingLab.length > 0 && (
            <Card
              title="Waiting on the lab"
              action={
                <span className={`${adminStyles.count} num`}>
                  {awaitingLab.length}
                </span>
              }
            >
              <ul className={adminStyles.list}>
                {awaitingLab.map((entry) => (
                  <li key={entry.patientId} className={adminStyles.labRow}>
                    <span className={adminStyles.labWho}>
                      <strong>{entry.name || "Name not given"}</strong>
                      <span className={`${adminStyles.muted} num`}>
                        {labLine(entry)}
                      </span>
                    </span>
                    <span className={`${adminStyles.facts} num`}>
                      {entry.needsAttention && (
                        <span className={adminStyles.pill} data-tone="new">
                          Needs attention
                        </span>
                      )}
                      <a href={`tel:+91${entry.mobile}`}>
                        {spacedMobile(entry.mobile)}
                      </a>
                      {reviews.data?.labSimulation && (
                        <SimulateStep entry={entry} onDone={reviews.reload} />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {decided.length > 0 && (
            <details className={`${adminStyles.history} ${surfaceStyles.card}`}>
              <summary>
                Recently decided
                <span className={`${adminStyles.count} num`}>
                  {decided.length}
                </span>
                <CaretDown size={18} aria-hidden="true" />
              </summary>
              <ul className={adminStyles.list}>
                {decided.map((review) => (
                  <ReviewItem
                    key={review.patientId}
                    review={review}
                    now={now}
                    onDecided={onDecided}
                  />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </main>
  );
}
