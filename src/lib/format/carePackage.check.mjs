// Self-check for care package wording (no consultation length is ever shown).
// Run: node --no-warnings src/lib/format/carePackage.check.mjs   (Node 22.18+ runs the .ts directly)
import assert from "node:assert/strict";
import { markerCount, withoutDuration } from "./carePackage.ts";

const cases = [
  ["30-minute video consultation", "Video consultation"],
  [
    "A 30-minute video consultation with a doctor.",
    "A video consultation with a doctor.",
  ],
  ["30 minute video consultation", "Video consultation"],
  ["30‑minute video consultation", "Video consultation"], // non-breaking hyphen
  ["30 mins video call", "Video call"],
  ["Video consultation (30 min)", "Video consultation"],
  ["Video consultation, 30 minutes", "Video consultation"],
  ["Video call with a doctor for 30 minutes.", "Video call with a doctor."],
  ["Doctor consultation lasting 45 minutes", "Doctor consultation"],
  ["Home sample collection", "Home sample collection"],
  ["Report within 24 hours", "Report within 24 hours"], // hours are not a consultation length
  ["1 home blood test", "1 home blood test"],
  ["30-minute", "30-minute"], // nothing would be left: keep the line rather than show an empty one
];
for (const [input, expected] of cases)
  assert.equal(withoutDuration(input), expected, input);

assert.equal(markerCount(87), "87 markers");
assert.equal(markerCount(1), "1 marker");
assert.equal(markerCount(0), null);
assert.equal(markerCount(null), null);
console.log("carePackage: all checks passed");
