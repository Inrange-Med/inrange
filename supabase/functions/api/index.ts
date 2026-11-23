// inrange pilot API: one edge function serving every /api/... route the web app calls.
// Base URL for the app: https://<ref>.supabase.co/functions/v1  (the function is named "api",
// so a request to /functions/v1/api/auth/me reaches this router as /api/auth/me).
import { Hono } from "hono";
import { cors } from "hono/cors";
import { body, fail, HttpError, ok } from "./lib/http.ts";
import { sql, withDb } from "./lib/db.ts";
import { live } from "./lib/env.ts";
import { auth } from "./routes/auth.ts";
import { patientRoutes } from "./routes/patient.ts";
import { careRoutes } from "./routes/care.ts";
import { labRoutes } from "./routes/labs.ts";
import { paymentRoutes } from "./routes/payments.ts";
import { doctorRoutes } from "./routes/doctor.ts";
import { availabilityRoutes } from "./routes/availability.ts";
import { adminRoutes } from "./routes/admin.ts";
import { fileRoutes } from "./routes/files.ts";
import { jobRoutes } from "./routes/jobs.ts";
import { medicineRoutes } from "./routes/medicines.ts";
import { opsRoutes } from "./routes/ops.ts";
import { consultationRoutes } from "./routes/consultations.ts";
import { homeRoutes } from "./routes/home.ts";
import { salesRoutes } from "./routes/sales.ts";
import { coachRoutes } from "./routes/coach.ts";
import { adminSalesRoutes } from "./routes/adminSales.ts";
import { adminLabRoutes } from "./routes/adminLabs.ts";

// A database socket closing after a response can raise an error nobody awaits; in Deno that kills the
// worker and the gateway keeps routing requests to it until it times out. Log it instead of dying.
addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  console.error("unhandled rejection", event.reason);
});
addEventListener("error", (event) => {
  event.preventDefault();
  console.error("uncaught error", event.error);
});

const app = new Hono();

app.use("*", cors({ origin: (o) => o ?? "*", allowHeaders: ["Authorization", "Content-Type", "Accept", "x-region"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], maxAge: 86400 }));


// every request gets its own database client, closed when the response is ready
app.use("/api/*", (_c, next) => withDb(() => next()));

// the coming-soon programmes' waitlist (src/components/landing/Waitlist.tsx): public, the form's fields only
app.post("/api/waitlist", async (c) => {
  const w = await body<{ programme?: string; name?: string; mobile?: string; city?: string; consent?: boolean }>(c);
  const name = String(w.name ?? "").trim().slice(0, 80);
  const city = String(w.city ?? "").trim().slice(0, 80);
  const mobile = String(w.mobile ?? "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  if (w.programme !== "pcos" && w.programme !== "sexual") fail(400, "That programme has no waitlist.");
  if (name.length < 2 || city.length < 2) fail(400, "Add your name and city.");
  if (!/^[6-9]\d{9}$/.test(mobile)) fail(400, "Enter a 10-digit mobile number.");
  if (w.consent !== true) fail(400, "Tick the consent box to join.");
  await sql`insert into waitlist (programme, name, mobile, city, consented_at)
            values (${w.programme!}, ${name}, ${mobile}, ${city}, now()) on conflict (programme, mobile) do nothing`;
  return ok(c, null, "You are on the waitlist");
});

app.get("/api/health", (c) => c.json({
  success: true,
  data: { ok: true, integrations: Object.fromEntries(Object.entries(live).map(([k, f]) => [k, f() ? "live" : "mock"])) },
}));

app.route("/api/auth", auth);
app.route("/api", patientRoutes);
app.route("/api", careRoutes);
app.route("/api", labRoutes);
app.route("/api", paymentRoutes);
app.route("/api", consultationRoutes); // before doctorRoutes: /doctor/consultations/history ahead of any /doctor/:x
app.route("/api", doctorRoutes);
app.route("/api", availabilityRoutes);
app.route("/api", adminRoutes);
app.route("/api", fileRoutes);
app.route("/api", jobRoutes);
app.route("/api", medicineRoutes);
app.route("/api", opsRoutes);
app.route("/api", homeRoutes);
app.route("/api", salesRoutes);
app.route("/api", coachRoutes);
app.route("/api", adminSalesRoutes);
app.route("/api", adminLabRoutes);

app.notFound((c) => c.json({ success: false, message: "This feature is not available yet." }, 404));
app.onError((err, c) => {
  if (err instanceof HttpError)
    return c.json({ success: false, message: err.message, error: err.code ?? undefined }, err.status);
  console.error(err);
  return c.json({ success: false, message: "Something went wrong on our side. Please try again." }, 500);
});

Deno.serve(app.fetch);
