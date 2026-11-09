/** /onboarding: the patient's health profile, one question at a time, then the first consultation. */

import type { Metadata } from "next";
import OnboardingFlow from "./components/OnboardingFlow";

export const metadata: Metadata = {
  title: "Your health profile | InRange",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
