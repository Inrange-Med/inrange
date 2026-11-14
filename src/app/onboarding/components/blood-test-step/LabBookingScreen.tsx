"use client";

/**
 * No report yet: the care package with lab tests, then the shared lab booking steps (address,
 * person, time, review). Paying goes to the checkout, which returns to /patient-dashboard, where the
 * patient sees "We're waiting for your lab report". The review screen shows the BMI above the pay
 * button.
 */

import { useState, type RefObject } from "react";
import LabBookingFlow from "@/features/lab-booking/LabBookingFlow";
import type {
  LabBookingState,
  LabPatientDraft,
} from "@/features/lab-booking/useLabBookingFlow";
import { checkoutHref } from "@/lib/payments/checkoutHref";
import { getSessionUser } from "@/lib/session/authSession";
import type { LabBooking } from "@/types/labTest";
import type { OnboardingDraft } from "@/app/onboarding/onboardingDraft";
import BmiReadout from "@/app/onboarding/components/BmiReadout";
import BloodTestScreenFrame from "./BloodTestScreenFrame";
import styles from "@/app/onboarding/OnboardingPage.module.css";

type Props = {
  lab: LabBookingState;
  draft: OnboardingDraft;
  bmi: number | null;
  direction: 1 | -1;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

// the review step just showed the bill, so the checkout opens Razorpay without a second Pay tap
const labCheckoutHref = (booking: LabBooking) =>
  checkoutHref({
    purpose: "LAB_BOOKING",
    referenceId: booking.id,
    returnTo: "/patient-dashboard",
    payNow: true,
  });
const toDashboard = () => "/patient-dashboard";

/**
 * The person step starts from the onboarding answers; Redcliffe takes only male or female. Without
 * answers (a resumed visit the backend could not fill in) the feature uses the profile instead.
 */
function patientFrom(draft: OnboardingDraft): LabPatientDraft | undefined {
  if (!draft.firstName.trim()) return undefined;
  return {
    name: `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim(),
    age: Number(draft.age) || 0,
    gender: draft.gender === "Other" ? null : draft.gender,
    mobile: (getSessionUser()?.mobile ?? "").replace(/\D/g, "").slice(-10),
    email: draft.email.trim(),
  };
}

export default function LabBookingScreen({
  lab,
  draft,
  bmi,
  direction,
  headingRef,
}: Props) {
  // between lab steps the screen arrives from the side it is going to, by the steps' order: a step
  // further on comes from the right even after a Back. The first lab screen takes the onboarding's.
  const [shownStep, setShownStep] = useState(lab.stepNumber);
  const [labDirection, setLabDirection] = useState<1 | -1>(direction);
  if (lab.stepNumber !== shownStep) {
    setShownStep(lab.stepNumber);
    setLabDirection(lab.stepNumber < shownStep ? -1 : 1);
  }

  return (
    <BloodTestScreenFrame
      screenKey={`lab-${lab.step}`}
      direction={labDirection}
      title={lab.title}
      headingRef={headingRef}
    >
      <LabBookingFlow
        flow={lab}
        checkoutHref={labCheckoutHref}
        bookedHref={toDashboard}
        initialPatient={patientFrom(draft)}
        beforePay={
          <div className={styles.bmiCard}>
            <BmiReadout bmi={bmi} />
          </div>
        }
      />
    </BloodTestScreenFrame>
  );
}
