"use client";

/**
 * Booking a home blood test: renders the current step of `flow` (useLabBookingFlow, which holds the
 * choices and the step). Redcliffe is reached only through the inrange backend
 * (docs/backend/lab-tests-redcliffe.md).
 *
 * The steps, in order (components/):
 *   1. package  LabPackageStep (dashboard) or CarePackageStep (onboarding)
 *   2. address  CollectionAddressStep, with NewAddressForm to add one
 *   3. patient  TestedPersonStep: who is tested; skipped when the profile or the onboarding answers
 *               already fill it in completely (the review shows them, with Change)
 *   4. time     CollectionTimeStep: the collection day and hour
 *   5. review   ReviewAndPayStep: every choice with Change, the price, then hold and pay
 *
 * The two modes:
 *   dashboard   /patient-dashboard/lab-tests/book: any Redcliffe package; booked goes to the booking.
 *   onboarding  the last screen of onboarding: a care package with lab tests; the review shows the BMI.
 *
 * The host draws its own heading and Back (stepping back through these steps with flow.back), so the
 * same steps sit in both places.
 */

import type { ReactNode } from "react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useApiResource } from "@/hooks/useApiResource";
import { getSessionUser } from "@/lib/session/authSession";
import { getMyProfile } from "@/services/patientProfileService";
import type { LabBooking } from "@/types/labTest";
import CarePackageStep from "./components/CarePackageStep";
import CollectionAddressStep from "./components/CollectionAddressStep";
import CollectionTimeStep from "./components/CollectionTimeStep";
import LabPackageStep from "./components/LabPackageStep";
import ReviewAndPayStep from "./components/ReviewAndPayStep";
import TestedPersonStep, { readyPatient } from "./components/TestedPersonStep";
import {
  patientFromProfile,
  type LabBookingState,
  type LabPatientDraft,
} from "./useLabBookingFlow";
import styles from "./LabBookingFlow.module.css";

type Props = {
  flow: LabBookingState;
  /** where paying for a held booking happens (the checkout comes back to its returnTo) */
  checkoutHref: (booking: LabBooking) => string;
  /** where to go when nothing is left to pay (a lab plan covers the test) */
  bookedHref: (booking: LabBooking) => string;
  /** the person step's starting answers; without it they come from the patient's profile */
  initialPatient?: LabPatientDraft;
  /** shown on the review step just above the pay button */
  beforePay?: ReactNode;
};

/** The profile fills in the person step; a missing profile only means typing the details. */
const loadProfile = () => getMyProfile().catch(() => null);

export default function LabBookingFlow({
  flow,
  checkoutHref,
  bookedHref,
  initialPatient,
  beforePay,
}: Props) {
  const profile = useApiResource(
    initialPatient ? null : "my-profile",
    loadProfile,
  );
  const { step, chosenPackage, address } = flow;
  const startingPatient = profile.loading
    ? null
    : (initialPatient ??
      patientFromProfile(profile.data, getSessionUser()?.mobile ?? ""));

  return (
    <div className={styles.flow}>
      {step === "package" &&
        (flow.mode === "onboarding" ? (
          <CarePackageStep onChoose={flow.chooseCarePackage} />
        ) : (
          <LabPackageStep
            chosenCode={chosenPackage?.code ?? null}
            onChoose={flow.choosePackage}
          />
        ))}
      {step === "address" && (
        <CollectionAddressStep
          chosenId={address?.id ?? null}
          onChoose={(chosen) =>
            flow.chooseAddress(
              chosen,
              startingPatient && chosenPackage
                ? readyPatient(startingPatient, chosenPackage)
                : null,
            )
          }
        />
      )}
      {step === "patient" &&
        chosenPackage &&
        (profile.loading ? (
          <LoadingSkeleton />
        ) : (
          <TestedPersonStep
            initial={flow.patient ?? startingPatient!}
            labPackage={chosenPackage}
            onSave={flow.savePatient}
          />
        ))}
      {step === "time" && address && chosenPackage && (
        <CollectionTimeStep
          addressId={address.id}
          labPackage={chosenPackage}
          onChoose={flow.chooseSlot}
        />
      )}
      {step === "review" && (
        <ReviewAndPayStep
          flow={flow}
          checkoutHref={checkoutHref}
          bookedHref={bookedHref}
          beforePay={beforePay}
        />
      )}
    </div>
  );
}
