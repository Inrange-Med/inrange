/*
  Home's third card before the first consultation (Arhaan HomeView "Before your plan"): the three
  steps in the product's order (11 Nov 2026), blood tests first (a home test, or a report from the
  last 90 days), then the medical team's review, then the doctor, with the health coach on the same
  call (client call, 12 Nov 2026). No duration is shown: the call runs as long as it needs. The card
  opens how inrange works; the blood-test step leads to booking a home test or uploading a report.
*/

import type { ReactNode } from "react";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react";
import { clockTime } from "@/lib/format/dateTime";
import type { Appointment } from "@/types/appointment";
import { dayLabel } from "./careStage";
import pageStyles from "@/app/patient-dashboard/HomePage.module.css";
import styles from "./FirstStepsCard.module.css";

type StepState = "now" | "next";

export default function FirstStepsCard({
  upcoming,
}: {
  upcoming: Appointment | null;
}) {
  const consultation = upcoming
    ? `${dayLabel(upcoming.startsAt)}, ${clockTime(new Date(upcoming.startsAt))}, by video`
    : "By video, with your doctor and then your health coach";
  const steps: {
    label: string;
    short: string;
    state: StepState;
    detail?: ReactNode;
    href?: string;
  }[] = [
    {
      label: "Blood tests, if none in 90 days",
      short: "Blood tests",
      state: "now",
      href: "/patient-dashboard/lab-tests",
      detail: (
        <Link href="/patient-dashboard/reports" className={styles.stepLink}>
          Or upload a recent report
          <CaretRight size={14} aria-hidden="true" />
        </Link>
      ),
    },
    {
      label: "A review by our medical team",
      short: "Review",
      state: "next",
    },
    {
      label: "Your first consultation",
      short: "Doctor",
      state: "next",
      detail: consultation,
    },
  ];

  return (
    <section
      className={`${pageStyles.card} ${pageStyles.dose} ${pageStyles.quiet} ${pageStyles.first}`}
      aria-labelledby="stage-heading"
    >
      <div className={pageStyles.head}>
        <h2 id="stage-heading" className={pageStyles.label}>
          <Link
            href="/patient-dashboard/resources/how-inrange-works"
            className={pageStyles.stretch}
          >
            Before your plan
          </Link>
        </h2>
        <span className={pageStyles.go} aria-hidden="true">
          How it works
          <CaretRight size={14} />
        </span>
      </div>
      <p className={pageStyles.doseTitle}>
        After your consultation, your doctor suggests a plan
      </p>
      <ol className={styles.steps}>
        {steps.map((step) => (
          <li key={step.short} data-state={step.state}>
            <i aria-hidden="true" />
            <span>
              {step.href ? (
                <Link href={step.href} className={styles.stepLink}>
                  {step.label}
                  <CaretRight
                    size={14}
                    aria-hidden="true"
                    className={styles.stepCaret}
                  />
                </Link>
              ) : (
                step.label
              )}
              {step.detail && (
                <span className={styles.stepDetail}>{step.detail}</span>
              )}
              <span className="sr-only">
                {step.state === "now" ? ", next" : ""}
              </span>
            </span>
          </li>
        ))}
      </ol>
      {/* a short phone: the same three, as one line */}
      <p className={styles.stepsLine}>
        {steps.map((step, i) => (
          <span key={step.short} data-state={step.state}>
            {i > 0 && <span className={styles.sep}> · </span>}
            {step.short}
          </span>
        ))}
      </p>
      <p className={pageStyles.quietLine}>
        Medicine only if your doctor judges it right for you.
      </p>
    </section>
  );
}
