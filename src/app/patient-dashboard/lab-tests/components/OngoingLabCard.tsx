"use client";

/**
 * A booking still to happen or under way, with its steps (or, while unpaid, how long the slot is held).
 * On Home it is drawn as one of Home's cards (Arhaan Home .card: the label as the card's link, a
 * trailing "Details", the collection window as the card's title), so it never reads as a Care card
 * dropped into Home. `className` places it in Home's laptop grid.
 */

import Link from "next/link";
import { ArrowRight, CaretRight } from "@phosphor-icons/react";
import Card from "@/components/ui/Card";
import { clockTime } from "@/lib/format/dateTime";
import { formatRupees } from "@/lib/format/money";
import type { LabBooking } from "@/types/labTest";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import {
  collectionWindow,
  labCheckoutHref,
  labStatusLine,
} from "./labBookingFormat";
import LabStatusTracker from "./LabStatusTracker";
import homeStyles from "@/app/patient-dashboard/HomePage.module.css";
import styles from "../LabTestsPage.module.css";

export default function OngoingLabCard({
  booking,
  now,
  onHome = false,
  className = "",
}: {
  booking: LabBooking;
  now: number;
  /** draw it as one of Home's cards */
  onHome?: boolean;
  className?: string;
}) {
  const holdEnded =
    booking.holdExpiresAt !== null && Date.parse(booking.holdExpiresAt) <= now;
  const detailsHref = `/patient-dashboard/lab-tests/${booking.id}`;
  const textClass = onHome ? homeStyles.labText : styles.text;
  const payLink = (
    <Link
      href={labCheckoutHref(booking)}
      className={`btn ${formStyles.go} ${onHome ? "" : styles.cta}`}
    >
      <span>Pay {formatRupees(booking.price.total)} and book</span>
      <span className="well" aria-hidden="true">
        <ArrowRight size={18} />
      </span>
    </Link>
  );
  const details = (
    <>
      <LabStatusTracker status={booking.status} />
      {labStatusLine(booking) && (
        <p className={textClass}>{labStatusLine(booking)}</p>
      )}
      {booking.status === "PAYMENT_PENDING" && !holdEnded && (
        <>
          <p className={textClass}>
            Waiting for payment. Your time is held until{" "}
            <span className="num">
              {clockTime(new Date(booking.holdExpiresAt ?? now))}
            </span>
            .
          </p>
          {onHome ? (
            <div className={homeStyles.labActions}>{payLink}</div>
          ) : (
            payLink
          )}
        </>
      )}
      {booking.status === "PAYMENT_PENDING" && holdEnded && (
        <p className={textClass}>
          The 30-minute hold has ended. Book again to choose a new time.
        </p>
      )}
    </>
  );

  if (onHome) {
    return (
      <section
        className={`${homeStyles.card} ${homeStyles.quiet} ${className}`}
        aria-labelledby={`lab-${booking.id}`}
      >
        <div className={homeStyles.head}>
          <h2 id={`lab-${booking.id}`} className={homeStyles.label}>
            <Link href={detailsHref} className={homeStyles.stretch}>
              {booking.packageName}
            </Link>
          </h2>
          <span className={homeStyles.go} aria-hidden="true">
            Details
            <CaretRight size={14} />
          </span>
        </div>
        <p className={homeStyles.doseTitle}>
          <span className="num">{collectionWindow(booking)}, at home</span>
        </p>
        {details}
      </section>
    );
  }

  return (
    <Card
      title={booking.packageName}
      className={`${styles.card} ${className}`}
      action={
        <Link href={detailsHref} className={formStyles.link}>
          Details <CaretRight size={15} />
        </Link>
      }
    >
      <div className={styles.labNow}>
        <p className={styles.labTitle}>
          <span className="num">{collectionWindow(booking)}, at home</span>
        </p>
        {details}
      </div>
    </Card>
  );
}
