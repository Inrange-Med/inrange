"use client";

/**
 * The head of one home blood test: where it is (Arhaan's lab steps), how long an unpaid slot is
 * held and the way to pay, the collector and their live tracking link once assigned, the report
 * when it is ready (GET its fresh link from labTestService), and Change time / Cancel test while
 * they are possible.
 */

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  DownloadSimple,
  MapPin,
  Phone,
} from "@phosphor-icons/react";
import Card from "@/components/ui/Card";
import { useToast } from "@/components/ui/ToastProvider";
import { clockTime, timeUntil } from "@/lib/format/dateTime";
import { formatRupees } from "@/lib/format/money";
import { errorMessage } from "@/lib/http/apiClient";
import { getLabReportUrl } from "@/services/labTestService";
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
  const toast = useToast();
  const [opening, setOpening] = useState(false);

  const holdOpen =
    booking.status === "PAYMENT_PENDING" &&
    booking.holdExpiresAt !== null &&
    Date.parse(booking.holdExpiresAt) > now;
  const changeable =
    booking.status === "BOOKED" || booking.status === "COLLECTOR_ASSIGNED";
  const blocked = rescheduleBlock(booking);

  const openReport = async () => {
    // open the tab inside the tap, so the browser does not block it, then point it at the fresh link
    const tab = window.open("", "_blank");
    setOpening(true);
    try {
      const url = await getLabReportUrl(booking.id);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (caught) {
      tab?.close();
      toast(errorMessage(caught));
    } finally {
      setOpening(false);
    }
  };

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

      {booking.status === "REPORT_READY" && (
        <button
          type="button"
          className={`btn ${formStyles.go}`}
          onClick={openReport}
          data-busy={opening}
          aria-busy={opening}
        >
          <span>{opening ? "Opening" : "Download report"}</span>
          <span className="well" aria-hidden="true">
            {opening ? (
              <i className={formStyles.spin} />
            ) : (
              <DownloadSimple size={18} />
            )}
          </span>
        </button>
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
