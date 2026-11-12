/*
  Plain data and maths shared by the tools (client) and their pages (server).
  Kept free of "use client" so server pages can render the same numbers into tables.
*/

import type { WeightUnit } from "./units";

const LB = 2.20462;
const inUnit = (kg: number, u: WeightUnit) => (u === "lb" ? kg * LB : kg);

/*
  Protein in common vegetarian foods, per typical home portion. Approximate, rounded from the
  Indian Food Composition Tables 2017 and NIN food values; soya chunks from typical pack labels.
*/
export const FOODS = [
  { id: "dal", name: "Dal", portion: "1 katori, cooked", g: 7 },
  { id: "rajma", name: "Rajma or chole", portion: "1 katori, cooked", g: 8 },
  { id: "paneer", name: "Paneer", portion: "50 g", g: 9 },
  { id: "soya", name: "Soya chunks", portion: "25 g dry", g: 13 },
  { id: "milk", name: "Milk", portion: "1 glass, 200 ml", g: 6 },
  { id: "curd", name: "Curd", portion: "1 katori, 150 g", g: 5 },
  { id: "chilla", name: "Besan chilla", portion: "1, 30 g besan", g: 6 },
  { id: "peanuts", name: "Peanuts", portion: "a handful, 30 g", g: 7 },
  { id: "roti", name: "Roti", portion: "1 medium", g: 3 },
  { id: "rice", name: "Rice", portion: "1 katori, cooked", g: 3 },
  { id: "egg", name: "Egg", portion: "1, if you eat eggs", g: 6 },
] as const;

export type Food = (typeof FOODS)[number];

/*
  Healthy weight for a height, by the revised definition of obesity in Asian Indians
  (Misra et al., 2025): BMI 18.5 to 23, rounded inward so both ends sit inside the range.
  The global (WHO) chart runs to 25. BMI does not change with sex, so neither does the range.
*/
export function healthyRange(cm: number, u: WeightUnit) {
  const h2 = (cm / 100) ** 2;
  return {
    lo: Math.ceil(inUnit(18.5 * h2, u)),
    hi: Math.floor(inUnit(23 * h2, u)),
    mid: Math.round(inUnit(20.75 * h2, u)),
    who: Math.floor(inUnit(25 * h2, u)),
  };
}


/* Heights with their own page: 4 ft 8 in to 6 ft 4 in, one inch apart */
export const HEIGHT_INCHES = Array.from({ length: 21 }, (_, i) => 56 + i);

export const heightParts = (inches: number) => ({ ft: Math.floor(inches / 12), inch: inches % 12 });

/** 5 feet 4 inches, 5 feet 1 inch, 6 feet */
export function heightWords(inches: number) {
  const { ft, inch } = heightParts(inches);
  return inch === 0 ? `${ft} feet` : `${ft} feet ${inch} ${inch === 1 ? "inch" : "inches"}`;
}

/** 5′4″ */
export function heightShort(inches: number) {
  const { ft, inch } = heightParts(inches);
  return `${ft}′${inch}″`;
}

/** 5-feet-4-inches, the address of that height's page */
export const heightSlug = (inches: number) => heightWords(inches).replace(/ /g, "-");

export const inchesFromSlug = (slug: string) => HEIGHT_INCHES.find((i) => heightSlug(i) === slug);
