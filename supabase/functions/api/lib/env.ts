// Every setting the function reads. Vendor integrations are "live" only when their keys are set as
// function secrets (`supabase secrets set ...`); otherwise they run in mock mode. Nothing else to switch.
const get = (name: string) => Deno.env.get(name)?.trim() || "";

export const env = {
  // the transaction pooler (port 6543) survives idle edge workers; the direct URL is a fallback
  dbUrl: get("DB_POOLER_URL") || get("SUPABASE_DB_URL"),
  supabaseUrl: get("SUPABASE_URL"),
  serviceRoleKey: get("SUPABASE_SERVICE_ROLE_KEY"),
  jwtSecret: get("APP_JWT_SECRET"),
  /** The web app's origin, used for links the API hands out (e.g. the mock video room). */
  appUrl: get("APP_URL") || "http://localhost:3001",
  /** Pilot: the code every number accepts while no SMS provider is configured. */
  pilotOtp: get("PILOT_OTP") || "123456",

  /** Firebase phone sign-in: the Firebase project whose ID tokens are accepted (POST /api/auth/firebase). */
  firebaseProjectId: get("FIREBASE_PROJECT_ID"),
  /**
   * Numbers that keep the code flow (PILOT_OTP while no SMS provider is set) when Firebase is on:
   * the payment gateway's reviewer account. Comma-separated 10-digit numbers.
   */
  reviewerMobiles: get("REVIEWER_MOBILES").split(",").map((m) => m.trim()).filter(Boolean),

  msg91AuthKey: get("MSG91_AUTH_KEY"),
  msg91TemplateId: get("MSG91_TEMPLATE_ID"),

  razorpayKeyId: get("RAZORPAY_KEY_ID"),
  razorpayKeySecret: get("RAZORPAY_KEY_SECRET"),
  razorpayWebhookSecret: get("RAZORPAY_WEBHOOK_SECRET"),

  redcliffeBaseUrl: get("REDCLIFFE_BASE_URL") || "https://apiqa.redcliffelabs.com",
  redcliffeApiKey: get("REDCLIFFE_API_KEY"),
  redcliffeWebhookSecret: get("REDCLIFFE_WEBHOOK_SECRET"),
  /** Dry runs: admins may walk a paid lab booking to a placeholder report (POST /admin/lab-bookings/:id/simulate). Unset at launch. */
  pilotLabSimulation: get("PILOT_LAB_SIMULATION") === "1",

  hmsAccessKey: get("HMS_ACCESS_KEY"),
  hmsSecret: get("HMS_SECRET"),
  hmsTemplateId: get("HMS_TEMPLATE_ID"),
  hmsSubdomain: get("HMS_SUBDOMAIN"),
};

export const live = {
  firebase: () => Boolean(env.firebaseProjectId),
  sms: () => Boolean(env.msg91AuthKey && env.msg91TemplateId),
  razorpay: () => Boolean(env.razorpayKeyId && env.razorpayKeySecret),
  redcliffe: () => Boolean(env.redcliffeApiKey),
  hms: () => Boolean(env.hmsAccessKey && env.hmsSecret && env.hmsTemplateId && env.hmsSubdomain),
};
