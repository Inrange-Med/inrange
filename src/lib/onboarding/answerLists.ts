/**
 * The health questions' bundled answer lists and limits, shared by the public free check
 * (/assessment, before sign-in) and onboarding (after it), so both store the same codes. The backend
 * may serve its own lists to onboarding (GET /api/onboarding/config); the free check runs before
 * sign-in, so it always uses these. Codes are what the backend stores; labels are what a person reads.
 */

import type { ConsentText, Gender, OnboardingOption } from "@/types/onboarding";

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

/** The consent wording, shared by onboarding and the free check's last step. Bump the version when
    the wording changes: a consent given to older wording is asked again. */
export const CONSENT_VERSION = "2026-09";

export const CONSENTS: ConsentText[] = [
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

/** The consents care needs (all but the optional AI scribe). */
export const REQUIRED_CONSENTS = CONSENTS.filter((c) => c.required).map(
  (c) => c.type,
);
