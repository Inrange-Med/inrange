"use client";

/**
 * Question 9's two paths and which screen of them is showing. Yes ("upload"): the report is
 * uploaded for review, then "sent". No ("lab"): the care package and the shared lab booking flow.
 */

import { useState } from "react";
import { useLabBookingFlow } from "@/features/lab-booking/useLabBookingFlow";

/** steps: questions 1 to 9; upload: the report form; sent: the report is with the team; lab: the home test booking */
export type Phase = "steps" | "upload" | "sent" | "lab";

export function useBloodTestPath() {
  const lab = useLabBookingFlow("onboarding");
  const [phase, setPhase] = useState<Phase>("steps");

  /** Back inside the path: through the lab booking's steps, then to question 9. False on the questions.
      The package is chosen on question 9 itself, so Back from the address returns there. */
  const stepBack = () => {
    if (phase === "lab" && !lab.isFirstStep && lab.step !== "address")
      lab.back();
    else if (phase === "upload" || phase === "lab") setPhase("steps");
    else return false;
    return true;
  };

  return {
    phase,
    setPhase,
    lab,
    openPath: (hasRecentReport: boolean) =>
      setPhase(hasRecentReport ? "upload" : "lab"),
    /** Question 9's package card: the package is chosen, the booking starts at the address. */
    openLab: (chosen: Parameters<typeof lab.chooseCarePackage>[0]) => {
      lab.chooseCarePackage(chosen);
      setPhase("lab");
    },
    stepBack,
  };
}
