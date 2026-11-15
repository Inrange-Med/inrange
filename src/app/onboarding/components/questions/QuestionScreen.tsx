/**
 * One question on screen: the chapter tag, the question and its reason, the answers (children),
 * a problem with no box of its own, and the docked Continue with the "saved as you go" line.
 */

import type { CSSProperties, ReactNode, RefObject } from "react";
import {
  ArrowRight,
  Check,
  LockSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import { STEP_QUESTIONS } from "@/app/onboarding/onboardingOptions";
import type { Problem } from "@/app/onboarding/onboardingDraft";
import ChapterTag from "@/app/onboarding/components/ChapterTag";
import pageStyles from "@/app/onboarding/OnboardingPage.module.css";
import styles from "./QuestionScreen.module.css";

type Props = {
  step: number;
  chapterName: string;
  direction: 1 | -1;
  busy: boolean;
  canContinue: boolean;
  problem: Problem | null;
  welcomeBack: boolean;
  /** what the status line says on arrival, in place of "Welcome back" (after the free check) */
  welcomeLine?: string;
  formRef: RefObject<HTMLFormElement | null>;
  /** false: the answers are their own actions (question 9's cards), so no Continue */
  dock?: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSubmit: () => void;
  children: ReactNode;
};

export default function QuestionScreen({
  step,
  chapterName,
  direction,
  busy,
  canContinue,
  problem,
  welcomeBack,
  welcomeLine,
  formRef,
  dock = true,
  headingRef,
  onSubmit,
  children,
}: Props) {
  const { question, why } = STEP_QUESTIONS[step];
  return (
    <form
      ref={formRef}
      className={pageStyles.stage}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      <div
        key={step}
        className={pageStyles.step}
        style={{ "--dir": direction } as CSSProperties}
      >
        <ChapterTag>{chapterName}</ChapterTag>
        <div className={pageStyles.head}>
          <h1 ref={headingRef} tabIndex={-1} className={pageStyles.q}>
            {question}
          </h1>
          <p className={pageStyles.why}>{why}</p>
        </div>
        {children}
        {problem && !problem.field && (
          <p
            className={`${formStyles.err} ${pageStyles.fieldErr}`}
            role="alert"
          >
            <WarningCircle size={16} weight="fill" />
            {problem.message}
          </p>
        )}
      </div>

      {dock && (
        <div className={styles.dock}>
          {/* looks unavailable until the answer is complete, but a tap still says what is missing */}
          <button
            type="submit"
            className={`btn ${formStyles.go}`}
            aria-disabled={!canContinue}
            data-busy={busy}
            aria-busy={busy}
          >
            <span>{busy ? "Saving" : "Continue"}</span>
            <span className="well" aria-hidden="true">
              {busy ? (
                <i className={formStyles.spin} />
              ) : (
                <ArrowRight size={18} />
              )}
            </span>
          </button>
          <p
            className={`${formStyles.demo} ${welcomeBack ? styles.back : ""}`}
            role="status"
          >
            {welcomeBack ? (
              <Check size={13} weight="bold" />
            ) : (
              <LockSimple size={13} />
            )}
            {welcomeBack
              ? (welcomeLine ?? "Welcome back. Your answers are saved.")
              : "Saved as you go."}
          </p>
        </div>
      )}
    </form>
  );
}
