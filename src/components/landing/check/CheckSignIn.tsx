"use client";

/*
  The free check's last question before the plan: name, email, mobile and consent on one screen,
  then the 6-digit code in the same place (call, 12 Nov 2026: "then take their name and number";
  fewer clicks before payment). It replaces the separate sign-in sheet and two onboarding screens
  (name, consent), which onboarding now saves from here. The sign-in calls are the team's own
  (authService, authSession), exactly as the sheet and /sign-in use them.
*/

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, PencilSimple } from "@phosphor-icons/react";
import { isValidMobile, mobileDigitsFrom, spacedMobile } from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import { CONSENTS, REQUIRED_CONSENTS } from "@/lib/onboarding/answerLists";
import { EMAIL_PATTERN } from "@/lib/onboarding/freeCheck";
import { saveSession } from "@/lib/session/authSession";
import { prepareSignIn, sendOtp, verifyOtp } from "@/services/authService";
import type { NextScreen } from "@/types/auth";
import type { UserRole } from "@/lib/session/authSession";
import s from "./FreeCheck.module.css";

export type Identity = { firstName: string; lastName: string; email: string; mobile: string; consented: boolean; ai: boolean };

const RESEND_AFTER_S = 30;
type Field = "firstName" | "email" | "mobile" | "consent";

/** What stops sending the code, and which box it belongs to. */
function problemOf(id: Identity): { field: Field; message: string } | null {
  if (!id.firstName.trim()) return { field: "firstName", message: "Add your first name." };
  if (!EMAIL_PATTERN.test(id.email.trim())) return { field: "email", message: id.email.trim() ? "That email does not look right." : "Add your email." };
  if (!isValidMobile(id.mobile)) return { field: "mobile", message: "Enter the 10-digit mobile number, without the 0 or +91." };
  if (!id.consented) return { field: "consent", message: "Tick the box to agree, so your doctor can see your details." };
  return null;
}

export default function CheckSignIn({
  identity,
  onChange,
  onVerified,
}: {
  identity: Identity;
  onChange: (patch: Partial<Identity>) => void;
  /** the session is saved; the check decides where to go from the role and the next screen */
  onVerified: (who: { role: UserRole; nextScreen: NextScreen }) => void;
}) {
  const [stage, setStage] = useState<"details" | "code">("details");
  const [problem, setProblem] = useState<{ field: Field | "code" | "send"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [done, setDone] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const smsListener = useRef<AbortController | null>(null);

  // the code's sender gets ready while the details are typed, so Send is not the slow moment
  useEffect(() => prepareSignIn(), []);
  useEffect(() => () => smsListener.current?.abort(), []);
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);
  useEffect(() => {
    if (stage !== "code") return;
    const timer = window.setTimeout(() => codeRef.current?.focus({ preventScroll: true }), 80);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const change = (patch: Partial<Identity>) => {
    onChange(patch);
    setProblem(null);
  };

  const verify = async (value: string) => {
    if (busy || done) return;
    smsListener.current?.abort();
    setBusy(true);
    setProblem(null);
    try {
      const result = await verifyOtp(identity.mobile, value);
      const user = saveSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        mobile: identity.mobile,
        user: result.user,
      });
      setDone(true);
      onVerified({ role: user.role, nextScreen: result.nextScreen });
    } catch (error) {
      setBusy(false);
      setCode("");
      setProblem({ field: "code", message: errorMessage(error) });
      codeRef.current?.focus();
    }
  };

  // Android Chrome reads the code straight from the text (WebOTP); iOS offers it on the keyboard
  const listenForSms = () => {
    if (!("OTPCredential" in window)) return;
    smsListener.current?.abort();
    const controller = new AbortController();
    smsListener.current = controller;
    (navigator.credentials.get as (options: unknown) => Promise<{ code?: string } | null>)({
      otp: { transport: ["sms"] },
      signal: controller.signal,
    })
      .then((otp) => {
        if (otp?.code) {
          setCode(otp.code);
          void verify(otp.code);
        }
      })
      .catch(() => undefined);
  };

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    const why = problemOf(identity);
    if (why) {
      setProblem(why);
      document.getElementById(`check-${why.field}`)?.focus();
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      setHint(await sendOtp(identity.mobile));
      setStage("code");
      setCode("");
      setResendIn(RESEND_AFTER_S);
      listenForSms();
    } catch (error) {
      setProblem({ field: stage === "code" ? "code" : "send", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const err = (field: Field) =>
    problem?.field === field ? (
      <p id={`check-${field}-err`} className={s.fieldErr} role="alert">
        {problem.message}
      </p>
    ) : null;

  if (stage === "code")
    return (
      <div className={s.signin}>
        <p className={s.codeLede}>
          {hint ?? (
            <>
              We sent a 6-digit code to <strong className="num">+91 {spacedMobile(identity.mobile)}</strong>.
            </>
          )}{" "}
          <button
            type="button"
            className={s.inlineLink}
            disabled={busy}
            onClick={() => {
              smsListener.current?.abort();
              setStage("details");
              setProblem(null);
            }}
          >
            <PencilSimple size={14} aria-hidden="true" />
            Change number
          </button>
        </p>
        <label className={s.codeBox}>
          <span className="sr-only">The 6-digit code</span>
          <input
            ref={codeRef}
            id="check-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            disabled={busy || done}
            aria-invalid={problem?.field === "code" || undefined}
            aria-describedby={problem?.field === "code" ? "check-code-err" : undefined}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(value);
              setProblem(null);
              if (value.length === 6) void verify(value);
            }}
            placeholder="000000"
          />
        </label>
        {problem?.field === "code" && (
          <p id="check-code-err" className={s.fieldErr} role="alert">
            {problem.message}
          </p>
        )}
        <p className={s.codeFoot} role="status">
          {done ? (
            <span className={s.kept}>
              <Check size={13} weight="bold" aria-hidden="true" />
              Signed in
            </span>
          ) : busy ? (
            "Checking the code"
          ) : resendIn > 0 ? (
            <>
              No code yet? You can ask again in <span className="num">{resendIn}</span> s.
            </>
          ) : (
            <button type="button" className={s.inlineLink} onClick={() => void send()}>
              Send a new code
            </button>
          )}
        </p>
      </div>
    );

  return (
    <form className={s.signin} onSubmit={send} noValidate>
      <div className={s.pair}>
        <label className={s.entry}>
          <span>First name</span>
          <input
            id="check-firstName"
            autoComplete="given-name"
            maxLength={60}
            value={identity.firstName}
            aria-invalid={problem?.field === "firstName" || undefined}
            aria-describedby={problem?.field === "firstName" ? "check-firstName-err" : undefined}
            onChange={(e) => change({ firstName: e.target.value })}
          />
          {err("firstName")}
        </label>
        <label className={s.entry}>
          <span>
            Last name <small>optional</small>
          </span>
          <input
            autoComplete="family-name"
            maxLength={60}
            value={identity.lastName}
            onChange={(e) => change({ lastName: e.target.value })}
          />
        </label>
      </div>
      <label className={s.entry}>
        <span>Email</span>
        <input
          id="check-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={120}
          value={identity.email}
          aria-invalid={problem?.field === "email" || undefined}
          aria-describedby={problem?.field === "email" ? "check-email-err" : undefined}
          onChange={(e) => change({ email: e.target.value })}
        />
        {err("email")}
      </label>
      <label className={s.entry}>
        <span>Mobile number</span>
        <span className={s.phone}>
          <span className={s.cc} aria-hidden="true">
            +91
          </span>
          <input
            id="check-mobile"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={spacedMobile(identity.mobile)}
            aria-invalid={problem?.field === "mobile" || undefined}
            aria-describedby={problem?.field === "mobile" ? "check-mobile-err" : "check-mobile-why"}
            onChange={(e) => change({ mobile: mobileDigitsFrom(e.target.value) })}
          />
        </span>
        <small id="check-mobile-why" className={s.fieldWhy}>
          We text a code to check it is yours. Your care team calls this number.
        </small>
        {err("mobile")}
      </label>

      <label className={s.tick}>
        <input
          id="check-consent"
          type="checkbox"
          checked={identity.consented}
          aria-describedby={problem?.field === "consent" ? "check-consent-err" : undefined}
          onChange={(e) => change({ consented: e.target.checked })}
        />
        <span>
          <strong>I agree</strong> to the <a href="/terms" target="_blank" rel="noopener">terms</a>, the{" "}
          <a href="/privacy" target="_blank" rel="noopener">
            privacy notice
          </a>
          , the use of my health details by my care team, and consultations by video.
        </span>
      </label>
      {err("consent")}
      <label className={`${s.tick} ${s.tickQuiet}`}>
        <input type="checkbox" checked={identity.ai} onChange={(e) => change({ ai: e.target.checked })} />
        <span>
          <strong>Optional.</strong> {CONSENTS.find((c) => c.type === "AI")?.line} Your doctor reads and signs every note.
        </span>
      </label>

      {problem?.field === "send" && (
        <p className={s.fieldErr} role="alert">
          {problem.message}
        </p>
      )}
      <button type="submit" className={`btn ${s.go}`} data-busy={busy} aria-busy={busy}>
        <span>{busy ? "Sending the code" : "Send the code"}</span>
        <span className="well" aria-hidden="true">
          {busy ? <i className={s.spin} /> : <ArrowRight size={18} />}
        </span>
      </button>
    </form>
  );
}

/** The consents to keep with the check, as onboarding saves them. */
export const consentsOf = (id: Identity) => (id.consented ? [...REQUIRED_CONSENTS, ...(id.ai ? (["AI"] as const) : [])] : []);
