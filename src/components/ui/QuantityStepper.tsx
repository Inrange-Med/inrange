/** A count between min and max with minus and plus (44px targets); the number reads as a live value. */

import { Minus, Plus } from "@phosphor-icons/react";
import styles from "./QuantityStepper.module.css";

export default function QuantityStepper({
  value,
  min = 0,
  max,
  label,
  onChange,
  disabled = false,
}: {
  value: number;
  min?: number;
  max: number;
  /** what is counted, for screen readers: "Mounjaro KwikPen 2.5 mg, pens" */
  label: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <span className={styles.stepper} role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label="One fewer"
      >
        <Minus size={16} weight="bold" aria-hidden="true" />
      </button>
      <output className="num" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label="One more"
      >
        <Plus size={16} weight="bold" aria-hidden="true" />
      </button>
    </span>
  );
}
