/** The report is with the medical team: what happens next, the patient's BMI, and the way into the account. */

import type { CSSProperties, RefObject } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import BmiReadout from "@/app/onboarding/components/BmiReadout";
import pageStyles from "@/app/onboarding/OnboardingPage.module.css";
import styles from "./ReportSentScreen.module.css";

export default function ReportSentScreen({
  bmi,
  headingRef,
}: {
  bmi: number | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className={`${pageStyles.stage} ${pageStyles.screen}`}>
      <div
        className={`${pageStyles.step} ${styles.done}`}
        style={{ "--dir": 1 } as CSSProperties}
      >
        <span className={styles.seal} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className={pageStyles.head}>
          <h1 ref={headingRef} tabIndex={-1} className={pageStyles.q}>
            Report sent
          </h1>
          <p className={pageStyles.why}>
            Your report is in. Your account shows when you can book your
            consultation.
          </p>
        </div>
        <div className={pageStyles.bmiCard}>
          <BmiReadout bmi={bmi} />
        </div>
        <div className={styles.doneActions}>
          <Link href="/patient-dashboard" className={`btn ${formStyles.go}`}>
            <span>Go to my account</span>
            <span className="well" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
