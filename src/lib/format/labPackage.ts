/**
 * Lab package wording. Redcliffe's own strings arrive in mixed shapes ("24 HOURS", "Next Day",
 * "Within 24-48 hrs.", "12 Hours Fasting Required", names ending in "*"); these turn them into one
 * plain, consistent voice for the patient.
 */

import type { LabPackage } from "@/types/labTest";

/** "HbA1C (Glycosylated Hemoglobin)*" -> "HbA1C (Glycosylated Hemoglobin)" */
export const packageName = (name: string) =>
  name.replace(/\*+/g, "").replace(/\s+/g, " ").trim();

/** "Within 24-48 hrs." -> "Report in 24 to 48 hours"; "Next Day" -> "Report next day"; "" -> null */
export function reportWords(raw: string): string | null {
  const t = raw
    .toLowerCase()
    .replace(/\bhrs?\b\.?/g, "hours")
    .replace(/\bhours\s+hours\b/g, "hours")
    .replace(/(\d)\s*-\s*(\d)/g, "$1 to $2")
    .replace(/\.$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;
  if (/^within /.test(t)) return `Report ${t.replace(/^within /, "in ")}`;
  if (/^\d/.test(t)) return `Report in ${t}`;
  return `Report ${t}`;
}

/** Hours to fast, or null when the lab asks for none ("No special preparation required"). */
export function fastingHours(raw: string): string | null {
  if (!raw || /no (special )?(preparation|fasting)|not required/i.test(raw))
    return null;
  const m = raw.match(/(\d+)\s*(?:-|to)\s*(\d+)|(\d+)/);
  if (!m) return null;
  return m[3] ?? `${m[1]} to ${m[2]}`;
}

/** The before-collection instruction, or null: "Fast for 12 hours before the collection. Water is fine." */
export function fastingSentence(raw: string): string | null {
  const hours = fastingHours(raw);
  return hours
    ? `Fast for ${hours} hours before the collection. Water is fine.`
    : null;
}

/** The short facts under a package name: ["87 tests", "Report next day", "12 hours fasting"]. */
export function packageFacts(pkg: LabPackage): string[] {
  const facts: string[] = [];
  if (pkg.testCount > 0)
    facts.push(`${pkg.testCount} ${pkg.testCount === 1 ? "test" : "tests"}`);
  const report = reportWords(pkg.reportTime);
  if (report) facts.push(report);
  const hours = fastingHours(pkg.fastingNote);
  // an empty note means the lab did not say, so only an explicit "no preparation" reads as no fasting
  if (hours) facts.push(`${hours} hours fasting`);
  else if (pkg.fastingNote) facts.push("No fasting");
  return facts;
}
