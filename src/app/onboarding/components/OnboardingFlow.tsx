"use client";

/**
 * Decides where the patient starts (every redirect replaces, so Back never returns here): signed
 * out goes to /sign-in?next=<this page>, a doctor to their dashboard. An unfinished profile opens at the question the
 * patient left off at (Save and exit, then the dashboard's link back here). A finished profile opens
 * at question 9 (the blood test) until the patient has chosen a path (GET /api/eligibility), then
 * goes to /patient-dashboard; /onboarding?step=report asks for question 9 when the backend cannot
 * say how far the profile got. The answer lists come from the backend (or the bundled copy). After
 * the public free check, its answers are saved first (freeCheckPrefill.ts) and those questions skipped.
 */

import { useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ErrorNotice from "@/components/ui/ErrorNotice";
import Wordmark from "@/components/ui/Wordmark";
import { useApiResource } from "@/hooks/useApiResource";
import { signInHrefFor } from "@/lib/navigation/signInReturn";
import {
  getSessionUser,
  homePathFor,
  isSignedIn,
} from "@/lib/session/authSession";
import { readFreeCheck } from "@/lib/onboarding/freeCheck";
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
import { prefillFromFreeCheck, type Prefilled } from "../freeCheckPrefill";
import CurrentOnboardingScreen from "./CurrentOnboardingScreen";
import styles from "../OnboardingPage.module.css";
import barStyles from "./OnboardingTopBar.module.css";

type Start =
  | { redirectTo: string }
  | {
      status: OnboardingStatus | null;
      config: OnboardingConfig;
      /** set when the free check's answers were saved on the way in */
      prefilled?: Prefilled;
    };

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
  // the free check, done on the site before signing in: its answers are saved now, so only what it
  // never asked is left (name and email, consent). Not for a finished profile.
  const check = status?.completed ? null : readFreeCheck();
  if (check) {
    const prefilled = await prefillFromFreeCheck(check, status, config);
    return { status: prefilled.status, config, prefilled };
  }
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
        {/* the top bar's brand, so the page keeps its frame; Back and Save and exit need the loaded
            profile, so they wait for it (the wordmark shows from 768px, as on every other screen) */}
        <header className={barStyles.bar}>
          <div className={barStyles.barStart}>
            <Link
              href="/"
              className={barStyles.brand}
              aria-label="inrange home"
            >
              <Wordmark height={34} />
            </Link>
          </div>
        </header>
        <div className={styles.stage}>
          {/* arrives like every other screen */}
          <div className={styles.step} style={{ "--dir": 1 } as CSSProperties}>
            <ErrorNotice message={start.error} onRetry={start.reload} />
          </div>
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
      prefilled={start.data.prefilled}
    />
  );
}
