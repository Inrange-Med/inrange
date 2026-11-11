"use client";

/*
  The public site's sign-in: mobile number, then the 6-digit code, then the right home (a doctor's
  dashboard, onboarding for a new patient, else the patient dashboard). The flow and its calls are the
  team's (authService, authSession); this file only gives it the site's look: the design repository's
  sheet (a bottom sheet on phones, a centred panel from 768px) holding the /sign-in plate (the dark
  plate with the isolines and the wordmark, the phone pill with its tick, the light action with its
  arrow well, the six round code cells).

  It opens three ways: openLogin() from any button, the nav's "Sign in", and any link to ASSESSMENT_URL
  (every "Book consultation" on every public page). Without JavaScript those links still reach /assessment,
  which sends people to the /sign-in page.
*/

import { ChangeEvent, CSSProperties, FormEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, WarningCircle, X } from "@phosphor-icons/react";
import { sendOtp, verifyOtp } from "@/services/authService";
import { homePathFor, saveSession } from "@/lib/session/authSession";
import ContourField from "./ContourField";
import { ASSESSMENT_URL, Wordmark } from "./ui";
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
  // closing: the plate sinks (or fades) away before the sheet unmounts, as the app's Sheet does
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<number | undefined>(undefined);
  const drag = useRef<{ startY: number; time: number; offset: number; velocity: number } | null>(null);
  const [authStep, setAuthStep] = useState<AuthStep>("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const mobileRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const reset = () => {
    setAuthStep("mobile");
    setMobile("");
    setOtp("");
    setAuthError("");
    setAuthMessage("");
  };

  const open = useCallback(() => {
    window.clearTimeout(leaveTimer.current);
    setLeaving(false);
    returnTo.current = document.activeElement as HTMLElement | null;
    reset();
    setLoginOpen(true);
  }, []);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  const close = () => {
    if (authLoading || leaving) return;
    setLeaving(true);
    returnTo.current?.focus({ preventScroll: true });
    const phone = !window.matchMedia("(min-width: 768px)").matches;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    leaveTimer.current = window.setTimeout(
      () => {
        setLoginOpen(false);
        setLeaving(false);
        reset();
      },
      still ? 200 : phone ? 360 : 220,
    );
  };

  // on a phone the plate follows the finger from its top row and closes on a flick or a long pull
  const onDragStart = (event: PointerEvent<HTMLDivElement>) => {
    // the handle and the top row are the grip; the form below scrolls and types as normal
    const grip = topRef.current?.getBoundingClientRect().bottom ?? 0;
    if (window.matchMedia("(min-width: 768px)").matches || event.clientY > grip || (event.target as HTMLElement).closest("button") || authLoading || leaving) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, time: performance.now(), offset: 0, velocity: 0 };
    if (panelRef.current) panelRef.current.style.transition = "none";
  };
  const onDragMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || !panelRef.current) return;
    const now = performance.now();
    const pulled = event.clientY - current.startY;
    // upwards it resists, the further the harder; downwards it follows the finger exactly
    const offset = pulled < 0 ? -((-pulled * 0.55 * 80) / (80 + 0.55 * -pulled)) : pulled;
    current.velocity = (offset - current.offset) / Math.max(1, now - current.time);
    current.offset = offset;
    current.time = now;
    panelRef.current.style.translate = `0 ${offset}px`;
  };
  const onDragEnd = () => {
    const released = drag.current;
    drag.current = null;
    const panel = panelRef.current;
    if (!released || !panel) return;
    panel.style.transition = "";
    panel.style.translate = "";
    // a quick flick closes it even when short; a slow pull closes it past a third of its height
    if (released.velocity > 0.5 || released.offset > panel.offsetHeight / 3) close();
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
  }, [loginOpen, authLoading, leaving]);

  useEffect(() => {
    if (!loginOpen) return;
    const timer = window.setTimeout(() => (authStep === "mobile" ? mobileRef : otpRef).current?.focus({ preventScroll: true }), 60);
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

  const mobileReady = mobile.length === 10;

  return (
    <div
      className={s.overlay}
      data-leaving={leaving}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        className={s.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <span className={s.handle} aria-hidden="true" />
        <ContourField className={s.field} density={10} lineAlpha={0.13} signalAlpha={0.42} seed={11} />
        {/* back (on the code step), the wordmark, close: three columns so the wordmark stays dead centre */}
        <div ref={topRef} className={s.top}>
          {authStep === "otp" ? (
            <button type="button" className={s.round} onClick={handleBackToMobile} disabled={authLoading} aria-label="Change number">
              <ArrowLeft size={18} />
            </button>
          ) : (
            <span className={s.slot} aria-hidden="true" />
          )}
          <span className={s.brand}>
            <Wordmark height={34} />
          </span>
          <button type="button" className={s.round} aria-label="Close sign in" onClick={close} disabled={authLoading}>
            <X size={18} />
          </button>
        </div>

        {/* each step arrives from the side it is going to: the code from the right, the number back from the left */}
        <div key={authStep} className={s.step} style={{ "--dir": authStep === "mobile" && mobile ? -1 : 1 } as CSSProperties}>
          <div className={s.head}>
            <h2 id="auth-title" className={s.title}>
              {authStep === "mobile" ? "Sign in or create an account" : "Enter the code"}
            </h2>
            <p className={s.lede}>
              {authStep === "mobile" ? "Your mobile number is your account. We text you a code, no password." : `We sent a 6-digit code to +91 ${mobile}.`}
            </p>
          </div>

          {authStep === "mobile" && (
            <form className={s.form} onSubmit={handleSendOtp}>
              <div className={s.fieldGroup}>
                <label htmlFor="login-mobile" className={s.label}>
                  Mobile number
                </label>
                <div className={s.phone} data-invalid={!!authError}>
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
                  <span className={s.tick} data-on={mobileReady} aria-hidden="true">
                    <Check size={14} weight="bold" />
                  </span>
                </div>
                {authError && (
                  <p id="login-error" className={`${s.error} ${s.fieldError}`} role="alert">
                    <WarningCircle size={16} aria-hidden="true" />
                    {authError}
                  </p>
                )}
              </div>
              <div className={s.actions}>
                <button type="submit" className={`btn btn--signal ${s.go}`} disabled={authLoading || mobile.length !== 10} data-busy={authLoading}>
                  <span>{authLoading ? "Sending the code" : "Send code"}</span>
                  <span className="well" aria-hidden="true">
                    {authLoading ? <i className={s.spin} /> : <ArrowRight size={18} />}
                  </span>
                </button>
                <p className={s.terms}>
                  By continuing you agree to the <a href="/terms">terms</a> and the <a href="/privacy">privacy policy</a>.
                </p>
              </div>
            </form>
          )}

          {authStep === "otp" && (
            <form className={s.form} onSubmit={handleVerifyOtp}>
              <div className={s.codeGroup}>
                <label htmlFor="login-otp" className={s.label}>
                  6-digit code
                </label>
                <div className={s.otp} data-state={authError ? "err" : undefined}>
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
                  {[0, 1, 2, 3, 4, 5].map((i) => {
                    const active = !authLoading && otp.length < 6 && i === otp.length;
                    return (
                      <span key={i} className={s.cell} data-filled={i < otp.length} data-active={active} aria-hidden="true">
                        <span key={otp[i] ?? ""} className={`${s.digit} num`}>
                          {otp[i]}
                        </span>
                        {active && <i className={s.caret} />}
                      </span>
                    );
                  })}
                </div>
                {authMessage && (
                  <p id="login-note" className={s.note} role="status">
                    {authMessage}
                  </p>
                )}
                {authError && (
                  <p id="login-error" className={s.error} role="alert">
                    <WarningCircle size={16} aria-hidden="true" />
                    {authError}
                  </p>
                )}
              </div>
              <button type="submit" className={`btn btn--signal ${s.go}`} disabled={authLoading || otp.length !== 6} data-busy={authLoading}>
                <span>{authLoading ? "Checking" : "Continue"}</span>
                <span className="well" aria-hidden="true">
                  {authLoading ? <i className={s.spin} /> : <ArrowRight size={18} />}
                </span>
              </button>
              <div className={s.links}>
                <button type="button" onClick={handleResendOtp} disabled={authLoading}>
                  Send a new code
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
