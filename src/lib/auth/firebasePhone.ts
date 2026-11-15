/**
 * Firebase phone sign-in (https://firebase.google.com/docs/auth/web/phone-auth), used when the API's
 * send-otp answers provider "firebase". Firebase texts the code after an invisible reCAPTCHA check;
 * confirming it gives a Firebase ID token, which the API trades for an inrange session
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

async function loadFirebaseAuth() {
  const [{ getApps, initializeApp }, firebaseAuthModule] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
  ]);
  const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
  const auth = firebaseAuthModule.getAuth(app);
  auth.languageCode = "en";
  return { auth, ...firebaseAuthModule };
}

/** One load per page: the SDK and its setup are shared by every send. A failed load can be retried. */
let loading: ReturnType<typeof loadFirebaseAuth> | null = null;
function firebaseAuth() {
  loading ??= loadFirebaseAuth().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** The hosts the invisible reCAPTCHA check and Firebase's phone sign-in call, connected to early. */
const HOSTS = [
  "https://www.google.com",
  "https://www.gstatic.com",
  "https://identitytoolkit.googleapis.com",
];

/**
 * Starts the slow parts of a Firebase send before the person asks for a code (client call, 12 Nov
 * 2026: "the code comes very slowly"): the SDK download and setup, and connections to the hosts the
 * security check uses. Safe to call often; it does nothing without a Firebase key, on the server, or
 * a second time. The text message itself is Firebase's and the network's.
 */
export function warmFirebaseSignIn(): void {
  if (typeof window === "undefined" || !FIREBASE_CONFIG.apiKey) return;
  for (const href of HOSTS) {
    if (document.head.querySelector(`link[rel="preconnect"][href="${href}"]`))
      continue;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
  void firebaseAuth().catch(() => undefined);
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
        // the inrange session is the one that matters; Firebase keeps none in this browser
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
