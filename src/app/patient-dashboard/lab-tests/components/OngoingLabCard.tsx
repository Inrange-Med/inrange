"use client";

/** A booking still to happen or under way, with its steps (or, while unpaid, how long the slot is held). */

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
import styles from "../LabTestsPage.module.css";

export default function OngoingLabCard({
  booking,
  now,
}: {
  booking: LabBooking;
  now: number;
}) {
  const holdEnded =
    booking.holdExpiresAt !== null && Date.parse(booking.holdExpiresAt) <= now;
  return (
    <Card
      title={booking.packageName}
      className={styles.card}
      action={
        <Link
          href={`/patient-dashboard/lab-tests/${booking.id}`}
          className={formStyles.link}
        >
          Details <CaretRight size={15} />
        </Link>
      }
    >
      <div className={styles.labNow}>
        <p className={styles.labTitle}>
          <span className="num">{collectionWindow(booking)}, at home</span>
        </p>
        <LabStatusTracker status={booking.status} />
        {labStatusLine(booking) && (
          <p className={styles.text}>{labStatusLine(booking)}</p>
        )}
        {booking.status === "PAYMENT_PENDING" && !holdEnded && (
          <>
            <p className={styles.text}>
              Waiting for payment. Your time is held until{" "}
              <span className="num">
                {clockTime(new Date(booking.holdExpiresAt ?? now))}
              </span>
              .
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
        {booking.status === "PAYMENT_PENDING" && holdEnded && (
          <p className={styles.text}>
            The 30-minute hold has ended. Book again to choose a new time.
          </p>
        )}
      </div>
    </Card>
  );
}
