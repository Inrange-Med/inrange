"use client";

/*
  /admin: eligibility reviews. Waiting first, oldest at the top; a decision takes the patient off the
  list at once (once the backend has saved it) and puts them at the top of Recently decided, folded
  away below, where a decision can be changed.
*/

import { CaretDown } from "@phosphor-icons/react";
import Card from "@/components/ui/Card";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import { useNow } from "@/hooks/useNow";
import { useSessionUser } from "@/hooks/useSessionUser";
import { listReviews } from "@/services/adminService";
import type { EligibilityReview, ReviewDecision } from "@/types/admin";
import surfaceStyles from "@/components/ui/styles/CardSurface.module.css";
import ReviewItem from "./ReviewItem";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";

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
      waiting: others(reviews.data.waiting),
      decided: [decided, ...others(reviews.data.decided)],
    });
  };

  const waiting = [...(reviews.data?.waiting ?? [])].sort((a, b) =>
    a.waitingSince.localeCompare(b.waitingSince),
  );
  const decided = reviews.data?.decided ?? [];

  return (
    <main className={adminStyles.page}>
      <PageHead
        className={adminStyles.pageHead}
        title="Reviews"
        sub="Eligibility checks waiting for a decision, oldest first. A note on Not approved is shown to the patient."
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
