/** The second step: the 6-digit code, one real input under six round cells, and resend. */

import { useEffect, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import { COUNTRY_CODE, spacedMobile } from "@/lib/format/phone";
import pageStyles from "../SignInPage.module.css";
import styles from "./CodeStep.module.css";

type Props = {
  direction: 1 | -1;
  digits: string;
  code: string;
  error: string | null;
  /** pilot only: the backend sends no SMS and says which code to enter */
  pilotHint: string | null;
  shake: number;
  busy: boolean;
  verified: boolean;
  resendInSeconds: number;
  inputRef: RefObject<HTMLInputElement | null>;
  onCode: (code: string) => void;
  onSubmit: (code: string) => void;
  onEditNumber: () => void;
  onResend: () => void;
};

const CODE_LENGTH = 6;
const CELLS = Array.from({ length: CODE_LENGTH }, (_, i) => i);

const minutesSeconds = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** how long "Your code is on its way." stays before the line settles on the expiry, as a text would arrive */
const ARRIVES_AFTER_MS = 1100;

export default function CodeStep({
  direction,
  digits,
  code,
  error,
  pilotHint,
  shake,
  busy,
  verified,
  resendInSeconds,
  inputRef,
  onCode,
  onSubmit,
  onEditNumber,
  onResend,
}: Props) {
  // the pulsing "on its way" line gives way to the expiry once the text has had time to land; a new
  // code (the resend countdown jumps back up) starts it again
  const [arrived, setArrived] = useState(false);
  const [lastCountdown, setLastCountdown] = useState(resendInSeconds);
  if (resendInSeconds !== lastCountdown) {
    setLastCountdown(resendInSeconds);
    if (resendInSeconds > lastCountdown) setArrived(false);
  }
  useEffect(() => {
    if (arrived) return;
    const timer = setTimeout(() => setArrived(true), ARRIVES_AFTER_MS);
    return () => clearTimeout(timer);
  }, [arrived]);

  return (
    <form
      className={pageStyles.step}
      style={{ "--dir": direction } as CSSProperties}
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length === CODE_LENGTH) onSubmit(code);
      }}
      noValidate
    >
      <div className={pageStyles.head}>
        <h1 id="sign-in-title" className={pageStyles.title}>
          Enter the code
        </h1>
        <p className={pageStyles.sub}>
          Sent to{" "}
          <strong className="num">
            {COUNTRY_CODE} {spacedMobile(digits)}
          </strong>
          .{" "}
          <button
            type="button"
            className={`${formStyles.link} ${pageStyles.link} ${styles.inline}`}
            onClick={onEditNumber}
          >
            Edit
          </button>
        </p>
      </div>

      <div className={styles.otpWrap}>
        <div
          className={styles.otp}
          data-state={verified ? "ok" : error ? "err" : undefined}
          data-shake={shake === 0 ? undefined : shake % 2 ? "1" : "2"}
        >
          <input
            ref={inputRef}
            className={styles.otpInput}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={CODE_LENGTH}
            aria-label="6-digit code"
            aria-invalid={!!error}
            aria-describedby="sign-in-code-hint"
            value={code}
            disabled={verified}
            onChange={(event) => {
              const value = event.target.value
                .replace(/\D/g, "")
                .slice(0, CODE_LENGTH);
              onCode(value);
              if (value.length === CODE_LENGTH) onSubmit(value);
            }}
          />
          {CELLS.map((i) => {
            const active =
              !verified &&
              !busy &&
              i === Math.min(code.length, CODE_LENGTH - 1) &&
              code.length < CODE_LENGTH;
            return (
              <span
                key={i}
                className={styles.cell}
                data-filled={i < code.length || verified}
                data-active={active}
                style={{ "--i": i } as CSSProperties}
                aria-hidden="true"
              >
                <span key={code[i] ?? ""} className={`${styles.digit} num`}>
                  {code[i]}
                </span>
                {active && <i className={styles.caret} />}
              </span>
            );
          })}
        </div>
        <p
          id="sign-in-code-hint"
          className={error ? pageStyles.err : styles.hint}
          role={error ? "alert" : undefined}
          aria-live="polite"
        >
          {error ? (
            <>
              <WarningCircle size={16} />
              {error}
            </>
          ) : verified ? (
            "Verified. Opening your account."
          ) : busy ? (
            "Checking the code"
          ) : (
            (pilotHint ??
            (arrived ? (
              "It expires in 5 minutes."
            ) : (
              <span className={styles.onWay}>
                <i aria-hidden="true" />
                Your code is on its way.
              </span>
            )))
          )}
        </p>
      </div>

      <div className={styles.resend}>
        {resendInSeconds > 0 ? (
          <p className={styles.hint}>
            Resend code in{" "}
            <span className="num">{minutesSeconds(resendInSeconds)}</span>
          </p>
        ) : (
          <button
            type="button"
            className={`${formStyles.link} ${pageStyles.link}`}
            onClick={onResend}
            disabled={busy || verified}
          >
            Send a new code
          </button>
        )}
      </div>
    </form>
  );
}
