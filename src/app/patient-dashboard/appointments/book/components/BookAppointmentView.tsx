"use client";

/**
 * Book a consultation: say what it is about, then choose a time. The patient never chooses a
 * doctor: GET /api/schedule/available-slots returns the times they may book.
 * Only a patient whose report is approved can book (GET /api/eligibility); anyone else sees where
 * they are and what is next. A first consultation not yet paid for (the own-report path) goes to
 * checkout with the slot (CONSULTATION_FEE; the backend holds it, then books it once paid);
 * otherwise the slot is booked straight away (PUT /api/schedule/book).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import EligibilityStatus from "@/app/patient-dashboard/components/EligibilityStatus";
import {
  eligibilityStatus,
  loadEligibilityReview,
} from "@/app/patient-dashboard/components/eligibilityStage";
import Card from "@/components/ui/Card";
import ErrorNotice from "@/components/ui/ErrorNotice";
import PageGhosts from "@/app/patient-dashboard/components/PageGhosts";
import PageHead from "@/components/ui/PageHead";
import type { PickableSlot } from "@/components/ui/SlotPicker";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { useNow } from "@/hooks/useNow";
import { savePendingConsultationReason } from "@/lib/consultations/pendingConsultationReason";
import { clockTime, spokenDay } from "@/lib/format/dateTime";
import { checkoutHref } from "@/lib/payments/checkoutHref";
import { bookSlot } from "@/services/appointmentService";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import ReasonFields from "./ReasonFields";
import TimeCard from "./TimeCard";
import styles from "../BookPage.module.css";

export default function BookAppointmentView() {
  const router = useRouter();
  const toast = useToast();
  const now = useNow();
  const review = useApiResource("eligibility-review", loadEligibilityReview);
  const [note, setNote] = useState("");

  const eligibility = review.data?.eligibility ?? null;
  // no eligibility endpoint yet: booking stays open as before, and the backend still decides
  const canBook = !eligibility || eligibility.stage === "APPROVED";
  const mustPay = eligibility !== null && !eligibility.consultationPaid;

  const book = async (slot: PickableSlot) => {
    const reason = note.trim();
    if (mustPay) {
      savePendingConsultationReason(slot.id, reason);
      router.push(
        checkoutHref({
          purpose: "CONSULTATION_FEE",
          referenceId: slot.id,
          returnTo: "/patient-dashboard/appointments",
        }),
      );
      return;
    }
    await bookSlot({
      slotId: Number(slot.id),
      consultationType: "Virtual",
      reason,
    });
    const at = new Date(slot.at);
    toast(`Booked for ${spokenDay(at)}, ${clockTime(at)}`);
    router.push("/patient-dashboard/appointments");
  };

  const content = () => {
    if (review.error)
      return <ErrorNotice message={review.error} onRetry={review.reload} />;
    if (!review.data) return <PageGhosts heights={[132, 360]} />;
    if (eligibility && !canBook) {
      return (
        <Card title="Booking opens after your review" className={styles.card}>
          <p className={styles.text}>
            You can book once our medical team approves your report.
          </p>
          <EligibilityStatus
            status={eligibilityStatus(
              eligibility,
              review.data.labBooking,
              null,
              now,
            )}
          />
        </Card>
      );
    }
    return (
      <>
        <Card title="What it is about" className={styles.card}>
          <ReasonFields reason={note} onReasonChange={setNote} />
        </Card>
        <TimeCard
          confirmLabel={mustPay ? "Pay and book" : "Book"}
          note={
            mustPay
              ? "We hold the time while you pay. Times are India time (IST)."
              : "Times are India time (IST)."
          }
          onConfirm={book}
        />
      </>
    );
  };

  return (
    <main className={`${layoutStyles.page} ${styles.page}`}>
      <PageHead
        title="Book a consultation"
        sub="A video consultation with an inrange doctor."
        back={{
          href: "/patient-dashboard/appointments",
          label: "Appointments",
        }}
      />
      <div className={styles.cols}>{content()}</div>
    </main>
  );
}
