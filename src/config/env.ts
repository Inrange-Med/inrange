/**
 * Public environment configuration: the ONLY file that reads process.env, except the server-only
 * Redcliffe client in src/server/ (it reads its own secrets). Every variable is in `.env.example`.
 *   NEXT_PUBLIC_API_BASE_URL     InRange API (the Supabase edge function base, .../functions/v1)
 * The frontend runs on port 3001 (`npm run dev`).
 */

const DEFAULT_API_BASE_URL =
  "https://wcsglsrjixfrobujchen.supabase.co/functions/v1";

const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, "");

export const API_BASE_URL = withoutTrailingSlash(
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
);

/** Used by the landing page's sign-in modal (src/components/landing/Nav.tsx). New code uses src/services/authService.ts. */
export const AUTH_ENDPOINTS = {
  SEND_OTP: `${API_BASE_URL}/api/auth/send-otp`,
  VERIFY_OTP: `${API_BASE_URL}/api/auth/verify-otp`,
} as const;
