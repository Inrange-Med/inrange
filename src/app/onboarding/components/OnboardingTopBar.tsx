/**
 * The top bar: the wordmark and Back, the progress ruler by chapter, and Save and exit. Back and
 * Save and exit stay on the blood test screens too; once the report is sent the screen itself
 * leads on, so both give way.
 */

import Link from "next/link";
import { ArrowLeft, X } from "@phosphor-icons/react";
import Wordmark from "@/components/ui/Wordmark";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import { CHAPTERS, TOTAL_STEPS } from "../onboardingOptions";
import type { Phase } from "../useBloodTestPath";
import styles from "./OnboardingTopBar.module.css";

type Props = {
  phase: Phase;
  step: number;
  chapterName: string;
  onBack: () => void;
  onSaveAndExit: () => void;
};

export default function OnboardingTopBar({
  phase,
  step,
  chapterName,
  onBack,
  onSaveAndExit,
}: Props) {
  const done = phase === "sent";
  return (
    <header className={styles.bar}>
      <div className={styles.barStart}>
        <Link href="/" className={styles.brand} aria-label="InRange home">
          <Wordmark height={24} />
        </Link>
        {!done && (
          <button
            type="button"
            className={formStyles.round}
            onClick={onBack}
            disabled={phase === "steps" && step === 1}
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
        )}
      </div>
      <div
        className={styles.progress}
        role="progressbar"
        aria-label="Profile"
        aria-valuemin={0}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={done ? TOTAL_STEPS : step - 1}
        aria-valuetext={
          done
            ? "Profile complete"
            : `Step ${step} of ${TOTAL_STEPS}, ${chapterName}`
        }
      >
        {CHAPTERS.map((chapter) => (
          <span
            key={chapter.name}
            className={styles.chap}
            style={{ flexGrow: chapter.steps.length }}
          >
            {chapter.steps.map((chapterStep) => (
              <i
                key={chapterStep}
                data-state={
                  done || chapterStep < step
                    ? "done"
                    : chapterStep === step
                      ? "now"
                      : undefined
                }
              />
            ))}
          </span>
        ))}
      </div>
      <div className={styles.barEnd}>
        {!done && (
          <>
            <button
              type="button"
              className={`${formStyles.link} ${styles.exitText}`}
              onClick={onSaveAndExit}
            >
              Save and exit
            </button>
            <button
              type="button"
              className={`${formStyles.round} ${styles.exitIcon}`}
              onClick={onSaveAndExit}
              aria-label="Save and exit"
            >
              <X size={18} />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
