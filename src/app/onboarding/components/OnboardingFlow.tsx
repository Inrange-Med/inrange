"use client";

/**
 * Decides where the patient starts (every redirect replaces, so Back never returns here): signed
 * out goes to /sign-in?next=<this page>, a doctor to their dashboard. An unfinished profile opens at the question the
 * patient left off at (Save and exit, then the dashboard's link back here). A finished profile opens
 * at question 9 (the blood test) until the patient has chosen a path (GET /api/eligibility), then
 * goes to /patient-dashboard; /onboarding?step=report asks for question 9 when the backend cannot
 * say how far the profile got. The answer lists come from the backend (or the bundled copy).
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ErrorNotice from "@/components/ui/ErrorNotice";
import { useApiResource } from "@/hooks/useApiResource";
import { signInHrefFor } from "@/lib/navigation/signInReturn";
import {
  getSessionUser,
  homePathFor,
  isSignedIn,
} from "@/lib/session/authSession";
import { getMyEligibility } from "@/services/eligibilityService";
import {
  getOnboardingConfig,
  getOnboardingStatus,
} from "@/services/onboardingService";
import { getMyProfile } from "@/services/patientProfileService";
import type {
  OnboardingAnswers,
  OnboardingConfig,
  OnboardingStatus,
} from "@/types/onboarding";
import {
  BUNDLED_CONFIG,
  LAST_SAVED_STEP,
  REPORT_STEP,
} from "../onboardingOptions";
import CurrentOnboardingScreen from "./CurrentOnboardingScreen";
import styles from "../OnboardingPage.module.css";

type Start =
  | { redirectTo: string }
  | { status: OnboardingStatus | null; config: OnboardingConfig };

/** The answers for question 9 when the status endpoint cannot give them: name, age and the BMI's inputs from the profile. */
async function answersFromProfile(): Promise<OnboardingAnswers> {
  const profile = await getMyProfile().catch(() => null);
  const [firstName = "", ...rest] = (profile?.fullName ?? "")
    .trim()
    .split(/\s+/);
  return {
    firstName,
    lastName: rest.join(" "),
    email: profile?.email ?? "",
    gender: profile?.gender ?? null,
    ageYears: profile?.age ?? null,
    heightCm: profile?.heightCm ?? null,
    weightKg: profile?.weightKg ?? null,
    weightLossExperience: [],
    conditions: null,
    noConditions: false,
    consents: [],
  };
}

async function loadStart(): Promise<Start> {
  const user = getSessionUser();
  if (!isSignedIn() || !user)
    return {
      redirectTo: signInHrefFor(
        window.location.pathname + window.location.search,
      ),
    };
  if (user.role !== "PATIENT") return { redirectTo: homePathFor(user.role) };
  const [status, served] = await Promise.all([
    getOnboardingStatus(),
    getOnboardingConfig(),
  ]);
  // a list the backend leaves out falls back to the bundled one
  const config = { ...BUNDLED_CONFIG, ...served };
  // a saved but unfinished profile always resumes at its question, even from a ?step=report link
  if (status && !status.completed) return { status, config };
  const askedForReport =
    new URLSearchParams(window.location.search).get("step") === "report";
  if (!status && !askedForReport) return { status, config };

  // the profile is done: question 9 until a path is chosen (null: no eligibility endpoint yet, so ask)
  const eligibility = await getMyEligibility();
  if (
    eligibility &&
    (eligibility.path !== null || eligibility.stage !== "NOT_STARTED")
  )
    return { redirectTo: homePathFor("PATIENT") };
  return {
    status: {
      currentStep: REPORT_STEP,
      lastCompletedStep: LAST_SAVED_STEP,
      completed: true,
      answers: status?.answers ?? (await answersFromProfile()),
    },
    config,
  };
}

export default function OnboardingFlow() {
  const router = useRouter();
  const start = useApiResource("onboarding-start", loadStart);
  const redirectTo =
    start.data && "redirectTo" in start.data ? start.data.redirectTo : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (start.error) {
    return (
      <main className={styles.page}>
        <div className={styles.stage}>
          <ErrorNotice message={start.error} onRetry={start.reload} />
        </div>
      </main>
    );
  }
  if (!start.data || !("status" in start.data))
    return <main className={styles.page} aria-busy="true" />;
  return (
    <CurrentOnboardingScreen
      status={start.data.status}
      config={start.data.config}
    />
  );
}
