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
 * ADMIN passes every role check below; each route still decides what an admin may do there.
 */
export type Role = "PATIENT" | "DOCTOR" | "ADMIN" | "COACH" | "SALES";
export type AuthUser = { id: number; role: Role; mobile: string; fullName: string | null; sid: string };

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
      select u.id, u.role, u.mobile, u.full_name from auth_sessions s join users u on u.id = s.user_id
      where s.id = ${String(payload.sid)} and s.revoked_at is null and u.id = ${Number(payload.sub)}
        -- staff sessions last one working day; patients keep the token's two weeks
        and (u.role = 'PATIENT' or s.created_at > now() - interval '12 hours')`;
    if (!row) return null;
    return { id: row.id, role: row.role, mobile: row.mobile, fullName: row.full_name, sid: String(payload.sid) };
  } catch {
    return null;
  }
}

export async function requireUser(c: Context, ...roles: Role[]): Promise<AuthUser> {
  const user = await optionalUser(c);
  if (!user) return fail(401, "Your session has ended. Please sign in again.", "NOT_AUTHORISED");
  if (roles.length && !roles.includes(user.role) && user.role !== "ADMIN")
    return fail(403, "You do not have access to this.");
  return user;
}

export const requirePatient = (c: Context) => requireUser(c, "PATIENT");
export const requireDoctor = (c: Context) => requireUser(c, "DOCTOR");
