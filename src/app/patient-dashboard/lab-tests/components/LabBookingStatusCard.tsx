"use client";

/**
 * The head of one home blood test: where it is (Arhaan's lab steps), how long an unpaid slot is
 * held and the way to pay, the collector and their live tracking link once assigned, the report
 * when it is ready (opened through the signed-in API), and Change time / Cancel test while
 * they are possible.
 */

import Link from "next/link";
import {
  ArrowRight,
  DownloadSimple,
  MapPin,
  Phone,
} from "@phosphor-icons/react";
import Card from "@/components/ui/Card";
import FileOpenButton from "@/components/ui/FileOpenButton";
import { clockTime, timeUntil } from "@/lib/format/dateTime";
import { formatRupees } from "@/lib/format/money";
import { getFile } from "@/services/fileService";
import type { LabBooking } from "@/types/labTest";
import {
  LAB_STATUS_WORDS,
  labCheckoutHref,
  labStatusLine,
} from "./labBookingFormat";
import LabStatusTracker from "./LabStatusTracker";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "../LabTestsPage.module.css";
import { fastingSentence } from "@/lib/format/labPackage";

/** Why the time cannot be changed, or null when it can. */
function rescheduleBlock(booking: LabBooking) {
  if (booking.reschedulesLeft <= 0)
    return "This test has been moved twice, the most the lab allows.";
  if (!booking.canReschedule)
    return "The time cannot be changed once a collector is assigned.";
  return null;
}

export default function LabBookingStatusCard({
  booking,
  now,
  onChangeTime,
  onCancel,
}: {
  booking: LabBooking;
  now: number;
  onChangeTime: () => void;
  onCancel: () => void;
}) {
  const holdOpen =
    booking.status === "PAYMENT_PENDING" &&
    booking.holdExpiresAt !== null &&
    Date.parse(booking.holdExpiresAt) > now;
  const changeable =
    booking.status === "BOOKED" || booking.status === "COLLECTOR_ASSIGNED";
  const blocked = rescheduleBlock(booking);

  return (
    <Card title={LAB_STATUS_WORDS[booking.status]} className={styles.card}>
      <LabStatusTracker status={booking.status} />
      {labStatusLine(booking) && (
        <p className={styles.text}>{labStatusLine(booking)}</p>
      )}

      {holdOpen && (
        <>
          <p className={styles.text}>
            Your time is held until{" "}
            <span className="num">
              {clockTime(new Date(booking.holdExpiresAt!))}
            </span>
            , {timeUntil(booking.holdExpiresAt!, now)}. Pay before then to book
            it.
          </p>
          <Link
            href={labCheckoutHref(booking)}
            className={`btn ${formStyles.go}`}
          >
            <span>Pay {formatRupees(booking.price.total)} and book</span>
            <span className="well" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </Link>
        </>
      )}
      {(booking.status === "EXPIRED" ||
        (booking.status === "PAYMENT_PENDING" && !holdOpen)) && (
        <p className={styles.text}>
          The 30-minute hold ended before payment.{" "}
          <Link
            href="/patient-dashboard/lab-tests/book"
            className={formStyles.link}
          >
            Book again
          </Link>
        </p>
      )}
      {booking.status === "CANCELLED" && (
        <p className={styles.text}>This test was cancelled.</p>
      )}

      {booking.collector && changeable && (
        <div className={styles.fast}>
          <strong>{booking.collector.name}</strong>, your collector from
          Redcliffe Labs.{" "}
          <a
            href={`tel:${booking.collector.phone}`}
            className={formStyles.link}
          >
            <Phone size={16} /> Call
          </a>
        </div>
      )}
      {booking.collector?.trackingUrl && changeable && (
        <a
          href={booking.collector.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn ${formStyles.go}`}
        >
          <span>Track your collector</span>
          <span className="well" aria-hidden="true">
            <MapPin size={18} />
          </span>
        </a>
      )}
      {fastingSentence(booking.fastingNote) &&
        (booking.status === "BOOKED" ||
          booking.status === "COLLECTOR_ASSIGNED" ||
          holdOpen) && (
          <p className={styles.fast}>{fastingSentence(booking.fastingNote)}</p>
        )}

      {booking.status === "REPORT_READY" && booking.reportFile && (
        <FileOpenButton
          className={`btn ${formStyles.go}`}
          load={() => getFile(booking.reportFile ?? "")}
        >
          {(opening) => (
            <>
              <span>{opening ? "Opening" : "Open report"}</span>
              <span className="well" aria-hidden="true">
                {opening ? (
                  <i className={formStyles.spin} />
                ) : (
                  <DownloadSimple size={18} />
                )}
              </span>
            </>
          )}
        </FileOpenButton>
      )}

      {changeable && (
        <div className={styles.actions}>
          {/* an action that is not possible is not shown; the line under it says why */}
          {(blocked === null || booking.canCancel) && (
            <div className={styles.pair}>
              {blocked === null && (
                <button
                  type="button"
                  className={`btn btn--ghost ${styles.pill}`}
                  onClick={onChangeTime}
                >
                  Change time
                </button>
              )}
              {booking.canCancel && (
                <button
                  type="button"
                  className={`btn btn--ghost ${styles.pill}`}
                  onClick={onCancel}
                >
                  Cancel test
                </button>
              )}
            </div>
          )}
          {blocked && <p className={styles.foot}>{blocked}</p>}
        </div>
      )}
    </Card>
  );
}
