/**
 * After sign-in: the free check's answers (lib/onboarding/freeCheck) become onboarding's questions,
 * saved one step at a time with the same PATCH /api/onboarding/step the screens use, so the backend
 * sees exactly what it would have seen. Questions 2 to 7 always come from the check; question 1 (name
 * and email) and question 8 (consent) come from its last step when they were given there, and the
 * consent only when it was given to the wording version the backend uses now. With all eight saved,
 * the profile is completed (POST /api/onboarding/complete) and the patient opens on the first step
 * (question 9) with nothing left to answer. A step the backend refuses stops the run there: the
 * patient starts at that question with the answer filled in and the backend's message shown.
 */

import { errorMessage } from "@/lib/http/apiClient";
import {
  clearFreeCheck,
  type FreeCheckAnswers,
} from "@/lib/onboarding/freeCheck";
import { updateSessionUser } from "@/lib/session/authSession";
import {
  completeOnboarding,
  saveOnboardingStep,
} from "@/services/onboardingService";
import type {
  OnboardingAnswers,
  OnboardingConfig,
  OnboardingStatus,
} from "@/types/onboarding";
import { answersFrom, draftFrom } from "./onboardingDraft";
import {
  LAST_SAVED_STEP,
  REPORT_STEP,
  requiredConsentsOf,
} from "./onboardingOptions";
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
  const identity = check.identity;
  // a consent counts only for the wording it was given to, and only when it covers what care needs
  const consented =
    !!identity &&
    identity.consentVersion === config.consentVersion &&
    requiredConsentsOf(config).every((type) =>
      identity.consents.includes(type),
    );
  // the check is the patient's latest word on these questions, so it replaces older saved answers
  const answers: OnboardingAnswers = {
    ...EMPTY,
    ...status?.answers,
    ...(identity && {
      firstName: identity.firstName,
      lastName: identity.lastName,
      email: identity.email,
    }),
    gender: check.gender,
    ageYears: check.ageYears,
    heightCm: check.heightCm,
    weightKg: check.weightKg,
    weightLossExperience: check.weightLossExperience,
    noConditions: check.noConditions,
    conditions: check.conditions,
    ...(consented && { consents: identity.consents }),
  };
  const draft = draftFrom(answers);
  // a name and email saved on an earlier visit count as question 1
  const done: number[] =
    !identity && answers.firstName.trim() && answers.email.trim() ? [1] : [];
  // consent is recorded before any health answer reaches the backend (DPDP Act 2023: consent first)
  const toSave = [
    ...(identity ? [1] : []),
    ...(consented ? [LAST_SAVED_STEP] : []),
    ...CHECK_STEPS,
  ];
  let problem: string | null = null;

  for (const step of toSave) {
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

  const allSaved = Array.from(
    { length: LAST_SAVED_STEP },
    (_, i) => i + 1,
  ).every((step) => done.includes(step));
  if (allSaved) {
    try {
      await completeOnboarding(answersFrom(draft, config));
      updateSessionUser({
        fullName: `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim(),
      });
      return {
        status: {
          currentStep: REPORT_STEP,
          lastCompletedStep: LAST_SAVED_STEP,
          completed: true,
          answers,
        },
        done,
        problem: null,
        fromCheck: true,
      };
    } catch (error) {
      // consent is asked again, and its Continue completes the profile as usual
      problem = errorMessage(error);
      done.splice(done.indexOf(LAST_SAVED_STEP), 1);
    }
  }

  return {
    status: {
      currentStep: nextOpenStep(done),
      lastCompletedStep: Math.max(status?.lastCompletedStep ?? 0, ...done, 0),
      completed: false,
      answers,
    },
    done,
    problem,
    fromCheck: done.some((step) => step !== 1),
  };
}
