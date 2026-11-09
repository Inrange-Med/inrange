// Self-check for where sign-in may send someone (open-redirect guard).
// Run: node --no-warnings src/lib/navigation/signInReturn.check.mjs   (Node 22.18+ runs the .ts directly)
import assert from "node:assert/strict";
import { pathAfterSignIn, signInHrefFor } from "./signInReturn.ts";

const P = "/patient-dashboard";
const D = "/doctor-dashboard";
assert.equal(signInHrefFor("/pricing"), "/sign-in?next=%2Fpricing");
assert.equal(pathAfterSignIn(null, P), P);
assert.equal(
  pathAfterSignIn("/patient-dashboard/care?tab=1", P),
  "/patient-dashboard/care?tab=1",
);
assert.equal(pathAfterSignIn("/doctor-dashboard/schedule", P), P); // another role's area
assert.equal(pathAfterSignIn("/patient-dashboard-evil", P), P); // look-alike prefix
assert.equal(pathAfterSignIn("/consultation/42", D), "/consultation/42");
assert.equal(pathAfterSignIn("/pricing", D), "/pricing");
assert.equal(
  pathAfterSignIn("/onboarding?step=report", P),
  "/onboarding?step=report",
);
assert.equal(pathAfterSignIn("/onboarding", D), D); // doctors do not onboard
assert.equal(pathAfterSignIn("/admin/doctors", "/admin"), "/admin/doctors");
assert.equal(pathAfterSignIn("/admin/doctors", D), D); // only admins reach /admin
assert.equal(pathAfterSignIn("/onboarding", "/admin"), "/admin");
for (const hostile of [
  "https://evil.com",
  "//evil.com",
  "/\\evil.com",
  "evil.com",
  "javascript:alert(1)",
])
  assert.equal(pathAfterSignIn(hostile, P), P, hostile);
console.log("signInReturn: all checks passed");
