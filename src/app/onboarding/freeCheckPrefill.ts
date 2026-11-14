/**
 * After sign-in: the free check's answers (lib/onboarding/freeCheck) become onboarding's questions 2
 * to 7, saved one step at a time with the same PATCH /api/onboarding/step the screens use, so the
 * backend sees exactly what it would have seen. What is left to ask is then only what the check never
 * asked: name and email (1) and consent (8). A step the backend refuses stops the run there, and the
 * patient starts at that question with the check's answer filled in and the backend's message shown.
 */

import { errorMessage } from "@/lib/http/apiClient";
import {
  clearFreeCheck,
  type FreeCheckAnswers,
} from "@/lib/onboarding/freeCheck";
import { saveOnboardingStep } from "@/services/onboardingService";
import type {
  OnboardingAnswers,
  OnboardingConfig,
  OnboardingStatus,
} from "@/types/onboarding";
import { draftFrom } from "./onboardingDraft";
import { LAST_SAVED_STEP } from "./onboardingOptions";
import { isProblem, stepAnswerFor } from "./onboardingStepAnswer";

/** The questions the free check answers, in onboarding's numbering. */
export const CHECK_STEPS = [2, 3, 4, 5, 6, 7] as const;

export type Prefilled = {
  status: OnboardingStatus;
  /** questions already saved, which moving forward skips (moving back still shows them) */
  done: number[];
  /** the backend's reason when a question could not be saved */
  problem: string | null;
  /** true when the check's answers were saved, for the "answers are saved" line */
  fromCheck: boolean;
};

const EMPTY: OnboardingAnswers = {
  firstName: "",
  lastName: "",
  email: "",
  gender: null,
  ageYears: null,
  heightCm: null,
  weightKg: null,
  weightLossExperience: [],
  conditions: null,
  noConditions: false,
  consents: [],
};

/** The first question not yet saved, from `after` on; past the last, the blood test step. */
export const nextOpenStep = (done: number[], after = 0) => {
  for (let step = after + 1; step <= LAST_SAVED_STEP; step++)
    if (!done.includes(step)) return step;
  return LAST_SAVED_STEP + 1;
};

/** One run per set of answers: a second load of the screen while the first is saving (React's
    development double run, a quick retry) waits for the same saves instead of repeating them. */
let running: { key: string; result: Promise<Prefilled> } | null = null;

export function prefillFromFreeCheck(
  check: FreeCheckAnswers,
  status: OnboardingStatus | null,
  config: OnboardingConfig,
): Promise<Prefilled> {
  const key = JSON.stringify(check);
  if (running?.key === key) return running.result;
  const result = savePrefill(check, status, config);
  running = { key, result };
  // a failed run can be tried again (Retry on the error screen)
  result.catch(() => {
    if (running?.result === result) running = null;
  });
  return result;
}

async function savePrefill(
  check: FreeCheckAnswers,
  status: OnboardingStatus | null,
  config: OnboardingConfig,
): Promise<Prefilled> {
  // the check is the patient's latest word on these questions, so it replaces older saved answers
  const answers: OnboardingAnswers = {
    ...EMPTY,
    ...status?.answers,
    gender: check.gender,
    ageYears: check.ageYears,
    heightCm: check.heightCm,
    weightKg: check.weightKg,
    weightLossExperience: check.weightLossExperience,
    noConditions: check.noConditions,
    conditions: check.conditions,
  };
  const draft = draftFrom(answers);
  // a name and email saved on an earlier visit count as question 1
  const done: number[] =
    answers.firstName.trim() && answers.email.trim() ? [1] : [];
  let problem: string | null = null;

  for (const step of CHECK_STEPS) {
    const answer = stepAnswerFor(step, draft, config);
    // the backend's lists can differ from the bundled ones the check used: that question is asked
    if (isProblem(answer)) break;
    try {
      await saveOnboardingStep(answer, config.consentVersion);
      done.push(step);
    } catch (error) {
      problem = errorMessage(error);
      break;
    }
  }

  // every answer is on the profile now; nothing about the patient's health stays in the tab
  if (CHECK_STEPS.every((step) => done.includes(step))) clearFreeCheck();

  const currentStep = nextOpenStep(done);
  return {
    status: {
      currentStep,
      lastCompletedStep: Math.max(status?.lastCompletedStep ?? 0, ...done, 0),
      completed: false,
      answers,
    },
    done,
    problem,
    fromCheck: done.some((step) => step !== 1),
  };
}
