/** Questions 1 to 8: each step's answer, ready to save (PATCH /api/onboarding/step), or what is wrong with it. */

import type {
  OnboardingConfig,
  OnboardingStepAnswer,
} from "@/types/onboarding";
import {
  conditionsAnswer,
  visibleConditionCodes,
  type OnboardingDraft,
  type Problem,
} from "./onboardingDraft";
import { AGE_MAX, AGE_MIN, requiredConsentsOf } from "./onboardingOptions";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isProblem = (
  value: OnboardingStepAnswer | Problem,
): value is Problem => "message" in value;

export function stepAnswerFor(
  step: number,
  draft: OnboardingDraft,
  config: OnboardingConfig,
): OnboardingStepAnswer | Problem {
  switch (step) {
    case 1:
      if (!draft.firstName.trim())
        return { message: "Add your first name.", field: "firstName" };
      if (!draft.email.trim())
        return { message: "Add your email.", field: "email" };
      if (!EMAIL_PATTERN.test(draft.email.trim()))
        return { message: "That email does not look right.", field: "email" };
      return {
        step: 1,
        firstName: draft.firstName,
        lastName: draft.lastName,
        email: draft.email,
      };
    case 2:
      return draft.gender
        ? { step: 2, gender: draft.gender }
        : { message: "Choose one." };
    case 3: {
      const age = Number(draft.age);
      if (!draft.age || !Number.isInteger(age))
        return { message: "Enter your age in years.", field: "ageYears" };
      if (age < AGE_MIN)
        return {
          message: "inrange is for adults aged 18 and over.",
          field: "ageYears",
        };
      if (age > AGE_MAX)
        return {
          message: `Enter an age from ${AGE_MIN} to ${AGE_MAX}.`,
          field: "ageYears",
        };
      return { step: 3, ageYears: age };
    }
    case 4:
      return draft.heightCm !== null
        ? { step: 4, heightCm: draft.heightCm }
        : { message: "Add your height, in feet or centimetres." };
    case 5:
      return draft.weightKg !== null
        ? { step: 5, weightKg: draft.weightKg }
        : { message: "Add your weight." };
    case 6:
      return draft.experience.length
        ? { step: 6, weightLossExperience: draft.experience }
        : { message: "Choose at least one." };
    case 7: {
      const codes = visibleConditionCodes(draft, config);
      if (draft.noConditions)
        return { step: 7, noConditions: true, conditions: [] };
      if (!codes.length)
        return { message: "Choose at least one, or None of these." };
      if (codes.includes("OTHER") && !draft.otherText.trim())
        return { message: "Say what it is.", field: "otherText" };
      return {
        step: 7,
        noConditions: false,
        conditions: conditionsAnswer(draft, config),
      };
    }
    default:
      if (
        !requiredConsentsOf(config).every((consent) =>
          draft.consents.includes(consent),
        )
      )
        return {
          message:
            "Tick the box to agree, so your doctor can see your details.",
        };
      return { step: 8, consents: draft.consents };
  }
}
