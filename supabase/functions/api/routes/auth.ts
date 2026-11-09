// Sign-in by mobile code.
//   POST /api/auth/send-otp    { mobile }        -> { message, data: { provider, mock, codeLength } }
//   POST /api/auth/verify-otp  { mobile, otp }   -> { data: { accessToken, user, nextScreen } }
//   POST /api/auth/firebase    { idToken }       -> same as verify-otp
// With FIREBASE_PROJECT_ID set, send-otp answers provider "firebase" and sends nothing: the browser
// has Firebase text the code, then trades Firebase's ID token (its proof of the phone number) at
// /api/auth/firebase. Only REVIEWER_MOBILES keep our own code flow. Without it, our own codes
// (MSG91, or PILOT_OTP in the pilot) are used for every number.
//   GET  /api/auth/me                            -> { data: user }
//   POST /api/auth/logout                        ends this session
import { Hono } from "hono";
import type { Context } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { sql } from "../lib/db.ts";
import { body, fail, ok } from "../lib/http.ts";
import { issueToken, requireUser } from "../lib/auth.ts";
import { env, live } from "../lib/env.ts";
import { sendOtpSms, smsLive } from "../integrations/sms.ts";

export const auth = new Hono();

const CODE_LENGTH = 6;
const CODE_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const SENDS_PER_HOUR = 5;

function normaliseMobile(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  if (!/^[6-9]\d{9}$/.test(digits)) fail(400, "Enter a valid 10-digit Indian mobile number.");
  return digits;
}

async function hash(code: string, mobile: string) {
  const data = new TextEncoder().encode(`${env.jwtSecret}:${mobile}:${code}`);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10 ** CODE_LENGTH;
  return String(n).padStart(CODE_LENGTH, "0");
}

auth.post("/send-otp", async (c) => {
  const mobile = normaliseMobile((await body(c)).mobile);
  if (live.firebase() && !env.reviewerMobiles.includes(mobile))
    return ok(c, { provider: "firebase", mock: false, codeLength: CODE_LENGTH }, "We are sending a 6-digit code to your phone.");
  const [prev] = await sql`select * from otp_codes where mobile = ${mobile}`;
  const now = Date.now();
  let sends = 1;
  let windowStart = new Date(now);
  if (prev) {
    if (now - new Date(prev.last_sent_at).getTime() < 30_000)
      fail(429, "Please wait 30 seconds before asking for another code.");
    const inWindow = now - new Date(prev.window_started_at).getTime() < 3600_000;
    sends = inWindow ? prev.sends_in_window + 1 : 1;
    windowStart = inWindow ? new Date(prev.window_started_at) : new Date(now);
    if (sends > SENDS_PER_HOUR) fail(429, "Too many codes asked for. Try again in an hour.");
  }
  const mock = !smsLive();
  const code = mock ? env.pilotOtp : randomCode();
  await sql`
    insert into otp_codes (mobile, code_hash, expires_at, attempts, sends_in_window, window_started_at, last_sent_at)
    values (${mobile}, ${await hash(code, mobile)}, ${new Date(now + CODE_MINUTES * 60_000)}, 0, ${sends}, ${windowStart}, now())
    on conflict (mobile) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0,
      sends_in_window = excluded.sends_in_window, window_started_at = excluded.window_started_at, last_sent_at = now()`;
  await sendOtpSms(mobile, code);
  return ok(c, { provider: "api", mock, codeLength: CODE_LENGTH },
    mock ? `Pilot mode: enter ${env.pilotOtp} to sign in.` : "We sent a 6-digit code to your phone.");
});

auth.post("/verify-otp", async (c) => {
  const input = await body(c);
  const mobile = normaliseMobile(input.mobile);
  const otp = String(input.otp ?? "").trim();
  const [row] = await sql`select * from otp_codes where mobile = ${mobile}`;
  if (!row || new Date(row.expires_at).getTime() < Date.now())
    fail(400, "That code has expired. Ask for a new one.");
  if (row.attempts >= MAX_ATTEMPTS) fail(429, "Too many wrong tries. Ask for a new code.");
  if ((await hash(otp, mobile)) !== row.code_hash) {
    await sql`update otp_codes set attempts = attempts + 1 where mobile = ${mobile}`;
    fail(400, "That code is not right. Check it and try again.");
  }
  // single use: consumed in the same step it is checked
  await sql`delete from otp_codes where mobile = ${mobile}`;

  return await signIn(c, mobile);
});

// Firebase signs ID tokens with Google's keys; the project, issuer and a recent sign-in are checked
// (https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library)
const firebaseKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

auth.post("/firebase", async (c) => {
  if (!live.firebase()) fail(404, "This feature is not available yet.");
  const idToken = String((await body(c)).idToken ?? "");
  let claims: Record<string, unknown>;
  try {
    ({ payload: claims } = await jwtVerify(idToken, firebaseKeys, {
      issuer: `https://securetoken.google.com/${env.firebaseProjectId}`,
      audience: env.firebaseProjectId,
      algorithms: ["RS256"],
    }));
  } catch {
    return fail(401, "That sign-in did not go through. Ask for a new code.");
  }
  // a token is good for an hour; only a sign-in from the last 10 minutes opens a session here
  if (!claims.sub || Date.now() / 1000 - Number(claims.auth_time ?? 0) > 600)
    fail(401, "That sign-in is too old. Ask for a new code.");
  const phone = String(claims.phone_number ?? "");
  if (!phone.startsWith("+91")) fail(400, "Sign in with an Indian mobile number.");
  return await signIn(c, normaliseMobile(phone));
});

/** The person behind a proven mobile number (a new number becomes a patient) and a new session. */
async function signIn(c: Context, mobile: string) {
  const [user] = await sql`
    insert into users (mobile) values (${mobile})
    on conflict (mobile) do update set mobile = excluded.mobile
    returning id, role, full_name, mobile, onboarding_completed`;
  const [session] = await sql`insert into auth_sessions (user_id) values (${user.id}) returning id`;
  const accessToken = await issueToken(user as unknown as { id: number; role: "PATIENT" | "DOCTOR" | "ADMIN"; full_name: string | null }, session.id);
  const nextScreen = user.role === "PATIENT" && !user.onboarding_completed ? "ONBOARDING" : "DASHBOARD";
  return ok(c, {
    accessToken,
    refreshToken: null,
    nextScreen,
    user: { id: user.id, userId: user.id, fullName: user.full_name ?? "", role: user.role, mobile: user.mobile },
  }, "Signed in");
}

auth.get("/me", async (c) => {
  const me = await requireUser(c);
  const [u] = await sql`select id, mobile, role, full_name, email, onboarding_completed from users where id = ${me.id}`;
  return ok(c, {
    id: u.id, userId: u.id, mobile: u.mobile, role: u.role, fullName: u.full_name ?? "",
    email: u.email, onboardingCompleted: u.onboarding_completed,
  });
});

auth.post("/logout", async (c) => {
  const me = await requireUser(c);
  await sql`update auth_sessions set revoked_at = now() where id = ${me.sid}`;
  return ok(c, null, "Signed out");
});
