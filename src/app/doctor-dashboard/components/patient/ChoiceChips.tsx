/* Tap, don't type: one choice out of a few, as pills at 48px (the PRD's floor for anything pressed). */

import styles from "./PatientPage.module.css";

export default function ChoiceChips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  /** tapping the chosen one again clears it (an optional choice) */
  onChange: (value: T | "") => void;
}) {
  return (
    <div className={styles.chips} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={styles.chip}
          onClick={() => onChange(value === option.value ? "" : option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
