"use client";

/*
  Logging a weight reading (Arhaan Logs.tsx WeightSheet). The box starts on the last reading, and
  the first key typed replaces it whole, so a new number is never added onto the old one. The
  steppers nudge by 0.1. Readings are typed in the patient's unit and saved in kg.
*/

import { useRef, useState } from "react";
import { ArrowRight, Minus, Plus } from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import { relativeDayName, shortDate } from "@/lib/format/dateTime";
import { ApiError, errorMessage } from "@/lib/http/apiClient";
import {
  formatWeight,
  kgTo,
  toKg,
  useUnits,
} from "@/lib/units/measurementUnits";
import type { WeightReading } from "@/types/tracker";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "./WeightSheet.module.css";

/** "Today", "Yesterday" or "3 Oct": when a reading was taken, as a person would say it. */
function dayWord(iso: string) {
  const near = relativeDayName(iso);
  if (near === "Today") return near;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return new Date(iso).toDateString() === yesterday.toDateString()
    ? "Yesterday"
    : shortDate(iso);
}

export default function WeightSheet({
  startKg,
  last,
  onSave,
}: {
  startKg: number;
  last: WeightReading | undefined;
  onSave: (weightKg: number) => Promise<void>;
}) {
  const unit = useUnits().weight;
  const [text, setText] = useState(() => kgTo(startKg, unit).toFixed(1));
  // true from focus until the first edit: that edit replaces the value, whatever the caret did
  const fresh = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = parseFloat(text.replace(",", "."));
  const kg = Number.isFinite(shown) ? toKg(shown, unit) : NaN;
  const ok = kg >= 30 && kg <= 250;
  // only judge the number once it has two digits, so a half-typed reading is not called wrong
  const judged = text.replace(/\D/g, "").length >= 2;
  // a steady weight is a reading too: saving is still allowed, and the hint says so
  const same =
    !!last &&
    ok &&
    Math.round(kgTo(kg, unit) * 10) ===
      Math.round(kgTo(last.weightKg, unit) * 10);
  const nudge = (delta: number) => {
    fresh.current = false;
    setText((value) =>
      (
        Math.round(((parseFloat(value) || kgTo(startKg, unit)) + delta) * 10) /
        10
      ).toFixed(1),
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(Math.round(kg * 10) / 10);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.isMissingEndpoint
          ? "Logging your weight is not available yet."
          : errorMessage(caught),
      );
      setSaving(false);
    }
  };

  return (
    <div className={styles.sheetBody}>
      {last && (
        <p className={styles.lastChip}>
          Last reading <strong>{dayWord(last.loggedAt)}</strong>
        </p>
      )}
      <div className={styles.scale}>
        <button
          type="button"
          className={styles.scaleStep}
          onClick={() => nudge(-0.1)}
          aria-label="0.1 less"
        >
          <Minus size={18} />
        </button>
        <label className={styles.scaleRead}>
          <span className="sr-only">Today&apos;s weight in {unit}</span>
          <input
            className={`${styles.scaleInput} num`}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            value={text}
            placeholder={kgTo(startKg, unit).toFixed(1)}
            onFocus={(event) => {
              fresh.current = true;
              const input = event.currentTarget;
              input.select();
              // Safari drops a selection made during the tap that focused the box; re-select only if
              // nothing has been typed yet, so a fast first key is never swallowed
              requestAnimationFrame(() => {
                if (fresh.current)
                  input.setSelectionRange(0, input.value.length);
              });
            }}
            onBlur={() => {
              fresh.current = false;
            }}
            onChange={(event) => {
              let value = event.target.value.replace(/[^\d.,]/g, "");
              if (fresh.current) {
                fresh.current = false;
                // the first edit wins over the old value: typed after it, before it, or a deletion
                const input = event.nativeEvent as InputEvent;
                const kind = input.inputType ?? "";
                if (kind.startsWith("delete")) value = "";
                else if (kind === "insertText" && input.data)
                  value = input.data.replace(/[^\d.,]/g, "");
                else if (value.startsWith(text))
                  value = value.slice(text.length);
                else if (value.endsWith(text))
                  value = value.slice(0, value.length - text.length);
              }
              setText(value.slice(0, 6));
            }}
            style={{ width: `${Math.max(3, text.length || 4)}ch` }}
          />
          <span className={styles.scaleUnit}>{unit}</span>
        </label>
        <button
          type="button"
          className={styles.scaleStep}
          onClick={() => nudge(0.1)}
          aria-label="0.1 more"
        >
          <Plus size={18} />
        </button>
      </div>
      <p className={formStyles.hint} aria-live="polite">
        {!ok && judged
          ? "Check the number: it looks outside the usual range."
          : same
            ? "Same as your last reading."
            : "Weigh at the same time of day, ideally in the morning before breakfast, so readings compare fairly."}
      </p>
      {error && <ErrorNotice message={error} />}
      <button
        type="button"
        className={`btn ${formStyles.go} ${styles.save}`}
        data-busy={saving}
        disabled={!ok || saving}
        onClick={save}
      >
        <span>
          {saving
            ? "Saving"
            : ok
              ? `Save ${formatWeight(kg, unit, 1)}`
              : "Save"}
        </span>
        <span className="well" aria-hidden="true">
          {saving ? (
            <i className={formStyles.spin} />
          ) : (
            <ArrowRight size={18} />
          )}
        </span>
      </button>
    </div>
  );
}
