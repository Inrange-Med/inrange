/**
 * The onboarding answers as the screens edit them (the draft), and the pure conversions around it:
 * from the saved answers when the patient resumes, to the completed profile, and the BMI they show.
 */

import type {
  ConsentType,
  Gender,
  OnboardingAnswers,
  OnboardingConfig,
} from "@/types/onboarding";
import { conditionsFor } from "./onboardingOptions";

/** A problem to show: under the box named by `field`, or under the answers when there is none. */
export type Problem = {
  message: string;
  field?: "firstName" | "email" | "ageYears" | "otherText";
};

/** The answers as the screens edit them (age is typed text until it is saved). */
export type OnboardingDraft = {
  firstName: string;
  lastName: string;
  email: string;
  gender: Gender | null;
  age: string;
  heightCm: number | null;
  weightKg: number | null;
  experience: string[];
  conditionCodes: string[];
  noConditions: boolean;
  otherText: string;
  consents: ConsentType[];
  /** question 9; never saved: the upload or the lab booking tells the backend which path was taken */
  hasRecentReport: boolean | null;
};

export type DraftChanges =
  | Partial<OnboardingDraft>
  | ((current: OnboardingDraft) => Partial<OnboardingDraft>);

export function draftFrom(
  answers: OnboardingAnswers | undefined,
): OnboardingDraft {
  return {
    firstName: answers?.firstName ?? "",
    lastName: answers?.lastName ?? "",
    email: answers?.email ?? "",
    gender: answers?.gender ?? null,
    age: answers?.ageYears ? String(answers.ageYears) : "",
    // nothing until the patient answers: a guessed number here would become their baseline
    heightCm: answers?.heightCm ?? null,
    weightKg: answers?.weightKg ?? null,
    experience: answers?.weightLossExperience ?? [],
    conditionCodes:
      answers?.conditions?.map((condition) => condition.code) ?? [],
    noConditions: answers?.noConditions ?? false,
    otherText:
      answers?.conditions?.find((condition) => condition.code === "OTHER")
        ?.otherText ?? "",
    consents: answers?.consents ?? [],
    hasRecentReport: null,
  };
}

/** The ticked conditions that are on screen (PCOS is hidden for men). */
export const visibleConditionCodes = (
  draft: OnboardingDraft,
  config: OnboardingConfig,
) =>
  draft.conditionCodes.filter((code) =>
    conditionsFor(config.conditions, draft.gender).some(
      (condition) => condition.code === code,
    ),
  );

/** The ticked conditions as saved: "Something else" carries its text. */
export const conditionsAnswer = (
  draft: OnboardingDraft,
  config: OnboardingConfig,
) =>
  visibleConditionCodes(draft, config).map((code) =>
    code === "OTHER" ? { code, otherText: draft.otherText.trim() } : { code },
  );

/** The whole profile, sent once after question 8 (POST /api/onboarding/complete). */
export function answersFrom(
  draft: OnboardingDraft,
  config: OnboardingConfig,
): OnboardingAnswers {
  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    email: draft.email,
    gender: draft.gender,
    ageYears: draft.age ? Number(draft.age) : null,
    heightCm: draft.heightCm,
    weightKg: draft.weightKg,
    weightLossExperience: draft.experience,
    conditions: draft.noConditions ? [] : conditionsAnswer(draft, config),
    noConditions: draft.noConditions,
    consents: draft.consents,
  };
}

/** Question 6 with `code` ticked or unticked: a first attempt and past attempts each clear the other. */
export { experienceToggled } from "@/lib/onboarding/answerLists";

/** Body mass index to one decimal, or null until both height and weight are answered. */
export const bmiOf = (heightCm: number | null, weightKg: number | null) =>
  heightCm && weightKg
    ? Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10
    : null;
