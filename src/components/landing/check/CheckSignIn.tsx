"use client";

/*
  The free check's sign-in, in two parts (call, 16 Nov 2026: the code is asked for as late as
  possible, right before booking, because people drop off at the code):
    CheckDetails  name, email, mobile and consent on one screen, checked on the device; nothing is sent
    CheckCode     after the plan and the first step are chosen: the 6-digit code is sent as the screen
                  opens and checked in place
  It replaces the separate sign-in sheet and two onboarding screens (name, consent), which onboarding
  now saves from here. The sign-in calls are the team's own (authService, authSession), exactly as the
  sheet and /sign-in use them.
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

/** What stops the details going on, and which box it belongs to. */
function problemOf(id: Identity): { field: Field; message: string } | null {
  if (!id.firstName.trim()) return { field: "firstName", message: "Add your first name." };
  if (!EMAIL_PATTERN.test(id.email.trim())) return { field: "email", message: id.email.trim() ? "That email does not look right." : "Add your email." };
  if (!isValidMobile(id.mobile)) return { field: "mobile", message: "Enter a 10-digit mobile number." };
  if (!id.consented) return { field: "consent", message: "Tick the box to continue." };
  return null;
}

export function CheckDetails({
  identity,
  onChange,
  onDone,
}: {
  identity: Identity;
  onChange: (patch: Partial<Identity>) => void;
  /** every box is filled in correctly */
  onDone: () => void;
}) {
  const [problem, setProblem] = useState<{ field: Field; message: string } | null>(null);

  // the code's sender gets ready while the details are typed, so the code screen is not the slow moment
  useEffect(() => prepareSignIn(), []);

  const change = (patch: Partial<Identity>) => {
    onChange(patch);
    setProblem(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const why = problemOf(identity);
    if (why) {
      setProblem(why);
      document.getElementById(`check-${why.field}`)?.focus();
      return;
    }
    onDone();
  };

  const err = (field: Field) =>
    problem?.field === field ? (
      <p id={`check-${field}-err`} className={s.fieldErr} role="alert">
        {problem.message}
      </p>
    ) : null;

  return (
    <form className={s.signin} onSubmit={submit} noValidate>
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
          Your care team calls this number.
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
          <strong>Optional.</strong> {CONSENTS.find((c) => c.type === "AI")?.line}
        </span>
      </label>

      <button type="submit" className={`btn ${s.go}`}>
        <span>See my next step</span>
        <span className="well" aria-hidden="true">
          <ArrowRight size={18} />
        </span>
      </button>
    </form>
  );
}

/** The last code sent from this page, so going back and forward does not send another at once. */
export type LastSend = { mobile: string; at: number; hint: string | null };

export function CheckCode({
  mobile,
  lastSend,
  onSent,
  onChangeNumber,
  onVerified,
}: {
  mobile: string;
  lastSend: LastSend | null;
  onSent: (sent: LastSend) => void;
  onChangeNumber: () => void;
  /** the session is saved; the check decides where to go from the role and the next screen */
  onVerified: (who: { role: UserRole; nextScreen: NextScreen }) => void;
}) {
  const recent = lastSend?.mobile === mobile && Date.now() - lastSend.at < RESEND_AFTER_S * 1000 ? lastSend : null;
  const [sending, setSending] = useState(!recent);
  const [sent, setSent] = useState(!!recent);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [hint, setHint] = useState<string | null>(recent?.hint ?? null);
  const [resendIn, setResendIn] = useState(recent ? Math.ceil(RESEND_AFTER_S - (Date.now() - recent.at) / 1000) : 0);
  const [done, setDone] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const smsListener = useRef<AbortController | null>(null);
  const started = useRef(false);

  useEffect(() => () => smsListener.current?.abort(), []);
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const verify = async (value: string) => {
    if (busy || done) return;
    smsListener.current?.abort();
    setBusy(true);
    setProblem(null);
    try {
      const result = await verifyOtp(mobile, value);
      const user = saveSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        mobile,
        user: result.user,
      });
      setDone(true);
      onVerified({ role: user.role, nextScreen: result.nextScreen });
    } catch (error) {
      setBusy(false);
      setCode("");
      setProblem(errorMessage(error));
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

  const send = async () => {
    setSending(true);
    setProblem(null);
    try {
      const line = await sendOtp(mobile);
      setHint(line);
      setSent(true);
      setCode("");
      setResendIn(RESEND_AFTER_S);
      onSent({ mobile, at: Date.now(), hint: line });
      listenForSms();
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  // the code goes out as the screen opens (once, even under React's development double run)
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (recent) listenForSms();
    else void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  useEffect(() => {
    if (!sent) return;
    const timer = window.setTimeout(() => codeRef.current?.focus({ preventScroll: true }), 80);
    return () => window.clearTimeout(timer);
  }, [sent]);

  return (
    <div className={s.signin}>
      <p className={s.codeLede}>
        {sending && !sent ? (
          <>
            Sending a 6-digit code to <strong className="num">+91 {spacedMobile(mobile)}</strong>.
          </>
        ) : (
          (hint ?? (
            <>
              We sent a 6-digit code to <strong className="num">+91 {spacedMobile(mobile)}</strong>.
            </>
          ))
        )}{" "}
        <button
          type="button"
          className={s.inlineLink}
          disabled={busy || done}
          onClick={() => {
            smsListener.current?.abort();
            onChangeNumber();
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
          disabled={busy || done || !sent}
          aria-invalid={!!problem || undefined}
          aria-describedby={problem ? "check-code-err" : undefined}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(value);
            setProblem(null);
            if (value.length === 6) void verify(value);
          }}
          placeholder="000000"
        />
      </label>
      {problem && (
        <p id="check-code-err" className={s.fieldErr} role="alert">
          {problem}
        </p>
      )}
      <p className={s.codeFoot} role="status">
        {done ? (
          <span className={s.kept}>
            <Check size={13} weight="bold" aria-hidden="true" />
            Confirmed
          </span>
        ) : busy ? (
          "Checking the code"
        ) : sending ? (
          "Sending the code"
        ) : resendIn > 0 ? (
          <>
            Resend in <span className="num">{resendIn}</span> s
          </>
        ) : (
          <button type="button" className={s.inlineLink} onClick={() => void send()}>
            {sent ? "Send a new code" : "Try again"}
          </button>
        )}
      </p>
    </div>
  );
}

/** The consents to keep with the check, as onboarding saves them. */
export const consentsOf = (id: Identity) => (id.consented ? [...REQUIRED_CONSENTS, ...(id.ai ? (["AI"] as const) : [])] : []);
