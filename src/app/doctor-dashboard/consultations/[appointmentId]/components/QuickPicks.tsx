"use client";

/* The usual words for a text box, so the doctor need not type them: tap to add, tap again to take out. The
   box keeps anything else they write. Diagnosis items are joined with commas, advice one per line. A long
   list that will keep growing opens as a dropdown (`menu`) so it never fills the page (19 Nov 2026 call:
   "give a dropdown, or the prescription fills up with one thing"); a short list shows as taps. */

import { useEffect, useRef, useState } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";
import styles from "./ConsultationPage.module.css";

export default function QuickPicks({
  label,
  options,
  text,
  perLine = false,
  menu = false,
  onChange,
}: {
  label: string;
  options: string[];
  text: string;
  perLine?: boolean;
  /** a dropdown of ticks instead of taps */
  menu?: boolean;
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

  if (menu)
    return (
      <PickMenu label={label} options={options} has={has} toggle={toggle} />
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

/** A button that opens the list as ticks; it stays open for several, and closes on a click away or Escape. */
function PickMenu({
  label,
  options,
  has,
  toggle,
}: {
  label: string;
  options: string[];
  has: (option: string) => boolean;
  toggle: (option: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const chosen = options.filter(has).length;

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={box} className={styles.menuBox}>
      <button
        ref={button}
        type="button"
        className={styles.menuButton}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>
          {chosen
            ? `Choose from the list (${chosen} chosen)`
            : "Choose from the list"}
        </span>
        <CaretDown size={16} weight="bold" aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.menu} role="group" aria-label={label}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={has(option)}
              className={styles.menuItem}
              onClick={() => toggle(option)}
            >
              <span className={styles.tick} aria-hidden="true">
                {has(option) && <Check size={12} weight="bold" />}
              </span>
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
