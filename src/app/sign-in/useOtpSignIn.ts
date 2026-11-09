"use client";

/**
 * The mobile OTP sign-in state: the number, the code, the resend countdown and the SMS listener
 * (POST /api/auth/send-otp, POST /api/auth/verify-otp via authService). On success the session is
 * saved and the person goes to onboarding (a new patient), else to `next` when it is a page of
 * their own dashboard (lib/navigation/signInReturn), else to their dashboard's home.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isValidMobile } from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import { pathAfterSignIn } from "@/lib/navigation/signInReturn";
import { homePathFor, saveSession } from "@/lib/session/authSession";
import { sendOtp, verifyOtp } from "@/services/authService";

type Stage = "phone" | "code";

const RESEND_AFTER_MS = 30_000;

export function useOtpSignIn(next: string | null) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("phone");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [pilotHint, setPilotHint] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [verified, setVerified] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const phoneRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const smsListener = useRef<AbortController | null>(null);

  const resendInSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));

  // the resend countdown, one tick a second while it runs
  useEffect(() => {
    if (stage !== "code" || resendInSeconds <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [stage, resendInSeconds]);

  const submitCode = useCallback(
    async (value: string) => {
      if (busy || verified) return;
      smsListener.current?.abort();
      setBusy(true);
      setCodeError(null);
      try {
        const result = await verifyOtp(digits, value);
        const user = saveSession({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          mobile: digits,
          user: result.user,
        });
        setVerified(true);
        const destination =
          user.role === "PATIENT" && result.nextScreen === "ONBOARDING"
            ? "/onboarding"
            : pathAfterSignIn(next, homePathFor(user.role));
        // let the tick land before the page changes; replace, so Back from the account skips sign-in
        setTimeout(() => router.replace(destination), 520);
      } catch (error) {
        setBusy(false);
        setCode("");
        setShake((count) => count + 1);
        setCodeError(errorMessage(error));
        codeRef.current?.focus();
      }
    },
    [busy, verified, digits, router, next],
  );

  // Android Chrome can read the code straight from the SMS (WebOTP); elsewhere the keyboard offers
  // it through autocomplete="one-time-code"
  const listenForSms = () => {
    if (!("OTPCredential" in window)) return;
    smsListener.current?.abort();
    const controller = new AbortController();
    smsListener.current = controller;
    (
      navigator.credentials.get as (
        options: unknown,
      ) => Promise<{ code?: string } | null>
    )({ otp: { transport: ["sms"] }, signal: controller.signal })
      .then((otp) => {
        if (otp?.code) {
          setCode(otp.code);
          submitCode(otp.code);
        }
      })
      .catch(() => undefined);
  };

  const send = async (again = false) => {
    if (busy) return;
    if (!isValidMobile(digits)) {
      setPhoneError("Enter the 10-digit number, without the 0 or +91.");
      phoneRef.current?.focus();
      return;
    }
    setBusy(true);
    setPhoneError(null);
    try {
      setPilotHint(await sendOtp(digits));
    } catch (error) {
      setBusy(false);
      if (again) setCodeError(errorMessage(error));
      else setPhoneError(errorMessage(error));
      return;
    }
    setBusy(false);
    const sentAt = Date.now();
    setNow(sentAt);
    setResendAt(sentAt + RESEND_AFTER_MS);
    setCode("");
    setCodeError(null);
    if (!again) {
      setDirection(1);
      setStage("code");
    }
    listenForSms();
  };

  const backToPhone = () => {
    smsListener.current?.abort();
    setDirection(-1);
    setStage("phone");
    setCode("");
    setCodeError(null);
  };

  // focus follows the stage, after the new panel has arrived
  useEffect(() => {
    const timer = setTimeout(
      () =>
        (stage === "phone" ? phoneRef : codeRef).current?.focus({
          preventScroll: true,
        }),
      60,
    );
    return () => clearTimeout(timer);
  }, [stage]);

  useEffect(() => () => smsListener.current?.abort(), []);

  return {
    stage,
    direction,
    digits,
    busy,
    phoneError,
    code,
    codeError,
    pilotHint,
    shake,
    verified,
    resendInSeconds,
    phoneRef,
    codeRef,
    changeDigits: (value: string) => {
      setDigits(value);
      setPhoneError(null);
    },
    changeCode: (value: string) => {
      setCode(value);
      setCodeError(null);
    },
    send,
    submitCode,
    backToPhone,
  };
}
