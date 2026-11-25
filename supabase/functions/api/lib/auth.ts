// Our own sign-in tokens (HS256, signed with APP_JWT_SECRET). Claims: sub/userId, role, name, sid.
// requireUser(c) returns the caller or answers 401. The session row lets logout end a token at once.
import type { Context } from "hono";
import { jwtVerify, SignJWT } from "jose";
import { env } from "./env.ts";
import { sql } from "./db.ts";
import { fail } from "./http.ts";

/**
 * COACH: a health or fitness coach; reaches only their own patients (routes/coach.ts, and the medicine queue).
 * SALES: a salesperson; reaches only the sales panel and the patients assigned to them (routes/sales.ts).
 * OPS: someone on the operations team; reaches the work of their desks only (requireDesk).
 * ADMIN passes every role check below; each route still decides what an admin may do there.
 */
export type Role = "PATIENT" | "DOCTOR" | "ADMIN" | "COACH" | "SALES" | "OPS";
/** BLOOD_TESTS: books and moves blood tests. CONSULTATIONS: books doctors' consultations. MEDICINE: the pharmacy. */
export type Desk = "BLOOD_TESTS" | "CONSULTATIONS" | "MEDICINE";
export const DESKS: Desk[] = ["BLOOD_TESTS", "CONSULTATIONS", "MEDICINE"];
export type AuthUser = { id: number; role: Role; mobile: string; fullName: string | null; sid: string; desks: Desk[] };

const key = () => {
  if (!env.jwtSecret) throw new Error("APP_JWT_SECRET is not set"); // fail closed, never a guessable key
  return new TextEncoder().encode(env.jwtSecret);
};
const TOKEN_DAYS = 14; // pilot: one sign-in lasts two weeks

export async function issueToken(user: { id: number; role: Role; full_name: string | null }, sid: string) {
  return await new SignJWT({ userId: user.id, role: user.role, name: user.full_name ?? "", sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setIssuer("inrange-api")
    .setExpirationTime(`${TOKEN_DAYS}d`)
    .sign(key());
}

export async function optionalUser(c: Context): Promise<AuthUser | null> {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: "inrange-api", algorithms: ["HS256"] });
    const [row] = await sql`
      select u.id, u.role, u.mobile, u.full_name, u.desks from auth_sessions s join users u on u.id = s.user_id
      where s.id = ${String(payload.sid)} and s.revoked_at is null and u.id = ${Number(payload.sub)}
        -- staff sessions last one working day; patients keep the token's two weeks
        and (u.role = 'PATIENT' or s.created_at > now() - interval '12 hours')`;
    if (!row) return null;
    return { id: row.id, role: row.role, mobile: row.mobile, fullName: row.full_name, sid: String(payload.sid),
      desks: row.role === "OPS" ? (row.desks ?? []) : [] };
  } catch {
    return null;
  }
}

export async function requireUser(c: Context, ...roles: Role[]): Promise<AuthUser> {
  const user = await optionalUser(c);
  if (!user) return fail(401, "Your session has ended. Please sign in again.", "NOT_AUTHORISED");
  if (roles.length && !roles.includes(user.role) && user.role !== "ADMIN")
    return fail(403, "You do not have access to this.");
  // someone taken off the operations team (no desks left) can still sign in, and reaches nothing
  if (user.role === "OPS" && !user.desks.length) return fail(403, "You do not have access to this.");
  return user;
}

/** An admin, or someone on the operations team who works one of these desks. */
export async function requireDesk(c: Context, ...desks: Desk[]): Promise<AuthUser> {
  const me = await requireUser(c, "OPS");
  if (me.role !== "ADMIN" && !desks.some((d) => me.desks.includes(d))) return fail(403, "You do not have access to this.");
  return me;
}
/** Whether this person may do a desk's work. */
export const works = (me: AuthUser, desk: Desk) => me.role === "ADMIN" || (me.role === "OPS" && me.desks.includes(desk));

export const requirePatient = (c: Context) => requireUser(c, "PATIENT");
export const requireDoctor = (c: Context) => requireUser(c, "DOCTOR");
