/**
 * Onboarding: the patient's first health profile, asked one question at a time (8 saved questions),
 * then the blood test step (upload a recent report, or book a home test in a care package). See
 * docs/backend/onboarding.md for the JSON the backend receives.
 */

/** The backend's gender values (PATCH /api/onboarding/step already accepts these). */
export type Gender = "Male" | "Female" | "Other";

/** A consent the patient can give. All but AI and WHATSAPP are needed before a doctor sees their details. */
export type ConsentType =
  | "TERMS"
  | "PRIVACY"
  | "HEALTH_DATA"
  | "TELECONSULT"
  | "AI"
  | "WHATSAPP";

/** A condition the patient ticked; OTHER carries their own words. */
export type ConditionAnswer = { code: string; otherText?: string };

/** Everything the patient has answered so far. null / empty = not answered yet. */
export type OnboardingAnswers = {
  firstName: string;
  lastName: string;
  email: string;
  gender: Gender | null;
  ageYears: number | null;
  heightCm: number | null;
  weightKg: number | null;
  /** codes from EXPERIENCES; FIRST_TIME is never combined with another */
  weightLossExperience: string[];
  /** null = step not answered; [] with noConditions = "None of these" */
  conditions: ConditionAnswer[] | null;
  noConditions: boolean;
  consents: ConsentType[];
};

/** GET /api/onboarding/status: where a returning patient picks up. */
export type OnboardingStatus = {
  /** the question to show, 1 to 8 */
  currentStep: number;
  /** 0 when nothing has been saved yet */
  lastCompletedStep: number;
  completed: boolean;
  answers: OnboardingAnswers;
};

/** One step's answers, as the page hands them to onboardingService.saveOnboardingStep(). */
export type OnboardingStepAnswer =
  | { step: 1; firstName: string; lastName: string; email: string }
  | { step: 2; gender: Gender }
  | { step: 3; ageYears: number }
  | { step: 4; heightCm: number }
  | { step: 5; weightKg: number }
  | { step: 6; weightLossExperience: string[] }
  | { step: 7; noConditions: boolean; conditions: ConditionAnswer[] }
  | { step: 8; consents: ConsentType[] };

/** An answer the patient can pick: `code` is stored, `label` is read. */
export type OnboardingOption = { code: string; label: string };

/** A consent's wording: a title, one line, and more behind "Read them". */
export type ConsentText = {
  type: ConsentType;
  title: string;
  line: string;
  more: string;
  required: boolean;
};

/** GET /api/onboarding/config: the answer lists and consent wording (bundled copy used on 404). */
export type OnboardingConfig = {
  /** the version of the consent wording, saved with each consent */
  consentVersion: string;
  genders: { code: Gender; label: string }[];
  experiences: OnboardingOption[];
  conditions: OnboardingOption[];
  consents: ConsentText[];
};
