"use client";

/**
 * The one date picker, in the dashboards' look instead of the browser's own: a button that opens a month
 * (a popover under it on a laptop, a panel from the bottom on a phone). Monday first, today ringed, the
 * chosen day filled, days outside min and max dimmed. Keys: arrows move a day or a week, Page Up and Page
 * Down a month, Home and End the week's ends, Enter picks, Escape closes; focus goes back to the button.
 * Values are "2026-11-19", the India date the backend takes. It renders at the top of the themed area (a
 * portal), above any card or sheet, so nothing clips it.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { toApiDate } from "@/lib/format/dateTime";
import styles from "./DatePicker.module.css";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (key: string, n: number) => {
  const d = dateOf(key);
  d.setDate(d.getDate() + n);
  return keyOf(d);
};
/** The same day n months on, or that month's last day (31 Jan + 1 is 28 Feb). */
const addMonths = (key: string, n: number) => {
  const d = dateOf(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return keyOf(d);
};
/** Monday 0 to Sunday 6 */
const weekdayOf = (key: string) => (dateOf(key).getDay() + 6) % 7;

const short = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const spoken = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const monthYear = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
});

/** "Thu, 19 Nov 2026" */
export const dateWords = (key: string) => (key ? short.format(dateOf(key)) : "");

export default function DatePicker({
  value,
  onChange,
  label,
  min,
  max,
  className,
  children,
  placeholder = "Choose a date",
}: {
  value: string;
  onChange: (value: string) => void;
  /** what is being chosen, for screen readers ("Day off") */
  label: string;
  min?: string;
  max?: string;
  /** the button's look; without it, a field like the form inputs */
  className?: string;
  /** what the button says; without it, the date in words and a calendar mark */
  children?: ReactNode;
  placeholder?: string;
}) {
  const today = toApiDate(new Date());
  const clamp = useCallback(
    (key: string) => (min && key < min ? min : max && key > max ? max : key),
    [min, max],
  );
  const [open, setOpen] = useState(false);
  // the day keys move over; the month shown is its month
  const [cursor, setCursor] = useState(() => clamp(value || today));
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // focus follows the cursor only when the keyboard moved it (or on opening), never on a month button
  const moveFocus = useRef(false);

  const show = () => {
    setCursor(clamp(value || today));
    moveFocus.current = true;
    setOpen(true);
  };
  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus({ preventScroll: true });
  }, []);

  // under the button, or above it when there is no room below, always on screen; a phone docks it at the bottom (CSS)
  const place = useCallback(() => {
    const at = button.current?.getBoundingClientRect();
    const el = panel.current;
    if (!at || !el) return;
    if (window.matchMedia("(max-width: 639px)").matches) {
      el.style.top = el.style.left = "";
      el.dataset.placed = "true";
      return;
    }
    const gap = 8;
    const edge = 16;
    const { offsetWidth: w, offsetHeight: h } = el;
    const below =
      at.bottom + gap + h <= window.innerHeight - edge ||
      at.top - gap - h < edge;
    el.style.top = `${below ? at.bottom + gap : at.top - gap - h}px`;
    el.style.left = `${Math.min(Math.max(edge, at.left), window.innerWidth - w - edge)}px`;
    el.dataset.placed = "true";
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, cursor, place]);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !panel.current?.contains(target) &&
        !button.current?.contains(target)
      )
        close(false);
    };
    document.addEventListener("pointerdown", away);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, close, place]);

  useEffect(() => {
    if (!open || !moveFocus.current) return;
    moveFocus.current = false;
    panel.current
      ?.querySelector<HTMLButtonElement>(`[data-key="${cursor}"]`)
      ?.focus({ preventScroll: true });
  }, [open, cursor]);

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      // a picker inside a sheet closes alone, not the sheet with it
      event.stopPropagation();
      close(true);
      return;
    }
    if (!(event.target as HTMLElement).dataset.key) return;
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    let next: string | null = null;
    if (event.key in steps) next = addDays(cursor, steps[event.key]);
    else if (event.key === "PageUp") next = addMonths(cursor, -1);
    else if (event.key === "PageDown") next = addMonths(cursor, 1);
    else if (event.key === "Home") next = addDays(cursor, -weekdayOf(cursor));
    else if (event.key === "End") next = addDays(cursor, 6 - weekdayOf(cursor));
    if (!next) return;
    event.preventDefault();
    moveFocus.current = true;
    setCursor(clamp(next));
  };

  const shown = dateOf(cursor);
  const year = shown.getFullYear();
  const month = shown.getMonth();
  const first = keyOf(new Date(year, month, 1));
  const last = keyOf(new Date(year, month + 1, 0));
  const days = Number(last.slice(8));
  const out = (key: string) => Boolean((min && key < min) || (max && key > max));
  const host =
    typeof document === "undefined"
      ? null
      : (document.querySelector(".app-theme") ?? document.body);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={className ?? styles.field}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={children ? undefined : `${label}: ${value ? dateWords(value) : placeholder}`}
        onClick={() => (open ? close(false) : show())}
      >
        {children ?? (
          <>
            <span className={value ? "num" : styles.placeholder}>
              {value ? dateWords(value) : placeholder}
            </span>
            <CalendarBlank size={18} aria-hidden="true" />
          </>
        )}
      </button>
      {open &&
        host &&
        createPortal(
          <div className={styles.layer}>
            <div className={styles.scrim} aria-hidden="true" />
            <div
              ref={panel}
              className={styles.panel}
              role="dialog"
              aria-label={label}
              onKeyDown={onKey}
              onBlur={(event) => {
                const to = event.relatedTarget as Node | null;
                if (to && !panel.current?.contains(to) && to !== button.current)
                  close(false);
              }}
            >
              <div className={styles.head}>
                <span className={styles.month} aria-live="polite">
                  {monthYear.format(shown)}
                </span>
                <button
                  type="button"
                  className={styles.nav}
                  aria-label="Previous month"
                  disabled={Boolean(min && addDays(first, -1) < min)}
                  onClick={() => setCursor(clamp(addMonths(cursor, -1)))}
                >
                  <CaretLeft size={16} weight="bold" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={styles.nav}
                  aria-label="Next month"
                  disabled={Boolean(max && addDays(last, 1) > max)}
                  onClick={() => setCursor(clamp(addMonths(cursor, 1)))}
                >
                  <CaretRight size={16} weight="bold" aria-hidden="true" />
                </button>
              </div>
              <div className={styles.grid}>
                {WEEK.map((day) => (
                  <span key={day} className={styles.weekday} aria-hidden="true">
                    {day}
                  </span>
                ))}
                {Array.from({ length: weekdayOf(first) }, (_, i) => (
                  <span key={`lead-${i}`} aria-hidden="true" />
                ))}
                {Array.from({ length: days }, (_, i) => {
                  const key = keyOf(new Date(year, month, i + 1));
                  return (
                    <button
                      key={key}
                      type="button"
                      data-key={key}
                      className={`${styles.day} num`}
                      tabIndex={key === cursor ? 0 : -1}
                      disabled={out(key)}
                      aria-pressed={key === value}
                      aria-current={key === today ? "date" : undefined}
                      aria-label={spoken.format(dateOf(key))}
                      onClick={() => {
                        onChange(key);
                        close(true);
                      }}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              {!out(today) && (
                <div className={styles.foot}>
                  <button
                    type="button"
                    className={styles.today}
                    onClick={() => {
                      onChange(today);
                      close(true);
                    }}
                  >
                    Today
                  </button>
                </div>
              )}
            </div>
          </div>,
          host,
        )}
    </>
  );
}
