// Video rooms through 100ms Prebuilt (https://www.100ms.live/docs/prebuilt/v2/prebuilt/room-codes/room-links).
// LIVE when HMS_ACCESS_KEY, HMS_SECRET, HMS_TEMPLATE_ID and HMS_SUBDOMAIN are set; MOCK otherwise: the web
// app's own pilot room page. One room per appointment, hosted in India (region "in"). The template's roles
// are "doctor" (may end the room and remove others) and "patient"; streaming and transcription are off in the
// template. Recording is started here, per call, only when the patient agreed to it (startRecording); it needs
// "Composite recording" switched on in the template (dashboard, Templates, Recordings). The secret and management
// tokens never leave this function.
import { SignJWT } from "jose";
import { env, live } from "../lib/env.ts";

export type CallRole = "doctor" | "patient";
export const hmsLive = live.hms;
const API = "https://api.100ms.live/v2";

// https://www.100ms.live/docs/server-side/v2/foundation/authentication-and-tokens
async function managementToken() {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ access_key: env.hmsAccessKey, type: "management", version: 2 })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now).setNotBefore(now).setExpirationTime(now + 600).setJti(crypto.randomUUID())
    .sign(new TextEncoder().encode(env.hmsSecret));
}

/** GET without a body, POST with one. */
async function hms(path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${await managementToken()}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`100ms ${path}: ${out.message ?? res.status}`);
  return out;
}

/** A new room for an appointment, in India. No patient details go into its name. */
export async function createRoom(appointmentId: number): Promise<string> {
  const room = await hms("/rooms", { name: `inrange-${appointmentId}-${Date.now()}`, template_id: env.hmsTemplateId, region: "in" });
  return room.id;
}

/**
 * One participant's Prebuilt link: the room code for their role (minted once per room, then reused),
 * their display name and our user id (so 100ms's session logs say who joined).
 * ponytail: room codes do not expire, so a link works until the doctor ends the call (endRoom locks the
 * room). Short-lived auth tokens need 100ms's React Prebuilt, which does not support React 19 yet.
 */
export async function joinLink(roomId: string, role: CallRole, name: string, userId: number) {
  type Code = { code: string; role: string; enabled: boolean };
  let codes: Code[] = (await hms(`/room-codes/room/${roomId}`)).data ?? [];
  if (!codes.length) codes = (await hms(`/room-codes/room/${roomId}`, {})).data ?? [];
  const code = codes.find((c) => c.role === role && c.enabled)?.code;
  if (!code) throw new Error(`100ms room ${roomId} has no enabled code for role "${role}"`);
  // ponytail: 100ms shows its own preview after our camera check (two Join buttons); skip_preview would join with the
  // camera and microphone off, which is worse. Fix in the 100ms template or drop our check (19 Nov 2026).
  const q = new URLSearchParams({ name, userId: String(userId) });
  // HMS_SUBDOMAIN may be "inrange" or the full "inrange.app.100ms.live"
  const sub = env.hmsSubdomain.replace(/^https?:\/\//, "").replace(/\.app\.100ms\.live\/?$/, "");
  return `https://${sub}.app.100ms.live/meeting/${code}?${q}`;
}

export function mockJoinLink(appointmentId: number, role: CallRole, name: string) {
  const q = new URLSearchParams({ room: `inrange-${appointmentId}`, role, name });
  return `${env.appUrl}/pilot-video-room.html?${q}`;
}

/**
 * Ends the call for everyone and locks the room, so its links stop working (best effort).
 * end-room acts on a running session; disabling also covers a room nobody is in.
 */
export async function endRoom(roomId: string | null) {
  if (!hmsLive() || !roomId) return;
  await hms(`/active-rooms/${roomId}/end-room`, { reason: "The consultation has ended.", lock: true }).catch(() => {});
  await hms(`/rooms/${roomId}`, { enabled: false }).catch((e) => console.error(e));
}

/**
 * Starts recording the room (browser composite: one MP4 of the call as the people in it see it). Asked for only when
 * the patient agreed to it for this call. https://www.100ms.live/docs/server-side/v2/api-reference/recordings/start-recording-for-room
 */
export async function startRecording(roomId: string): Promise<string> {
  const rec = await hms(`/recordings/room/${roomId}/start`, {});
  return String(rec.id);
}

/** Stops every recording running in the room (the patient changed their mind). */
export async function stopRecording(roomId: string) {
  await hms(`/recordings/room/${roomId}/stop`, {});
}

/**
 * A link to watch the room's latest finished recording, good for an hour; null while there is none yet (100ms
 * finishes the file a few minutes after the call). Without our own storage bucket 100ms keeps a recording 15 days.
 */
export async function recordingLink(roomId: string): Promise<string | null> {
  type Asset = { id: string; type: string; status: string; created_at: string };
  const assets: Asset[] = (await hms(`/recording-assets?room_id=${roomId}&status=completed`)).data ?? [];
  const latest = assets.filter((a) => a.type === "room-composite").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!latest) return null;
  return (await hms(`/recording-assets/${latest.id}/presigned-url?presign_duration=3600`)).url ?? null;
}
