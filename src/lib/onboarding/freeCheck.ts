/**
 * The free check's answers (/assessment, before sign-in), handed to onboarding after sign-in so
 * nobody answers the same question twice (client call, 12 Nov 2026: height, weight, age and health
 * questions come before the mobile number). They live in this browser tab only (sessionStorage):
 * nothing is sent until the person signs in, and closing the tab forgets them. Onboarding saves them
 * to the profile, then clears them once the profile is complete.
 *
 * Every read is checked again (ranges and codes as the backend accepts them), so a stale, edited or
 * older-format value is ignored rather than saved.
 */

import type { ConditionAnswer, Gender } from "@/types/onboarding";
import {
  AGE_MAX,
  AGE_MIN,
  CONDITIONS,
  EXPERIENCES,
  FIRST_TIME,
  GENDERS,
  HEIGHT_CM,
  WEIGHT_KG,
} from "./answerLists";

const KEY = "inrange-free-check";
const VERSION = 1;
/** Older answers are dropped: a weight from yesterday's check should not become today's baseline. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export type FreeCheckAnswers = {
  gender: Gender;
  ageYears: number;
  /** one decimal */
  heightCm: number;
  /** one decimal */
  weightKg: number;
  weightLossExperience: string[];
  noConditions: boolean;
  conditions: ConditionAnswer[];
};

type Stored = FreeCheckAnswers & { v: number; savedAt: number };

const tenth = (value: number) => Math.round(value * 10) / 10;
const inRange = (value: unknown, min: number, max: number) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;

/** The answers as onboarding will save them, or null when anything is missing or out of range. */
export function checkedAnswers(raw: unknown): FreeCheckAnswers | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Partial<FreeCheckAnswers>;
  if (!GENDERS.some((g) => g.code === a.gender)) return null;
  if (!inRange(a.ageYears, AGE_MIN, AGE_MAX) || !Number.isInteger(a.ageYears))
    return null;
  if (!inRange(a.heightCm, HEIGHT_CM.min, HEIGHT_CM.max)) return null;
  if (!inRange(a.weightKg, WEIGHT_KG.min, WEIGHT_KG.max)) return null;

  const experience = Array.isArray(a.weightLossExperience)
    ? a.weightLossExperience.filter((code) =>
        EXPERIENCES.some((e) => e.code === code),
      )
    : [];
  if (!experience.length) return null;
  if (experience.includes(FIRST_TIME) && experience.length > 1) return null;

  const noConditions = a.noConditions === true;
  const conditions = Array.isArray(a.conditions)
    ? a.conditions.filter(
        (c): c is ConditionAnswer =>
          !!c &&
          typeof c.code === "string" &&
          CONDITIONS.some((known) => known.code === c.code) &&
          // PCOS is never asked of men, so never kept for them
          !(a.gender === "Male" && c.code === "PCOS") &&
          (c.code !== "OTHER" ||
            (typeof c.otherText === "string" && c.otherText.trim().length > 0)),
      )
    : [];
  if (noConditions === conditions.length > 0) return null;

  return {
    gender: a.gender as Gender,
    ageYears: a.ageYears as number,
    heightCm: tenth(a.heightCm as number),
    weightKg: tenth(a.weightKg as number),
    weightLossExperience: [...new Set(experience)],
    noConditions,
    conditions: conditions.map((c) =>
      c.code === "OTHER"
        ? { code: c.code, otherText: c.otherText!.trim().slice(0, 120) }
        : { code: c.code },
    ),
  };
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    // storage blocked (some private modes): the check still works, onboarding just asks again
    return null;
  }
}

/** Keeps the finished check for onboarding. Returns false when the browser would not store it. */
export function saveFreeCheck(
  answers: FreeCheckAnswers,
  now = Date.now(),
): boolean {
  const checked = checkedAnswers(answers);
  const store = storage();
  if (!checked || !store) return false;
  try {
    store.setItem(
      KEY,
      JSON.stringify({ ...checked, v: VERSION, savedAt: now } satisfies Stored),
    );
    return true;
  } catch {
    return false;
  }
}

/** The finished check from this tab, or null (none, too old, or not valid any more). */
export function readFreeCheck(now = Date.now()): FreeCheckAnswers | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<Stored>;
    const fresh =
      stored.v === VERSION &&
      typeof stored.savedAt === "number" &&
      now - stored.savedAt >= 0 &&
      now - stored.savedAt <= MAX_AGE_MS;
    const answers = fresh ? checkedAnswers(stored) : null;
    if (!answers) store.removeItem(KEY);
    return answers;
  } catch {
    return null;
  }
}

export function clearFreeCheck(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // nothing to do: the tab forgets it on close
  }
}

/** Body mass index to one decimal. */
export const bmiFrom = (heightCm: number, weightKg: number) =>
  Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
