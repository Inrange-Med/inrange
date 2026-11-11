/**
 * A status, step by step (a home blood test): Arhaan's Care `Steps`, a short line across the card at
 * every width. Done steps are solid bars, the current one a thicker bar in the signal colour, the
 * rest hairlines. `currentIndex` is the step happening now.
 */

import styles from "./StatusTracker.module.css";

const SPOKEN_STATE = {
  done: ", done",
  now: ", now",
  later: ", to come",
} as const;

const stateOf = (index: number, currentIndex: number) =>
  index < currentIndex ? "done" : index === currentIndex ? "now" : "later";

export default function StatusTracker({
  steps,
  currentIndex,
  whenFor,
  label,
}: {
  steps: { label: string }[];
  currentIndex: number;
  whenFor?: (index: number) => string | null;
  /** what the steps are, read out before them */
  label?: string;
}) {
  return (
    <ol className={styles.tracker} aria-label={label}>
      {steps.map((step, i) => {
        const state = stateOf(i, currentIndex);
        const when = whenFor?.(i);
        return (
          <li key={step.label} data-state={state}>
            <i aria-hidden="true" />
            <span className={styles.trackLabel}>{step.label}</span>
            {when && <span className={`${styles.trackWhen} num`}>{when}</span>}
            <span className="sr-only">{SPOKEN_STATE[state]}</span>
          </li>
        );
      })}
    </ol>
  );
}
