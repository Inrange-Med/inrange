// Every stored file reaches the browser through here. The API checks who is asking, then streams the
// file itself: no storage link ever leaves the server, so there is nothing to forward or reuse.
// Mounted at /api. Someone not allowed gets the same 404 as a file that does not exist.
//   GET /files/reports/:id          a report: the patient, a doctor treating them, or an admin
//   GET /files/lab-bookings/:id     a booking's lab report: the same people
//   GET /files/prescriptions/:id    a signed prescription: the patient or a doctor treating them
//   GET /files/photos/:id/:pose     front | side progress photo: the patient, or a treating doctor while shared
// A doctor or admin opening a patient's file is written to audit_log.
import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "../lib/db.ts";
import { fail, intParam } from "../lib/http.ts";
import { requireUser } from "../lib/auth.ts";
import type { AuthUser } from "../lib/auth.ts";
import { downloadFile } from "../lib/storage.ts";
import { treatedIds } from "./doctor.ts";

export const fileRoutes = new Hono();

const missing = (): never => fail(404, "This file is not available.");

/** The patient themself, a doctor treating them, or (when `admins`) an admin; anyone else is refused. */
async function mayOpen(me: AuthUser, patientId: number, admins: boolean) {
  if (me.id === patientId) return;
  if (me.role === "ADMIN" && admins) return;
  if (me.role === "DOCTOR") {
    const [row] = await sql`select 1 from (${treatedIds(me.id)}) t where t.patient_id = ${patientId}`;
    if (row) return;
  }
  missing();
}

async function send(c: Context, me: AuthUser, patientId: number, what: string, bucket: string, path: string | null, type: string) {
  if (!path) return missing();
  const file = await downloadFile(bucket, path);
  if (!file) return missing();
  if (me.id !== patientId) await sql`insert into audit_log (patient_id, actor_id, action) values (${patientId}, ${me.id}, ${`Opened ${what}`})`;
  const ext = type === "application/pdf" ? "pdf" : type === "image/png" ? "png" : "jpg";
  return c.body(file.body!, 200, {
    "Content-Type": type,
    "Content-Disposition": `inline; filename="${what.replace(/[^a-z0-9]+/gi, "-")}.${ext}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    // opened directly, a file can run nothing and load nothing
    "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
  });
}

// only these types are ever served, whatever a row says
const SAFE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);
const typeOf = (mime: unknown) => (SAFE_TYPES.has(String(mime)) ? String(mime) : "application/octet-stream");

fileRoutes.get("/files/reports/:id", async (c) => {
  const me = await requireUser(c);
  const id = intParam(c.req.param("id"), "report");
  const [r] = await sql`select user_id, file_path, mime_type from reports where id = ${id}`;
  if (!r) return missing();
  await mayOpen(me, r.user_id, true);
  return send(c, me, r.user_id, `report ${id}`, "reports", r.file_path, typeOf(r.mime_type));
});

fileRoutes.get("/files/lab-bookings/:id", async (c) => {
  const me = await requireUser(c);
  const id = String(c.req.param("id") ?? "").slice(0, 40);
  const [b] = await sql`select user_id, report_path from lab_bookings where id = ${id}`;
  if (!b) return missing();
  await mayOpen(me, b.user_id, true);
  if (!b.report_path) fail(400, "The report is not ready yet.");
  return send(c, me, b.user_id, `lab report ${id}`, "reports", b.report_path, "application/pdf");
});

fileRoutes.get("/files/prescriptions/:id", async (c) => {
  const me = await requireUser(c);
  const id = intParam(c.req.param("id"), "prescription");
  const [p] = await sql`select patient_id, pdf_path from prescriptions where id = ${id} and status = 'SIGNED'`;
  if (!p) return missing();
  await mayOpen(me, p.patient_id, false);
  return send(c, me, p.patient_id, `prescription ${id}`, "prescriptions", p.pdf_path, "application/pdf");
});

fileRoutes.get("/files/photos/:id/:pose", async (c) => {
  const me = await requireUser(c);
  const id = intParam(c.req.param("id"), "photo");
  const pose = c.req.param("pose");
  if (pose !== "front" && pose !== "side") return missing();
  const [ph] = await sql`select patient_id, front_path, side_path, shared_with_doctor from progress_photos where id = ${id}`;
  if (!ph) return missing();
  // a doctor sees photos only while the patient shares them
  if (me.id !== ph.patient_id && !ph.shared_with_doctor) return missing();
  await mayOpen(me, ph.patient_id, false);
  const path = pose === "front" ? ph.front_path : ph.side_path;
  return send(c, me, ph.patient_id, `progress photo ${id} ${pose}`, "photos", path, String(path ?? "").endsWith(".png") ? "image/png" : "image/jpeg");
});
