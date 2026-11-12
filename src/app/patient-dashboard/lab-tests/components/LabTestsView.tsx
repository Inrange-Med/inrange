"use client";

/**
 * Blood tests: the patient's home blood tests through Redcliffe Labs. Tests under way show
 * Arhaan's lab status steps; earlier ones are one row each. The one action is "Book a home test".
 */

import Link from "next/link";
import { CaretRight, FileArrowUp, Flask } from "@phosphor-icons/react";
import PageGhosts from "@/app/patient-dashboard/components/PageGhosts";
import Card from "@/components/ui/Card";
import ErrorNotice from "@/components/ui/ErrorNotice";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import { useNow } from "@/hooks/useNow";
import { shortDate } from "@/lib/format/dateTime";
import { listMyLabBookings } from "@/services/labTestService";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import { isOngoing, LAB_STATUS_WORDS } from "./labBookingFormat";
import OngoingLabCard from "./OngoingLabCard";
import styles from "../LabTestsPage.module.css";

const BOOK_HREF = "/patient-dashboard/lab-tests/book";

export default function LabTestsView() {
  const bookings = useApiResource("lab-bookings", listMyLabBookings);
  const now = useNow();
  const all = bookings.data ?? [];
  const ongoing = all
    .filter(isOngoing)
    .sort((a, b) => a.collectionStartsAt.localeCompare(b.collectionStartsAt));
  const earlier = all
    .filter((booking) => !isOngoing(booking))
    .sort((a, b) => b.collectionStartsAt.localeCompare(a.collectionStartsAt));

  return (
    <main
      className={`${layoutStyles.page} ${layoutStyles.narrow} ${styles.page}`}
    >
      <PageHead
        title="Blood tests"
        back={{ href: "/patient-dashboard/care", label: "Care" }}
        action={
          <Link
            href={BOOK_HREF}
            className={`${formStyles.link} ${styles.headLink}`}
          >
            Book a home test <CaretRight size={15} />
          </Link>
        }
      />

      {bookings.loading && <PageGhosts heights={[200, 140]} />}
      {bookings.error && (
        <ErrorNotice message={bookings.error} onRetry={bookings.reload} />
      )}

      {!bookings.loading && !bookings.error && (
        <div className={styles.grid}>
          {bookings.data === null && (
            <Card className={styles.card}>
              <p className={styles.text}>
                Booking home blood tests is not available yet.
              </p>
            </Card>
          )}

          {bookings.data !== null && all.length === 0 && (
            <Card className={styles.card}>
              <p className={styles.text}>
                Upload a recent report, or book a home test. Our partner lab
                collects the sample at home.
              </p>
              <div className={styles.pair}>
                <Link
                  href="/patient-dashboard/reports"
                  className={`btn btn--ghost ${styles.pill}`}
                >
                  <FileArrowUp size={17} /> Upload a report
                </Link>
                <Link
                  href={BOOK_HREF}
                  className={`btn btn--ghost ${styles.pill}`}
                >
                  <Flask size={17} /> Book a home test
                </Link>
              </div>
            </Card>
          )}

          {ongoing.map((booking) => (
            <OngoingLabCard key={booking.id} booking={booking} now={now} />
          ))}

          {earlier.length > 0 && (
            <Card title="Earlier tests" className={styles.card}>
              <ul className={styles.people}>
                {earlier.map((booking) => (
                  <li key={booking.id}>
                    <Link
                      href={`/patient-dashboard/lab-tests/${booking.id}`}
                      className={styles.row}
                    >
                      <span className={styles.plate} aria-hidden="true">
                        <Flask size={17} />
                      </span>
                      <span className={styles.rowText}>
                        <strong>{booking.packageName}</strong>
                        <span>
                          {LAB_STATUS_WORDS[booking.status]},{" "}
                          <span className="num">
                            {shortDate(booking.collectionStartsAt)}
                          </span>
                        </span>
                      </span>
                      <CaretRight
                        size={17}
                        className={styles.go}
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </main>
  );
}
