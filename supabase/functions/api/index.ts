// InRange pilot API: one edge function serving every /api/... route the web app calls.
// Base URL for the app: https://<ref>.supabase.co/functions/v1  (the function is named "api",
// so a request to /functions/v1/api/auth/me reaches this router as /api/auth/me).
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HttpError } from "./lib/http.ts";
import { withDb } from "./lib/db.ts";
import { live } from "./lib/env.ts";
import { auth } from "./routes/auth.ts";
import { patientRoutes } from "./routes/patient.ts";
import { careRoutes } from "./routes/care.ts";
import { labRoutes } from "./routes/labs.ts";
import { paymentRoutes } from "./routes/payments.ts";
import { doctorRoutes } from "./routes/doctor.ts";

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

app.get("/api/health", (c) => c.json({
  success: true,
  data: { ok: true, integrations: Object.fromEntries(Object.entries(live).map(([k, f]) => [k, f() ? "live" : "mock"])) },
}));

app.route("/api/auth", auth);
app.route("/api", patientRoutes);
app.route("/api", careRoutes);
app.route("/api", labRoutes);
app.route("/api", paymentRoutes);
app.route("/api", doctorRoutes);

app.notFound((c) => c.json({ success: false, message: "This feature is not available yet." }, 404));
app.onError((err, c) => {
  if (err instanceof HttpError)
    return c.json({ success: false, message: err.message, error: err.code ?? undefined }, err.status);
  console.error(err);
  return c.json({ success: false, message: "Something went wrong on our side. Please try again." }, 500);
});

Deno.serve(app.fetch);
