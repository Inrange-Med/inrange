"use client";

/**
 * The state of booking a home blood test, one decision per step: package, address, person, time,
 * then review and pay. Two modes:
 *   "dashboard"   the patient picks any Redcliffe package (/patient-dashboard/lab-tests/book).
 *   "onboarding"  the patient picks a care package that includes lab tests (lab tests and
 *                 consultation); its Redcliffe package is booked and the booking carries the care
 *                 package code, so the backend charges the package price.
 * Choosing again at any step drops a slot hold made from the old choices (the backend cancels that
 * hold when the next one is made). The host owns this state, so its own Back can step through it.
 */

import { useState } from "react";
import { toApiDate } from "@/lib/format/dateTime";
import { createLabBooking } from "@/services/labTestService";
import type { Address } from "@/types/address";
import type { CarePackage } from "@/types/carePackage";
import type { LabBooking, LabPackage, LabPatient } from "@/types/labTest";
import type { PatientProfile } from "@/types/patientProfile";
import type { PickableSlot } from "@/components/ui/SlotPicker";

type LabBookingMode = "dashboard" | "onboarding";

const LAB_BOOKING_STEPS = [
  "package",
  "address",
  "patient",
  "time",
  "review",
] as const;
export type LabBookingStep = (typeof LAB_BOOKING_STEPS)[number];

/** The person form before it is complete: the gender is chosen on the form. */
export type LabPatientDraft = Omit<LabPatient, "gender"> & {
  gender: LabPatient["gender"] | null;
};

const TITLES: Record<LabBookingStep, string> = {
  package: "Choose a test",
  address: "Where should we collect?",
  patient: "Who is being tested?",
  time: "Choose a time",
  review: "Check and pay",
};

/**
 * The person form starts from the profile. Redcliffe takes only Male or Female, so any other answer
 * (or none) leaves the gender for the patient to choose on the form.
 */
export function patientFromProfile(
  profile: PatientProfile | null,
  sessionMobile: string,
): LabPatientDraft {
  return {
    name: profile?.fullName ?? "",
    age: profile?.age ?? 0,
    gender:
      profile?.gender === "Male" || profile?.gender === "Female"
        ? profile.gender
        : null,
    mobile: (profile?.phone || sessionMobile).replace(/\D/g, "").slice(-10),
    email: profile?.email ?? "",
  };
}

export function useLabBookingFlow(mode: LabBookingMode) {
  const [step, setStep] = useState<LabBookingStep>("package");
  const [chosenPackage, setChosenPackage] = useState<LabPackage | null>(null);
  const [carePackage, setCarePackage] = useState<CarePackage | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [patient, setPatient] = useState<LabPatient | null>(null);
  const [slot, setSlot] = useState<PickableSlot | null>(null);
  const [held, setHeld] = useState<LabBooking | null>(null);
  // the person came from the profile without the step being shown, so Back skips it too
  const [personSkipped, setPersonSkipped] = useState(false);

  const stepNumber = LAB_BOOKING_STEPS.indexOf(step) + 1;

  /** Records a choice and moves to the next step. */
  const advance =
    <T>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setHeld(null);
      setStep(LAB_BOOKING_STEPS[stepNumber]);
    };

  /** Holds the slot for 30 minutes (Redcliffe temporary booking). Returns the held booking. */
  const hold = async () => {
    if (!chosenPackage || !address || !patient || !slot)
      throw new Error("Finish every step first.");
    const booking = await createLabBooking({
      packageCode: chosenPackage.code,
      addressId: address.id,
      collectionDate: toApiDate(new Date(slot.at)),
      slotId: slot.id,
      patient,
      carePackageCode: carePackage?.code,
    });
    setHeld(booking);
    return booking;
  };

  return {
    mode,
    step,
    title:
      mode === "onboarding" && step === "package"
        ? "Your care package"
        : TITLES[step],
    stepNumber,
    stepCount: LAB_BOOKING_STEPS.length,
    isFirstStep: stepNumber === 1,
    chosenPackage,
    carePackage,
    address,
    patient,
    slot,
    held,
    choosePackage: advance(setChosenPackage),
    /** Onboarding: the care package and the Redcliffe package it books. */
    chooseCarePackage: advance(
      ({ care, lab }: { care: CarePackage; lab: LabPackage }) => {
        setCarePackage(care);
        setChosenPackage(lab);
      },
    ),
    /**
     * The address, then the person step. A person the profile already fills in completely (`ready`)
     * is taken as is, straight to the time: the review shows them with Change.
     */
    chooseAddress: (chosen: Address, ready: LabPatient | null) => {
      setAddress(chosen);
      setHeld(null);
      const person = patient ?? ready;
      if (person) setPatient(person);
      setPersonSkipped(Boolean(person));
      setStep(person ? "time" : "patient");
    },
    savePatient: advance((person: LabPatient) => {
      setPatient(person);
      setPersonSkipped(false);
    }),
    chooseSlot: advance(setSlot),
    goTo: setStep,
    back: () =>
      setStep(
        step === "time" && personSkipped
          ? "address"
          : LAB_BOOKING_STEPS[Math.max(0, stepNumber - 2)],
      ),
    hold,
  };
}

export type LabBookingState = ReturnType<typeof useLabBookingFlow>;
