"use client";

/*
  The public site's sign-in: mobile number, then the 6-digit code, then the right home (a doctor's
  dashboard, onboarding for a new patient, else the patient dashboard). The flow and its calls are the
  team's (authService, authSession); this file only gives it the site's look.

  It opens three ways: openLogin() from any button, the nav's "Sign in", and any link to ASSESSMENT_URL
  (every "Book consultation" on every public page). Without JavaScript those links still reach /assessment,
  which sends people to the /sign-in page.
*/

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "@phosphor-icons/react";
import { sendOtp, verifyOtp } from "@/services/authService";
import { homePathFor, saveSession } from "@/lib/session/authSession";
import { ASSESSMENT_URL } from "./ui";
import s from "./LoginSheet.module.css";

const OPEN_LOGIN_EVENT = "inrange:open-login";

/** Opens the sign-in sheet from anywhere on the public site. */
export function openLogin() {
  window.dispatchEvent(new Event(OPEN_LOGIN_EVENT));
}

type AuthStep = "mobile" | "otp";

export default function LoginSheet() {
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const mobileRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const reset = () => {
    setAuthStep("mobile");
    setMobile("");
    setOtp("");
    setAuthError("");
    setAuthMessage("");
  };

  const open = useCallback(() => {
    returnTo.current = document.activeElement as HTMLElement | null;
    reset();
    setLoginOpen(true);
  }, []);

  const close = () => {
    if (authLoading) return;
    setLoginOpen(false);
    reset();
    returnTo.current?.focus();
  };

  // openLogin() and every booking link open the sheet
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a");
      // "/assessment", "/assessment/" and "/assessment?plan=4" all count
      const path = (link?.getAttribute("href") ?? "").split(/[?#]/)[0].replace(/\/$/, "");
      if (!link || path !== ASSESSMENT_URL.replace(/\/$/, "")) return;
      event.preventDefault();
      open();
    };
    window.addEventListener(OPEN_LOGIN_EVENT, open);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener(OPEN_LOGIN_EVENT, open);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  // while open: the page behind holds still, Escape closes, Tab stays inside the sheet
  useEffect(() => {
    if (!loginOpen) return;
    const lenis = (window as unknown as { __lenis?: { stop(): void; start(): void } }).__lenis;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    lenis?.stop();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), a[href]"));
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = previous;
      lenis?.start();
      window.removeEventListener("keydown", onKey);
    };
    // close reads the latest authLoading through its own closure on each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginOpen, authLoading]);

  useEffect(() => {
    if (!loginOpen) return;
    const timer = window.setTimeout(() => (authStep === "mobile" ? mobileRef : otpRef).current?.focus(), 100);
    return () => window.clearTimeout(timer);
  }, [loginOpen, authStep]);

  const handleMobileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMobile(event.target.value.replace(/\D/g, "").slice(0, 10));
    if (authError) setAuthError("");
  };

  const handleSendOtp = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setAuthError("");
    setAuthMessage("");
    if (mobile.length !== 10) {
      setAuthError("Please enter a valid 10-digit mobile number.");
      return;
    }
    try {
      setAuthLoading(true);
      const pilotHint = await sendOtp(mobile);
      setAuthStep("otp");
      setAuthMessage(pilotHint || `We sent a 6-digit code to +91 ${mobile}`);
    } catch (error) {
      console.error("Send OTP error:", error);
      setAuthError(error instanceof Error ? error.message : "Unable to send OTP. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (event?: FormEvent<HTMLFormElement>, code: string = otp) => {
    event?.preventDefault();
    setAuthError("");
    setAuthMessage("");
    if (code.length !== 6) {
      setAuthError("Please enter the 6-digit OTP.");
      return;
    }
    try {
      setAuthLoading(true);
      const result = await verifyOtp(mobile, code);
      const sessionUser = saveSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        mobile,
        user: result.user,
      });
      setLoginOpen(false);
      reset();
      if (sessionUser.role === "DOCTOR") router.replace(homePathFor("DOCTOR"));
      else if (String(result.nextScreen).trim().toUpperCase() === "ONBOARDING") router.replace("/onboarding");
      else router.replace(homePathFor("PATIENT"));
    } catch (error) {
      console.error("OTP verification error:", error);
      setAuthError(error instanceof Error ? error.message : "OTP verification failed. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOtpChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(value);
    if (authError) setAuthError("");
    if (value.length === 6 && !authLoading) void handleVerifyOtp(undefined, value);
  };

  const handleResendOtp = async () => {
    setOtp("");
    setAuthError("");
    setAuthMessage("");
    await handleSendOtp();
  };

  const handleBackToMobile = () => {
    if (authLoading) return;
    setAuthStep("mobile");
    setOtp("");
    setAuthError("");
    setAuthMessage("");
  };

  if (!loginOpen) return null;

  return (
    <div
      className={s.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div ref={panelRef} className={s.panel} role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button type="button" className={s.close} aria-label="Close sign in" onClick={close} disabled={authLoading}>
          <X size={18} weight="bold" />
        </button>

        <h2 id="auth-title" className={s.title}>
          {authStep === "mobile" ? "Sign in or create an account" : "Enter the code"}
        </h2>
        <p className={s.lede}>
          {authStep === "mobile" ? "Your mobile number is your account. We text you a code, no password." : `We sent a 6-digit code to +91 ${mobile}.`}
        </p>

        {authStep === "mobile" && (
          <form className={s.form} onSubmit={handleSendOtp}>
            <label htmlFor="login-mobile" className={s.label}>
              Mobile number
            </label>
            <div className={s.field}>
              <span className={s.prefix}>+91</span>
              <input
                ref={mobileRef}
                id="login-mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="98765 43210"
                value={mobile}
                onChange={handleMobileChange}
                maxLength={10}
                disabled={authLoading}
                className={s.input}
                aria-invalid={authError ? true : undefined}
                aria-describedby={authError ? "login-error" : undefined}
              />
            </div>
            {authError && (
              <p id="login-error" className={s.error} role="alert">
                {authError}
              </p>
            )}
            <button type="submit" className={`btn ${s.go}`} disabled={authLoading || mobile.length !== 10}>
              <span>{authLoading ? "Sending the code" : "Send code"}</span>
            </button>
            <p className={s.terms}>
              By continuing you agree to the <a href="/terms">terms</a> and the <a href="/privacy">privacy policy</a>.
            </p>
          </form>
        )}

        {authStep === "otp" && (
          <form className={s.form} onSubmit={handleVerifyOtp}>
            <label htmlFor="login-otp" className={s.label}>
              6-digit code
            </label>
            <input
              ref={otpRef}
              id="login-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={otp}
              onChange={handleOtpChange}
              maxLength={6}
              disabled={authLoading}
              className={`${s.input} ${s.code}`}
              aria-invalid={authError ? true : undefined}
              aria-describedby={authError ? "login-error" : authMessage ? "login-note" : undefined}
            />
            {authMessage && (
              <p id="login-note" className={s.note} role="status">
                {authMessage}
              </p>
            )}
            {authError && (
              <p id="login-error" className={s.error} role="alert">
                {authError}
              </p>
            )}
            <button type="submit" className={`btn ${s.go}`} disabled={authLoading || otp.length !== 6}>
              <span>{authLoading ? "Checking" : "Continue"}</span>
            </button>
            <div className={s.links}>
              <button type="button" onClick={handleBackToMobile} disabled={authLoading}>
                Change number
              </button>
              <button type="button" onClick={handleResendOtp} disabled={authLoading}>
                Send a new code
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
