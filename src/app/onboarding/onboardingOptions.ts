/**
 * The onboarding questions, and the bundled answer lists and consent wording (from the design
 * repository's account/config.ts). The backend serves the lists (GET /api/onboarding/config); the
 * bundled copy here is used while it answers 404. Codes are what the backend stores; labels are
 * what a patient reads.
 */

import type { ConsentType, OnboardingConfig } from "@/types/onboarding";
import {
  CONDITIONS,
  CONSENT_VERSION,
  CONSENTS,
  EXPERIENCES,
  GENDERS,
} from "@/lib/onboarding/answerLists";

// the answer lists are shared with the public free check, which runs before sign-in
export {
  AGE_MAX,
  AGE_MIN,
  conditionsFor,
  FIRST_TIME,
} from "@/lib/onboarding/answerLists";

/** Questions 1 to 8 are saved with PATCH /api/onboarding/step; then the profile is completed. */
export const LAST_SAVED_STEP = 8;
/** The blood test step, after the profile is completed: upload a report or book a home test. */
export const REPORT_STEP = 9;
export const TOTAL_STEPS = REPORT_STEP;

/** The question and its one-line reason, per step. */
export const STEP_QUESTIONS: Record<number, { question: string; why: string }> =
  {
    1: {
      question: "What should we call you?",
      why: "Your doctor uses your name on the call. Reports go to your email.",
    },
    2: {
      question: "Which describes you?",
      why: "Waist limits differ for men and women, so your doctor reads your numbers against the right one.",
    },
    3: {
      question: "How old are you?",
      why: "inrange is for adults 18 and over. Age also guides which blood tests your doctor asks for.",
    },
    4: {
      question: "How tall are you?",
      why: "In feet or centimetres, whichever you know.",
    },
    5: {
      question: "What do you weigh?",
      why: "A recent reading is fine. You can log a fresh one later.",
    },
    6: {
      question: "Have you tried to lose weight before?",
      why: "Choose all that apply. It tells your doctor where to start.",
    },
    7: {
      question: "Do you have any of these?",
      why: "Choose all that apply. Only your care team can see this.",
    },
    8: {
      question: "Before your doctor sees your details",
      why: "One tick covers what your care needs.",
    },
    9: {
      question: "Your first step",
      why: "Blood tests at home, then your doctor and health coach on one video call. You see the fee before you pay.",
    },
  };

/** Onboarding in short chapters, so the progress reads as sections of a form rather than a long count. */
export const CHAPTERS = [
  { name: "About you", steps: [1, 2, 3] },
  { name: "Measurements", steps: [4, 5] },
  { name: "Health", steps: [6, 7] },
  { name: "Consent", steps: [8] },
  { name: "Blood test", steps: [REPORT_STEP] },
];

/** Where the height and weight rulers rest until the first touch; never saved unless the patient moves them. */
export const HEIGHT_FROM_CM = 165;
export const WEIGHT_FROM_KG = 78;

/** The lists used while GET /api/onboarding/config answers 404. Bump CONSENT_VERSION (in
    lib/onboarding/answerLists) when the wording changes. */
export const BUNDLED_CONFIG: OnboardingConfig = {
  consentVersion: CONSENT_VERSION,
  genders: GENDERS,
  experiences: EXPERIENCES,
  conditions: CONDITIONS,
  consents: CONSENTS,
};

export const requiredConsentsOf = (config: OnboardingConfig): ConsentType[] =>
  config.consents
    .filter((consent) => consent.required)
    .map((consent) => consent.type);
