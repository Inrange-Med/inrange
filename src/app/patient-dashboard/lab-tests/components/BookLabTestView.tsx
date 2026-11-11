"use client";

/**
 * /patient-dashboard/lab-tests/book: book a home blood test, one decision per screen (test, address,
 * person, time, then check and pay). The steps are the shared lab booking feature
 * (src/features/lab-booking); this page adds the dashboard heading, Back and the card.
 */

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, CaretRight } from "@phosphor-icons/react";
import BackLink, { backControlClass } from "@/components/ui/BackLink";
import Card from "@/components/ui/Card";
import PageHead from "@/components/ui/PageHead";
import LabBookingFlow from "@/features/lab-booking/LabBookingFlow";
import { useLabBookingFlow } from "@/features/lab-booking/useLabBookingFlow";
import { useApiResource } from "@/hooks/useApiResource";
import { listMyLabBookings } from "@/services/labTestService";
import type { LabBooking } from "@/types/labTest";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import {
  LAB_STATUS_WORDS,
  collectionWindow,
  labCheckoutHref,
} from "./labBookingFormat";
import styles from "../LabTestsPage.module.css";

const bookingPage = (booking: LabBooking) =>
  `/patient-dashboard/lab-tests/${booking.id}`;

export default function BookLabTestView() {
  const flow = useLabBookingFlow("dashboard");
  const bookings = useApiResource("lab-bookings", listMyLabBookings);
  // a paid test still to come: said once on the first screen, never in the way of booking another
  const booked = (bookings.data ?? []).find((b) =>
    ["BOOKED", "COLLECTOR_ASSIGNED", "SAMPLE_COLLECTED", "PROCESSING"].includes(
      b.status,
    ),
  );

  // each step starts at the top, as a new screen would
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [flow.step]);

  return (
    <main className={`${layoutStyles.page} ${layoutStyles.narrow}`}>
      {/* the back control and the heading as one head: 6px between them, as PageHead lays out its own */}
      <div className={styles.head}>
        {flow.isFirstStep ? (
          <BackLink href="/patient-dashboard/lab-tests" label="Blood tests" />
        ) : (
          <button
            type="button"
            className={backControlClass}
            onClick={flow.back}
          >
            <ArrowLeft size={14} weight="bold" aria-hidden="true" /> Back
          </button>
        )}
        <PageHead
          title={flow.title}
          sub={
            <span className="num">
              Step {flow.stepNumber} of {flow.stepCount}
            </span>
          }
        />
      </div>
      {flow.isFirstStep && booked && (
        <Link href={bookingPage(booked)} className={styles.alreadyBooked}>
          <span>
            <strong>You already have a test booked</strong>
            <span className="num">
              {booked.packageName}. {collectionWindow(booked)}.{" "}
              {LAB_STATUS_WORDS[booked.status]}.
            </span>
          </span>
          <CaretRight size={16} aria-hidden="true" />
        </Link>
      )}
      <Card>
        <LabBookingFlow
          flow={flow}
          checkoutHref={labCheckoutHref}
          bookedHref={bookingPage}
        />
      </Card>
    </main>
  );
}
