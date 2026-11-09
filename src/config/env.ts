/**
 * Public environment configuration: the ONLY file that reads process.env, except the server-only
 * Redcliffe client in src/server/ (it reads its own secrets). Every variable is in `.env.example`.
 *   NEXT_PUBLIC_API_BASE_URL     InRange API (the Supabase edge function base, .../functions/v1)
 *   NEXT_PUBLIC_FIREBASE_*       the Firebase web app for phone sign-in (public by design; see lib/auth/firebasePhone.ts)
 * The frontend runs on port 3001 (`npm run dev`).
 */

const DEFAULT_API_BASE_URL =
  "https://wcsglsrjixfrobujchen.supabase.co/functions/v1";

const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, "");

export const API_BASE_URL = withoutTrailingSlash(
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
);

/**
 * Firebase's web app settings for phone sign-in. These identify the app to Firebase and are public by
 * design (Firebase's own docs); what protects sign-in is reCAPTCHA, the SMS region policy and the
 * authorised domains on the Firebase project. Unset: sign-in uses the API's own codes.
 */
export const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};
