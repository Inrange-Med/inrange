/**
 * The health questions' bundled answer lists and limits, shared by the public free check
 * (/assessment, before sign-in) and onboarding (after it), so both store the same codes. The backend
 * may serve its own lists to onboarding (GET /api/onboarding/config); the free check runs before
 * sign-in, so it always uses these. Codes are what the backend stores; labels are what a person reads.
 */

import type { Gender, OnboardingOption } from "@/types/onboarding";

export const GENDERS: { code: Gender; label: string }[] = [
  { code: "Male", label: "Male" },
  { code: "Female", label: "Female" },
  { code: "Other", label: "Other" },
];

export const AGE_MIN = 18;
export const AGE_MAX = 90;
/** The backend's accepted ranges (docs/backend/onboarding.md, Validation). */
export const HEIGHT_CM = { min: 120, max: 220 } as const;
export const WEIGHT_KG = { min: 30, max: 250 } as const;

export const FIRST_TIME = "FIRST_TIME";

export const EXPERIENCES: OnboardingOption[] = [
  { code: FIRST_TIME, label: "This is my first real attempt" },
  { code: "SELF_DIET", label: "Diet and exercise on my own" },
  { code: "PROGRAMME", label: "A dietitian, gym programme or app" },
  { code: "DOCTOR_MEDS", label: "Medicine prescribed by a doctor" },
  { code: "SURGERY", label: "Weight-loss surgery" },
];

/** In pairs that share one phone row without breaking a label: a long name beside a short one. */
export const CONDITIONS: OnboardingOption[] = [
  { code: "T2D", label: "Type 2 diabetes" },
  { code: "PREDIABETES", label: "Prediabetes" },
  { code: "BP", label: "High blood pressure" },
  { code: "PCOS", label: "PCOS" },
  { code: "THYROID", label: "Thyroid condition" },
  { code: "FATTY_LIVER", label: "Fatty liver" },
  { code: "LIPIDS", label: "High cholesterol" },
  { code: "SLEEP_APNOEA", label: "Sleep apnoea" },
  { code: "HEART", label: "Heart disease" },
  { code: "KIDNEY", label: "Kidney disease" },
  { code: "OTHER", label: "Something else" },
];

/** PCOS is asked only of people who did not answer Male. */
export const conditionsFor = (
  conditions: OnboardingOption[],
  gender: Gender | null,
) =>
  conditions.filter(
    (condition) => !(gender === "Male" && condition.code === "PCOS"),
  );

/** A first attempt and past attempts each clear the other. */
export const experienceToggled = (experience: string[], code: string) =>
  experience.includes(code)
    ? experience.filter((chosen) => chosen !== code)
    : code === FIRST_TIME
      ? [FIRST_TIME]
      : [...experience.filter((chosen) => chosen !== FIRST_TIME), code];
