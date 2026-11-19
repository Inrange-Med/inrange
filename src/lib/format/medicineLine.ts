/** A prescribed medicine in one plain sentence: "1 injection, once a week, for 1 month, after food". */

import type { MedicineLineView } from "@/types/consultation";

const lower = (s: string) =>
  /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;

export function medicineLineWords(
  m: Pick<
    MedicineLineView,
    "dose" | "frequencyWords" | "duration" | "intakeWords"
  >,
) {
  const parts = [
    m.dose,
    m.frequencyWords,
    m.duration && `for ${m.duration}`,
    m.intakeWords,
  ].filter(Boolean);
  return parts.map((part, i) => (i === 0 ? part : lower(part))).join(", ");
}
