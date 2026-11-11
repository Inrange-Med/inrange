/*
  Where a new patient stands before the first consultation: the headline, one calm line, the steps
  of their path and the one thing to do next. The page puts it in its own card (Home's status card,
  or the Book page when booking is not open yet). Words: eligibilityStage.ts.
  The steps are drawn as Home's first-steps nodes (FirstStepsCard.module.css, Arhaan Home .steps), so
  both cards before the first consultation share one step language; a short phone gets them as one line.
*/

import Link from "next/link";
import { ArrowRight, CaretRight, Check } from "@phosphor-icons/react";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import type { EligibilityStatusView } from "./eligibilityStage";
import stepStyles from "./home/FirstStepsCard.module.css";
import styles from "./EligibilityStatus.module.css";

const SPOKEN_STATE = {
  done: "done",
  now: "current",
  next: "to come",
} as const;

const stateOf = (index: number, currentIndex: number) =>
  index < currentIndex ? "done" : index === currentIndex ? "now" : "next";

export default function EligibilityStatus({
  status,
}: {
  status: EligibilityStatusView;
}) {
  const { action } = status;
  return (
    <div className={styles.status}>
      <div className={styles.words}>
        <p className={styles.title}>{status.title}</p>
        <p className={styles.text}>{status.text}</p>
      </div>
      <ol className={stepStyles.steps}>
        {status.steps.map((step, i) => {
          const state = stateOf(i, status.currentIndex);
          return (
            <li key={step.label} data-state={state}>
              <i aria-hidden="true">
                {state === "done" && <Check size={11} weight="bold" />}
              </i>
              <span>
                {step.label}
                <span className="sr-only">, {SPOKEN_STATE[state]}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {/* a short phone: the same steps, as one line */}
      <p className={stepStyles.stepsLine} aria-hidden="true">
        {status.steps.map((step, i) => (
          <span key={step.label} data-state={stateOf(i, status.currentIndex)}>
            {i > 0 && <span className={stepStyles.sep}> · </span>}
            {step.label}
          </span>
        ))}
      </p>
      {action &&
        (action.filled ? (
          <div className={styles.actions}>
            <Link href={action.href} className={`btn ${formStyles.go}`}>
              <span>{action.label}</span>
              <span className="well" aria-hidden="true">
                <ArrowRight size={18} />
              </span>
            </Link>
          </div>
        ) : (
          <Link
            href={action.href}
            className={`${formStyles.link} ${styles.link}`}
          >
            {action.label} <CaretRight size={14} aria-hidden="true" />
          </Link>
        ))}
    </div>
  );
}
