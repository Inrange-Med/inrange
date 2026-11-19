/* Tap to add, tap again to take out: the usual words for a text box, so the doctor need not type them. The
   box keeps anything else they write. Diagnosis items are joined with commas, advice one per line. */

import styles from "./ConsultationPage.module.css";

export default function QuickPicks({
  label,
  options,
  text,
  perLine = false,
  onChange,
}: {
  label: string;
  options: string[];
  text: string;
  perLine?: boolean;
  onChange: (text: string) => void;
}) {
  // a diagnosis splits at commas and sentence ends ("Obesity, class 1. Prediabetes."), never inside "31.5"
  const items = text
    .split(perLine ? /\n/ : /[,;\n]|\.(?=\s|$)/)
    .map((x) => x.trim())
    .filter(Boolean);
  // "Walk 30 minutes a day." is the same as the pick without its full stop
  const same = (a: string, b: string) =>
    a.replace(/[.\s]+$/, "").toLowerCase() ===
    b.replace(/[.\s]+$/, "").toLowerCase();
  const has = (option: string) => items.some((x) => same(x, option));
  const toggle = (option: string) =>
    onChange(
      (has(option)
        ? items.filter((x) => !same(x, option))
        : [...items, option]
      ).join(perLine ? "\n" : ", "),
    );

  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={has(option)}
          className={`${styles.chip} ${styles.pick}`}
          onClick={() => toggle(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
