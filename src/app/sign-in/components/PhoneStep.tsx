/** The first step: the 10-digit Indian mobile number, with a tick the moment it is complete. */

import type { CSSProperties, RefObject } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CaretRight,
  Check,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  COUNTRY_CODE,
  isValidMobile,
  mobileDigitsFrom,
  spacedMobile,
} from "@/lib/format/phone";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import pageStyles from "../SignInPage.module.css";
import styles from "./PhoneStep.module.css";

type Props = {
  creating: boolean;
  signedOut: boolean;
  direction: 1 | -1;
  digits: string;
  error: string | null;
  busy: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onDigits: (digits: string) => void;
  onSubmit: () => void;
};

export default function PhoneStep({
  creating,
  signedOut,
  direction,
  digits,
  error,
  busy,
  inputRef,
  onDigits,
  onSubmit,
}: Props) {
  const valid = isValidMobile(digits);
  return (
    <form
      className={pageStyles.step}
      style={{ "--dir": direction } as CSSProperties}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      <div className={pageStyles.head}>
        <h1 id="sign-in-title" className={pageStyles.title}>
          {creating ? "Create your account" : "Sign in"}
        </h1>
        <p className={pageStyles.sub}>
          {creating
            ? "We text you a 6-digit code, so there is no password to remember."
            : `${signedOut ? "You're signed out. " : ""}We text a 6-digit code to your mobile.`}
        </p>
      </div>

      <div className={pageStyles.field2}>
        <label className={styles.label} htmlFor="sign-in-mobile">
          Mobile number
        </label>
        <div className={styles.phone} data-invalid={!!error}>
          <span className={styles.cc}>
            <select
              aria-label="Country code"
              defaultValue={COUNTRY_CODE}
              className={styles.ccSelect}
            >
              <option value={COUNTRY_CODE}>{COUNTRY_CODE} India</option>
            </select>
            <span className={styles.ccShown} aria-hidden="true">
              {COUNTRY_CODE}
            </span>
          </span>
          <input
            ref={inputRef}
            id="sign-in-mobile"
            className={styles.phoneInput}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={spacedMobile(digits)}
            aria-invalid={!!error}
            aria-describedby={error ? "sign-in-mobile-error" : undefined}
            onChange={(event) => onDigits(mobileDigitsFrom(event.target.value))}
          />
          <span className={styles.phoneOk} data-on={valid} aria-hidden="true">
            <Check size={14} weight="bold" />
          </span>
        </div>
        {error && (
          <p className={pageStyles.err} id="sign-in-mobile-error" role="alert">
            <WarningCircle size={16} />
            {error}
          </p>
        )}
      </div>

      <div className={styles.actions}>
        {/* never disabled: a tap on a short or mistyped number has to say what is wrong */}
        <button
          type="submit"
          className={`btn btn--signal ${formStyles.go} ${pageStyles.go}`}
          data-ready={valid}
          data-busy={busy}
          aria-busy={busy}
        >
          <span>{busy ? "Sending code" : "Continue"}</span>
          <span className="well" aria-hidden="true">
            {busy ? (
              <i className={formStyles.spin} />
            ) : (
              <ArrowRight size={18} />
            )}
          </span>
        </button>
        <p className={styles.legal}>
          By continuing you agree to our <a href="/terms">Terms</a> and{" "}
          <a href="/privacy">Privacy notice</a>.
        </p>
      </div>

      <p className={pageStyles.switch}>
        {creating ? "Already with inrange?" : "New to inrange?"}{" "}
        <Link
          href={creating ? "/sign-in" : "/sign-in?new=1"}
          className={`${formStyles.link} ${pageStyles.link}`}
        >
          {creating ? "Sign in" : "Create an account"}
          <CaretRight size={14} weight="bold" />
        </Link>
      </p>
    </form>
  );
}
