"use client";

/**
 * Units the visitor chooses, mixed and matched per measure, remembered on this device only
 * (localStorage "inrange-units"). Every tool keeps its maths in kilograms and centimetres; only
 * what is shown and typed changes. Defaults follow everyday Indian use: weight in kilograms, height
 * in feet and inches, and waist in inches (the way a tailor or a jeans size gives it).
 */

import { useSyncExternalStore } from "react";

export type WeightUnit = "kg" | "lb";
export type HeightUnit = "cm" | "ftin";
type WaistUnit = "cm" | "in";
type Units = { weight: WeightUnit; height: HeightUnit; waist: WaistUnit };

const DEFAULT_UNITS: Units = { weight: "kg", height: "ftin", waist: "in" };
const STORAGE_KEY = "inrange-units";
const POUNDS_PER_KG = 2.20462;
const CM_PER_INCH = 2.54;

let current: Units = DEFAULT_UNITS;
let loaded = false;
const listeners = new Set<() => void>();

function readSaved(): Units {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object") {
      return {
        weight: saved.weight === "lb" ? "lb" : "kg",
        height: saved.height === "cm" ? "cm" : "ftin",
        waist: saved.waist === "cm" ? "cm" : "in",
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
    current = readSaved();
  }
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setUnits(changes: Partial<Units>) {
  current = { ...snapshot(), ...changes };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // not saved; the choice still holds for this visit
  }
  listeners.forEach((listener) => listener());
}

/** The visitor's units. The server renders the defaults, and the browser switches to any saved choice. */
export function useUnits(): Units {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_UNITS);
}

/* conversions: canonical kg and cm in, display values out */
export const kgTo = (kg: number, unit: WeightUnit) =>
  unit === "lb" ? kg * POUNDS_PER_KG : kg;
export const toKg = (value: number, unit: WeightUnit) =>
  unit === "lb" ? value / POUNDS_PER_KG : value;
export const toCm = (value: number, unit: WaistUnit) =>
  unit === "in" ? value * CM_PER_INCH : value;

/** 78 kg, or 172 lb. decimals = 1 keeps one decimal (for milestones). */
export function formatWeight(
  kg: number,
  unit: WeightUnit,
  decimals: 0 | 1 = 0,
) {
  const value = kgTo(kg, unit);
  return `${decimals ? value.toFixed(1) : Math.round(value)} ${unit}`;
}

/** 5′3″, or 160 cm. */
export function formatHeight(cm: number, unit: HeightUnit) {
  if (unit === "cm") return `${Math.round(cm)} cm`;
  const inches = Math.round(cm / CM_PER_INCH);
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
}
