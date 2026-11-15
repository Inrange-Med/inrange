/**
 * Care package wording. Consultations never show a length (client call, 12 Nov 2026: the first call
 * runs about an hour, the doctor and then the health coach, so "30-minute" sets the wrong
 * expectation). The backend's lines are shown as sent, minus any stated length, so an older line such
 * as "30-minute video consultation" reads "Video consultation" until the data is updated.
 */

const MINUTES = String.raw`\d+(?:\.\d+)?\s*[-‑–\s]?\s*(?:min(?:ute)?s?|mins?)\b`;

/** "A 30-minute video consultation with a doctor." -> "A video consultation with a doctor." */
export function withoutDuration(line: string): string {
  const out = line
    // "for 30 minutes", "of 30 min", "lasting 45 minutes"
    .replace(
      new RegExp(
        String.raw`\s*\b(?:for|of|lasting|about|around|up to)\s+${MINUTES}`,
        "gi",
      ),
      "",
    )
    // "(30 min)", "[30 minutes]"
    .replace(new RegExp(String.raw`\s*[([]\s*${MINUTES}\s*[)\]]`, "gi"), "")
    // "A 30-minute video consultation", "30 mins video call"
    .replace(new RegExp(String.raw`\b${MINUTES}\s*`, "gi"), "")
    // "Video consultation, 30 minutes" leaves a dangling comma
    .replace(/\s*,\s*([.,;:]|$)/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!out) return line.trim();
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** "87 markers" (Redcliffe calls each a parameter); null when the lab gave no count. */
export function markerCount(count: number | null | undefined): string | null {
  if (!count || count < 1) return null;
  return `${count} ${count === 1 ? "marker" : "markers"}`;
}
