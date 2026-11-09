/**
 * Sign-in by mobile OTP, for both sign-in screens (/sign-in and the landing page's modal).
 *   POST /api/auth/send-otp     { mobile } -> { message, data: { provider, mock } }
 *                               provider "firebase": Firebase texts the code (lib/auth/firebasePhone.ts);
 *                               provider "api": the API sent it (mock: pilot, the message names the code)
 *   POST /api/auth/verify-otp   checks an API code { mobile, otp } -> { data: { accessToken, refreshToken, user, nextScreen } }
 *   POST /api/auth/firebase     trades Firebase's ID token { idToken } -> the same
 *   POST /api/auth/logout       ends the session
 */

import { apiRequest } from "@/lib/http/apiClient";
import {
  confirmFirebaseCode,
  sendFirebaseCode,
} from "@/lib/auth/firebasePhone";
import type { NextScreen, SignInResult } from "@/types/auth";

type VerifyOtpResponse = {
  data?: {
    accessToken?: string;
    refreshToken?: string;
    user?: SignInResult["user"];
    nextScreen?: string;
  };
  accessToken?: string;
  refreshToken?: string;
  user?: SignInResult["user"];
  nextScreen?: string;
};

/** Sends the code. Returns the pilot hint ("Pilot mode: enter ...") when no SMS is sent, else null. */
export async function sendOtp(mobile: string): Promise<string | null> {
  const body = await apiRequest<{
    message?: string;
    data?: { mock?: boolean; provider?: string };
  }>("/api/auth/send-otp", {
    method: "POST",
    body: { mobile },
    authenticated: false,
  });
  if (body?.data?.provider === "firebase") {
    await sendFirebaseCode(mobile);
    return null;
  }
  return body?.data?.mock ? (body.message ?? null) : null;
}

export async function verifyOtp(
  mobile: string,
  otp: string,
): Promise<SignInResult> {
  const idToken = await confirmFirebaseCode(mobile, otp);
  const body = await apiRequest<VerifyOtpResponse>(
    idToken ? "/api/auth/firebase" : "/api/auth/verify-otp",
    {
      method: "POST",
      body: idToken ? { idToken } : { mobile, otp },
      authenticated: false,
    },
  );
  const accessToken = body.data?.accessToken ?? body.accessToken;
  if (!accessToken)
    throw new Error(
      "Sign-in worked, but the server did not return a session. Please try again.",
    );
  const nextScreen: NextScreen =
    String(body.data?.nextScreen ?? body.nextScreen ?? "").toUpperCase() ===
    "ONBOARDING"
      ? "ONBOARDING"
      : "DASHBOARD";
  return {
    accessToken,
    refreshToken: body.data?.refreshToken ?? body.refreshToken ?? null,
    nextScreen,
    user: body.data?.user ?? body.user ?? null,
  };
}

export async function logout(): Promise<void> {
  await apiRequest("/api/auth/logout", { method: "POST" });
}
