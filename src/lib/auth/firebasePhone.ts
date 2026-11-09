/**
 * Firebase phone sign-in (https://firebase.google.com/docs/auth/web/phone-auth), used when the API's
 * send-otp answers provider "firebase". Firebase texts the code after an invisible reCAPTCHA check;
 * confirming it gives a Firebase ID token, which the API trades for an InRange session
 * (POST /api/auth/firebase). The Firebase SDK loads only here, on first use.
 */

import { FIREBASE_CONFIG } from "@/config/env";

/** The code sent for this number, waiting to be confirmed (one at a time, as on screen). */
let pending: {
  mobile: string;
  confirm: (code: string) => Promise<string>;
} | null = null;

const MESSAGES: Record<string, string> = {
  "auth/invalid-phone-number": "Enter a valid 10-digit Indian mobile number.",
  "auth/too-many-requests":
    "Too many tries from this device. Wait a while, then ask for a new code.",
  "auth/quota-exceeded":
    "We cannot send codes right now. Please try again in a few minutes.",
  "auth/captcha-check-failed": "The security check failed. Please try again.",
  "auth/invalid-app-credential": "The security check failed. Please try again.",
  "auth/invalid-verification-code":
    "That code is not right. Check it and try again.",
  "auth/code-expired": "That code has expired. Ask for a new one.",
  "auth/network-request-failed":
    "No connection. Check your internet and try again.",
};

function friendly(error: unknown, fallback: string): Error {
  const code = (error as { code?: string } | null)?.code ?? "";
  return new Error(MESSAGES[code] ?? fallback);
}

async function firebaseAuth() {
  const [{ getApps, initializeApp }, firebaseAuthModule] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
  ]);
  const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
  const auth = firebaseAuthModule.getAuth(app);
  auth.languageCode = "en";
  return { auth, ...firebaseAuthModule };
}

/** Has Firebase text a 6-digit code to +91 `mobile`. */
export async function sendFirebaseCode(mobile: string): Promise<void> {
  if (!FIREBASE_CONFIG.apiKey)
    throw new Error(
      "Sign-in is not available right now. Please try again later.",
    );
  const { auth, RecaptchaVerifier, signInWithPhoneNumber, signOut } =
    await firebaseAuth();
  // a fresh invisible check per send: reCAPTCHA tokens are single use
  const holder = document.createElement("div");
  document.body.appendChild(holder);
  const verifier = new RecaptchaVerifier(auth, holder, { size: "invisible" });
  try {
    const sent = await signInWithPhoneNumber(auth, `+91${mobile}`, verifier);
    pending = {
      mobile,
      confirm: async (code) => {
        const { user } = await sent.confirm(code);
        const idToken = await user.getIdToken();
        // the InRange session is the one that matters; Firebase keeps none in this browser
        await signOut(auth).catch(() => undefined);
        return idToken;
      },
    };
  } catch (error) {
    throw friendly(error, "We could not send the code. Please try again.");
  } finally {
    verifier.clear();
    holder.remove();
  }
}

/** Firebase's ID token for the code sent to `mobile`, or null when no Firebase code is waiting for it. */
export async function confirmFirebaseCode(
  mobile: string,
  code: string,
): Promise<string | null> {
  if (pending?.mobile !== mobile) return null;
  try {
    const idToken = await pending.confirm(code);
    pending = null;
    return idToken;
  } catch (error) {
    throw friendly(error, "That code did not work. Ask for a new one.");
  }
}
