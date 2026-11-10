"use client";

/**
 * One home blood test (GET /api/labs/bookings/:id): its status card (LabBookingStatusCard), the
 * collection details and each test's status once the lab has the sample. The time can be changed
 * (twice at most) or the test cancelled until a collector is assigned, each in its own sheet.
 */

import { useCallback, useEffect, useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { useNow } from "@/hooks/useNow";
import { getLabBooking } from "@/services/labTestService";
import type { LabBooking } from "@/types/labTest";
import CancelSheet from "./CancelSheet";
import LabBookingCollectionCard from "./LabBookingCollectionCard";
import { collectionWindow } from "./labBookingFormat";
import LabBookingStatusCard from "./LabBookingStatusCard";
import LabBookingTestsCard from "./LabBookingTestsCard";
import LabChangeTimeSheet from "./LabChangeTimeSheet";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import styles from "../LabTestsPage.module.css";

const BACK = { href: "/patient-dashboard/lab-tests", label: "Blood tests" };

export default function LabBookingDetailView({
  bookingId,
}: {
  bookingId: string;
}) {
  const bookingResource = useApiResource(`lab-booking-${bookingId}`, () =>
    getLabBooking(bookingId),
  );
  const toast = useToast();
  const now = useNow();
  const [sheet, setSheet] = useState<"move" | "cancel" | null>(null);
  // a stable close, so the open sheet does not re-run its effects on every tick of the clock
  const closeSheet = useCallback(() => setSheet(null), []);
  const booking = bookingResource.data;

  // while the test is under way, read the lab's latest every minute and whenever the page comes back
  // into view, without a loading flash (the backend refreshes from Redcliffe on each read)
  const live =
    booking !== null &&
    ["BOOKED", "COLLECTOR_ASSIGNED", "SAMPLE_COLLECTED", "PROCESSING"].includes(
      booking.status,
    );
  const { setData } = bookingResource;
  useEffect(() => {
    if (!live) return;
    const refresh = () => {
      if (document.visibilityState === "visible")
        getLabBooking(bookingId)
          .then((next) => next && setData(next))
          .catch(() => {});
    };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [live, bookingId, setData]);

  if (bookingResource.loading) {
    return (
      <main className={`${layoutStyles.page} ${layoutStyles.narrow}`}>
        <LoadingSkeleton />
      </main>
    );
  }

  if (bookingResource.error || !booking) {
    return (
      <main className={`${layoutStyles.page} ${layoutStyles.narrow}`}>
        <PageHead title="Blood test" back={BACK} />
        {bookingResource.error ? (
          <ErrorNotice
            message={bookingResource.error}
            onRetry={bookingResource.reload}
          />
        ) : (
          <p className={styles.text}>This booking is not available.</p>
        )}
      </main>
    );
  }

  const updated = (next: LabBooking, message: string) => {
    bookingResource.setData(next);
    setSheet(null);
    toast(message);
  };

  return (
    <main
      className={`${layoutStyles.page} ${layoutStyles.narrow} ${styles.page}`}
    >
      <PageHead
        title={booking.packageName}
        back={BACK}
        sub={<span className="num">{collectionWindow(booking)}, at home</span>}
      />

      <div className={styles.grid}>
        <LabBookingStatusCard
          booking={booking}
          now={now}
          onChangeTime={() => setSheet("move")}
          onCancel={() => setSheet("cancel")}
        />
        <LabBookingCollectionCard booking={booking} />
        {booking.tests.length > 0 && (
          <LabBookingTestsCard tests={booking.tests} />
        )}
      </div>

      <LabChangeTimeSheet
        booking={booking}
        open={sheet === "move"}
        onClose={closeSheet}
        onMoved={(next) => updated(next, `Moved to ${collectionWindow(next)}`)}
      />
      <CancelSheet
        booking={booking}
        open={sheet === "cancel"}
        onClose={closeSheet}
        onCancelled={(next) => updated(next, "Test cancelled")}
      />
    </main>
  );
}
