"use client";

/**
 * Sign in (and create an account, which is the same flow: the OTP creates it) by mobile OTP.
 * Phone, then code; the code submits itself at the sixth digit (the state and calls are in
 * useOtpSignIn). Someone already signed in goes straight to their account. The top bar's
 * X (and the wordmark) go back to the website; on the code step its arrow goes back to the number.
 */

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, X } from "@phosphor-icons/react";
import Wordmark from "@/components/ui/Wordmark";
import ContourField from "@/components/ui/ContourField";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import { pathAfterSignIn } from "@/lib/navigation/signInReturn";
import {
  clearSession,
  getSessionUser,
  homePathFor,
} from "@/lib/session/authSession";
import { useOtpSignIn } from "../useOtpSignIn";
import CodeStep from "./CodeStep";
import PhoneStep from "./PhoneStep";
import styles from "../SignInPage.module.css";

export default function SignInFlow({
  creating,
  signedOut,
  next,
}: {
  creating: boolean;
  signedOut: boolean;
  next: string | null;
}) {
  const router = useRouter();
  const signIn = useOtpSignIn(next);
  const { stage } = signIn;

  // ?out=1 ends the session on this device; otherwise someone already signed in goes straight to their account
  useEffect(() => {
    if (signedOut) {
      clearSession();
      return;
    }
    const user = getSessionUser();
    if (user) router.replace(pathAfterSignIn(next, homePathFor(user.role)));
  }, [router, signedOut, next]);

  return (
    <main className={styles.page}>
      <section className={styles.box} aria-labelledby="sign-in-title">
        <ContourField
          className={styles.field}
          density={10}
          lineAlpha={0.13}
          signalAlpha={0.42}
          seed={11}
        />
        <header className={styles.top}>
          {stage === "code" ? (
            <button
              type="button"
              className={`${formStyles.round} ${styles.roundDark}`}
              onClick={signIn.backToPhone}
              aria-label="Change number"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <span className={styles.slot} aria-hidden="true" />
          )}
          <Link href="/" className={styles.brand} aria-label="InRange home">
            <Wordmark height={34} />
          </Link>
          <Link
            href="/"
            className={`${formStyles.round} ${styles.roundDark}`}
            aria-label="Back to the website"
          >
            <X size={18} />
          </Link>
        </header>

        {stage === "phone" ? (
          <PhoneStep
            key="phone"
            creating={creating}
            signedOut={signedOut}
            direction={signIn.direction}
            digits={signIn.digits}
            error={signIn.phoneError}
            busy={signIn.busy}
            inputRef={signIn.phoneRef}
            onDigits={signIn.changeDigits}
            onSubmit={() => signIn.send()}
          />
        ) : (
          <CodeStep
            key="code"
            direction={signIn.direction}
            digits={signIn.digits}
            code={signIn.code}
            error={signIn.codeError}
            pilotHint={signIn.pilotHint}
            shake={signIn.shake}
            busy={signIn.busy}
            verified={signIn.verified}
            resendInSeconds={signIn.resendInSeconds}
            inputRef={signIn.codeRef}
            onCode={signIn.changeCode}
            onSubmit={signIn.submitCode}
            onEditNumber={signIn.backToPhone}
            onResend={() => signIn.send(true)}
          />
        )}
      </section>

      {/* under the box, in the page's flow, so it can never cover the wordmark or the form */}
      <div className={styles.below}>
        {stage === "phone" && (
          <footer className={styles.foot}>
            <p className={`${formStyles.hint} ${styles.footLinks}`}>
              <span>
                Trouble signing in?{" "}
                <a href="mailto:care@inrange.in">care@inrange.in</a>
              </span>
            </p>
          </footer>
        )}
      </div>
    </main>
  );
}
