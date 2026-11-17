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
  /**
   * Test accounts for end-to-end runs (15 Nov 2026): these numbers sign in with TEST_OTP, never by SMS or
   * Firebase. Comma-separated; an entry ending in * is a prefix ("98000*", the test patients). Both must be
   * set; unset them (or drop the pilot doctors) before live patients use the doctors listed here.
   */
  testMobiles: get("TEST_MOBILES").split(",").map((m) => m.trim()).filter(Boolean),
  testOtp: /^\d{6}$/.test(get("TEST_OTP")) ? get("TEST_OTP") : "",

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

  /** WhatsApp (Meta Cloud API): the system user's token and the business number's id (docs/backend/medicine-flow.md). */
  whatsappToken: get("WHATSAPP_TOKEN"),
  whatsappPhoneNumberId: get("WHATSAPP_PHONE_NUMBER_ID"),
  /** signs Meta's webhook calls (X-Hub-Signature-256) */
  whatsappAppSecret: get("WHATSAPP_APP_SECRET"),
  /** the word Meta echoes back when the webhook is registered */
  whatsappVerifyToken: get("WHATSAPP_VERIFY_TOKEN"),
  /** the WhatsApp Business Account that owns the templates (POST /admin/whatsapp/templates/sync) */
  whatsappBusinessAccountId: get("WHATSAPP_BUSINESS_ACCOUNT_ID"),
  /** POST /api/jobs/tick needs it in x-jobs-secret (Supabase cron sends it); unset, the tick refuses */
  jobsSecret: get("JOBS_SECRET"),
};

/** A test account (testMobiles): signs in with TEST_OTP, and is never sent a real WhatsApp message. */
export const isTestMobile = (mobile: string) =>
  Boolean(env.testOtp) && env.testMobiles.some((m) => (m.endsWith("*") ? mobile.startsWith(m.slice(0, -1)) : m === mobile));

export const live = {
  firebase: () => Boolean(env.firebaseProjectId),
  sms: () => Boolean(env.msg91AuthKey && env.msg91TemplateId),
  razorpay: () => Boolean(env.razorpayKeyId && env.razorpayKeySecret),
  redcliffe: () => Boolean(env.redcliffeApiKey),
  hms: () => Boolean(env.hmsAccessKey && env.hmsSecret && env.hmsTemplateId && env.hmsSubdomain),
  // the app secret too: without it every webhook (replies, STOP) would be refused while messages go out
  whatsapp: () => Boolean(env.whatsappToken && env.whatsappPhoneNumberId && env.whatsappAppSecret),
};
