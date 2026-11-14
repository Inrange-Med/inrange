/**
 * The onboarding questions, and the bundled answer lists and consent wording (from the design
 * repository's account/config.ts). The backend serves the lists (GET /api/onboarding/config); the
 * bundled copy here is used while it answers 404. Codes are what the backend stores; labels are
 * what a patient reads.
 */

import type {
  ConsentText,
  ConsentType,
  OnboardingConfig,
} from "@/types/onboarding";
import { CONDITIONS, EXPERIENCES, GENDERS } from "@/lib/onboarding/answerLists";

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
      question: "Do you have a blood test report from the last 3 months?",
      why: "Your doctor needs recent blood test results before your first consultation.",
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

const CONSENTS: ConsentText[] = [
  {
    type: "TERMS",
    title: "Terms of service",
    line: "How inrange works, what it costs and how to cancel.",
    more: "You are 18 or over and the details you give are yours and true. Plans are paid only after your doctor's review, with an itemised price before you pay.",
    required: true,
  },
  {
    type: "PRIVACY",
    title: "Privacy notice",
    line: "What we collect, why, and how to delete it.",
    more: "The full notice lists what we collect, why and who can see it. You can ask for a copy, a correction or deletion at any time, and complain to the Data Protection Board of India.",
    required: true,
  },
  {
    type: "HEALTH_DATA",
    title: "Use of my health details",
    line: "Your doctor and care team read your answers and readings.",
    more: "Only the people treating you can see your health details. Every time a doctor opens your record, it is logged.",
    required: true,
  },
  {
    type: "TELECONSULT",
    title: "Consultation by video",
    line: "Under India's Telemedicine Practice Guidelines 2020.",
    more: "Your doctor may decide a video consultation is not enough and ask you to see someone in person. inrange is not for emergencies: call 112.",
    required: true,
  },
  {
    // a separate, optional choice (DPDP Act 2023): recording a call is not the same as having an AI process it
    type: "AI",
    title: "Call transcription",
    line: "An AI scribe drafts your doctor's notes from your video calls.",
    more: "If you agree, your video calls are transcribed so an AI scribe can draft the notes. Your doctor reads, corrects and signs every note, and nothing reaches your record without them. If you say no, nothing about your care changes: your doctor writes the notes themselves.",
    required: false,
  },
];

/** The lists used while GET /api/onboarding/config answers 404. Bump consentVersion when the wording changes. */
export const BUNDLED_CONFIG: OnboardingConfig = {
  consentVersion: "2026-09",
  genders: GENDERS,
  experiences: EXPERIENCES,
  conditions: CONDITIONS,
  consents: CONSENTS,
};

export const requiredConsentsOf = (config: OnboardingConfig): ConsentType[] =>
  config.consents
    .filter((consent) => consent.required)
    .map((consent) => consent.type);
