// Self-check for the free check's hand-off to onboarding (validation, expiry, storage).
// Run: node --no-warnings src/lib/onboarding/freeCheck.check.mjs   (Node 22.18+ runs the .ts directly)
import assert from "node:assert/strict";
import { register } from "node:module";

// the app imports its own files without an extension; let this script find the .ts files the same way
register(
  "data:text/javascript," +
    encodeURIComponent(
      `export async function resolve(s, c, next) {
        try { return await next(s, c); }
        catch (e) { if (s.startsWith(".")) return next(s + ".ts", c); throw e; }
      }`,
    ),
  import.meta.url,
);

// a sessionStorage stand-in, as a browser tab has
const mem = new Map();
globalThis.window = {
  sessionStorage: {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  },
};

const {
  bmiFrom,
  checkedAnswers,
  clearFreeCheck,
  readFreeCheck,
  saveFreeCheck,
} = await import("./freeCheck.ts");

const good = {
  gender: "Female",
  ageYears: 41,
  heightCm: 162.56,
  weightKg: 82.04,
  weightLossExperience: ["SELF_DIET", "PROGRAMME"],
  noConditions: false,
  conditions: [{ code: "PCOS" }, { code: "OTHER", otherText: "  Asthma " }],
};

// valid answers are kept, rounded to a tenth, "Something else" trimmed
assert.deepEqual(checkedAnswers(good), {
  ...good,
  heightCm: 162.6,
  weightKg: 82,
  conditions: [{ code: "PCOS" }, { code: "OTHER", otherText: "Asthma" }],
});
// out of the backend's ranges, or missing: nothing is kept
for (const bad of [
  { ...good, ageYears: 17 },
  { ...good, ageYears: 91 },
  { ...good, ageYears: 40.5 },
  { ...good, heightCm: 119 },
  { ...good, weightKg: 251 },
  { ...good, gender: "female" },
  { ...good, weightLossExperience: [] },
  { ...good, weightLossExperience: ["FIRST_TIME", "SELF_DIET"] },
  { ...good, conditions: [], noConditions: false },
  { ...good, noConditions: true }, // "None of these" with conditions ticked
  { ...good, conditions: [{ code: "OTHER", otherText: " " }] },
  null,
  "text",
])
  assert.equal(checkedAnswers(bad), null, JSON.stringify(bad));
// PCOS is never kept for a man; unknown codes are dropped
assert.deepEqual(
  checkedAnswers({
    ...good,
    gender: "Male",
    conditions: [{ code: "PCOS" }, { code: "BP" }, { code: "NOPE" }],
  }).conditions,
  [{ code: "BP" }],
);
// "None of these" alone is valid
assert.equal(
  checkedAnswers({ ...good, noConditions: true, conditions: [] }).noConditions,
  true,
);

// stored, read back, then too old: dropped and removed
const t0 = Date.UTC(2026, 10, 14, 10);
assert.equal(saveFreeCheck(good, t0), true);
assert.equal(readFreeCheck(t0 + 60_000).weightKg, 82);
assert.equal(readFreeCheck(t0 + 13 * 3600_000), null);
assert.equal(mem.size, 0);
// a clock that went backwards, or an edited value, is not trusted
saveFreeCheck(good, t0);
assert.equal(readFreeCheck(t0 - 1), null);
saveFreeCheck(good, t0);
mem.set(
  "inrange-free-check",
  JSON.stringify({ ...JSON.parse(mem.get("inrange-free-check")), weightKg: 9 }),
);
assert.equal(readFreeCheck(t0 + 1), null);
mem.set("inrange-free-check", "{not json");
assert.equal(readFreeCheck(t0), null);
// an invalid save stores nothing
assert.equal(saveFreeCheck({ ...good, ageYears: 12 }, t0), false);
saveFreeCheck(good, t0);
clearFreeCheck();
assert.equal(readFreeCheck(t0), null);

// the details from the check's last step: kept when usable, dropped (with the health answers kept)
// when not; consents are filtered to known types
const id = {
  firstName: " Asha ",
  lastName: "",
  email: "asha@example.com",
  consents: ["TERMS", "PRIVACY", "HEALTH_DATA", "TELECONSULT", "NOPE"],
  consentVersion: "2026-09",
};
assert.deepEqual(checkedAnswers({ ...good, identity: id }).identity, {
  ...id,
  firstName: "Asha",
  consents: ["TERMS", "PRIVACY", "HEALTH_DATA", "TELECONSULT"],
});
for (const bad of [
  { ...id, firstName: " " },
  { ...id, email: "asha@" },
  { ...id, consentVersion: "" },
])
  assert.equal(checkedAnswers({ ...good, identity: bad }).identity, undefined);
assert.equal(
  checkedAnswers({ ...good, identity: { ...id, email: "x" } }).weightKg,
  82,
);

assert.equal(bmiFrom(162.6, 82), 31);
console.log("freeCheck: all checks passed");
