"use client";

import { useSyncExternalStore } from "react";

/*
  Units the visitor chooses, mixed and matched per measure, remembered on this device only.
  Every tool keeps its maths in kilograms and centimetres; only what is shown and typed changes.
  Defaults follow everyday Indian use: weight in kilograms, height in feet and inches, and
  waist in inches (the way a tailor or a jeans size gives it).
*/

export type WeightUnit = "kg" | "lb";
export type HeightUnit = "cm" | "ftin";
export type WaistUnit = "cm" | "in";
export type Units = { weight: WeightUnit; height: HeightUnit; waist: WaistUnit };

export const DEFAULT_UNITS: Units = { weight: "kg", height: "ftin", waist: "in" };

const KEY = "inrange-units";
const LB = 2.20462;
const IN = 2.54;

let state: Units = DEFAULT_UNITS;
let loaded = false;
const listeners = new Set<() => void>();

function load(): Units {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && typeof v === "object") {
      return {
        weight: v.weight === "lb" ? "lb" : "kg",
        height: v.height === "cm" ? "cm" : "ftin",
        waist: v.waist === "cm" ? "cm" : "in",
      };
    }
  } catch {
    // storage blocked or unreadable: keep the defaults
  }
  return DEFAULT_UNITS;
}

function snapshot() {
  if (!loaded) {
    loaded = true;
    state = load();
  }
  return state;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setUnits(patch: Partial<Units>) {
  state = { ...snapshot(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // not saved; the choice still holds for this visit
  }
  listeners.forEach((fn) => fn());
}

/** The visitor's units. The server renders the defaults, and the browser switches to any saved choice. */
export function useUnits(): Units {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_UNITS);
}

/* conversions: canonical kg and cm in, display values out */
export const kgTo = (kg: number, u: WeightUnit) => (u === "lb" ? kg * LB : kg);
export const toKg = (v: number, u: WeightUnit) => (u === "lb" ? v / LB : v);
export const cmTo = (cm: number, u: WaistUnit) => (u === "in" ? cm / IN : cm);
export const toCm = (v: number, u: WaistUnit) => (u === "in" ? v * IN : v);

const r1 = (n: number) => Math.round(n * 10) / 10;
const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** 78 kg, or 172 lb. dp = 1 keeps one decimal (for milestones). */
export function fmtWeight(kg: number, u: WeightUnit, dp: 0 | 1 = 0) {
  const v = kgTo(kg, u);
  return `${dp ? v.toFixed(1) : Math.round(v)} ${u}`;
}

/** 5′3″, or 160 cm. */
export function fmtHeight(cm: number, u: HeightUnit) {
  if (u === "cm") return `${Math.round(cm)} cm`;
  const total = Math.round(cm / IN);
  return `${Math.floor(total / 12)}′${total % 12}″`;
}

/** 92 cm, or 36.2 in. Thresholds keep a decimal in inches so 80 cm reads 31.5 in. */
export function fmtLength(cm: number, u: WaistUnit) {
  return u === "in" ? `${trim(r1(cm / IN))} in` : `${trim(r1(cm))} cm`;
}
