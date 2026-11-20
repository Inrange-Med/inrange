"use client";

/*
  The prescription's medicines (doctor portal v2 PRD, "Medicines"): each line is one medicine, every choice a
  tap in plain words (19 Nov 2026: no "1-0-0" codes). A brand on the list with several strengths shows them,
  so a dose step-up is one tap. How long is a tap too ("Other" for anything else), and an injection has no
  food choice. New lines start from the search below them (MedicinePicker). A medicine typed by hand is
  marked: it prints, and our team matches it to the list before it can be ordered.
*/

import { useEffect, useState } from "react";
import { Trash } from "@phosphor-icons/react";
import { searchMedicines } from "@/services/consultationService";
import type {
  DurationUnit,
  Frequency,
  Intake,
  ListItem,
  MedicineLine,
} from "@/types/consultation";
import ChoiceChips from "./ChoiceChips";
import MedicinePicker from "./MedicinePicker";
import styles from "./ConsultationPage.module.css";

const FREQUENCIES: { value: Exclude<Frequency, "">; label: string }[] = [
  { value: "1-0-0", label: "Every morning" },
  { value: "0-0-1", label: "Every night" },
  { value: "1-0-1", label: "Morning and night" },
  { value: "1-1-1", label: "Three times a day" },
  { value: "WEEKLY", label: "Once a week" },
  { value: "OTHER", label: "Other" },
];
const DURATIONS: {
  value: string;
  label: string;
  n: number;
  unit: DurationUnit;
}[] = [
  { value: "1w", label: "1 week", n: 1, unit: "WEEKS" },
  { value: "2w", label: "2 weeks", n: 2, unit: "WEEKS" },
  { value: "1m", label: "1 month", n: 1, unit: "MONTHS" },
  { value: "2m", label: "2 months", n: 2, unit: "MONTHS" },
  { value: "3m", label: "3 months", n: 3, unit: "MONTHS" },
];
const UNITS: { value: DurationUnit; label: string }[] = [
  { value: "DAYS", label: "Days" },
  { value: "WEEKS", label: "Weeks" },
  { value: "MONTHS", label: "Months" },
];
const INTAKES: { value: Exclude<Intake, "">; label: string }[] = [
  { value: "BEFORE_FOOD", label: "Before food" },
  { value: "AFTER_FOOD", label: "After food" },
  { value: "EMPTY_STOMACH", label: "Empty stomach" },
];

/** Days, as the server counts them (a month is 30). */
export const daysOf = (n: number, unit: DurationUnit) =>
  n * (unit === "MONTHS" ? 30 : unit === "WEEKS" ? 7 : 1);

let keySeed = 0;
export const newKey = () =>
  `m${Date.now().toString(36)}${(keySeed++).toString(36)}`;

/** A new line from a master-list item (or a name typed by hand), with the usual choices filled in. */
export function lineFrom(item: ListItem | null, typed = ""): MedicineLine {
  const weekly = item ? /week/i.test(item.frequency) : false;
  return {
    key: newKey(),
    medicineId: item?.id ?? null,
    name: item ? item.name : typed.trim(),
    genericName: item?.molecule ?? null,
    brand: item?.brand ?? null,
    form: item?.form ?? "",
    dose: item?.dose ?? "",
    frequency: weekly ? "WEEKLY" : "",
    frequencyOther: "",
    durationValue: 1,
    durationUnit: "MONTHS",
    intake: "",
    unlisted: !item,
  };
}

// one search per brand for the whole page, shared by every line of it
const strengthsOf = new Map<string, Promise<ListItem[]>>();

/** The strengths the list holds for a brand, lowest first; none for a medicine typed by hand. */
function useStrengths(brand: string | null | undefined) {
  const [items, setItems] = useState<ListItem[]>([]);
  useEffect(() => {
    if (!brand) return;
    let live = true;
    let found = strengthsOf.get(brand);
    if (!found) {
      found = searchMedicines(brand)
        .then((r) =>
          r.matches
            .filter((m) => m.brand === brand)
            .sort((a, b) => parseFloat(a.strength) - parseFloat(b.strength)),
        )
        .catch(() => {
          strengthsOf.delete(brand);
          return [];
        });
      strengthsOf.set(brand, found);
    }
    void found.then((list) => live && setItems(list));
    return () => {
      live = false;
    };
  }, [brand]);
  return brand ? items : [];
}

export default function MedicineLines({
  lines,
  onChange,
  problemKey,
  maxDays,
}: {
  lines: MedicineLine[];
  onChange: (lines: MedicineLine[]) => void;
  /** the line the last Create PDF stopped at */
  problemKey?: string | null;
  /** without a plan the prescription is one month: longer choices are not offered */
  maxDays?: number;
}) {
  const update = (key: string, change: Partial<MedicineLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...change } : l)));

  return (
    <div className={styles.medicines}>
      {lines.length > 0 && (
        <ol className={styles.lines}>
          {lines.map((line, index) => (
            <Line
              key={line.key}
              line={line}
              index={index}
              problem={problemKey === line.key}
              maxDays={maxDays}
              onChange={(change) => update(line.key, change)}
              onRemove={() => onChange(lines.filter((l) => l.key !== line.key))}
            />
          ))}
        </ol>
      )}
      <MedicinePicker
        first={lines.length === 0}
        onPick={(item, typed) => onChange([...lines, lineFrom(item, typed)])}
      />
    </div>
  );
}

function Line({
  line,
  index,
  problem,
  maxDays,
  onChange,
  onRemove,
}: {
  line: MedicineLine;
  index: number;
  problem: boolean;
  maxDays?: number;
  onChange: (change: Partial<MedicineLine>) => void;
  onRemove: () => void;
}) {
  const strengths = useStrengths(line.unlisted ? null : line.brand);
  const durations = DURATIONS.filter(
    (d) => !maxDays || daysOf(d.n, d.unit) <= maxDays,
  );
  const days = daysOf(line.durationValue, line.durationUnit);
  const preset = durations.find((d) => daysOf(d.n, d.unit) === days);
  // "Other" shows the number and the unit; a length that is not a choice opens on it
  const [custom, setCustom] = useState(!preset);
  const injection = /inject/i.test(line.form ?? "");

  return (
    <li className={styles.line} data-problem={problem || undefined}>
      <div className={styles.lineHead}>
        <span className={`${styles.lineNo} num`}>{index + 1}</span>
        <span className={styles.lineName}>
          <strong>{line.name}</strong>
          {line.genericName && <span>{line.genericName}</span>}
          {line.unlisted && (
            <span className={styles.unlisted}>
              Not on the list: it prints, and our team matches it before it can
              be ordered
            </span>
          )}
        </span>
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          aria-label={`Remove ${line.name}`}
        >
          <Trash size={16} aria-hidden="true" />
          <span>Remove</span>
        </button>
      </div>

      <div className={styles.lineGrid}>
        {strengths.length > 1 && (
          <div className={styles.lineField}>
            <span className={styles.lineLabel}>Strength</span>
            <ChoiceChips
              label="Strength"
              value={line.medicineId ?? ""}
              options={strengths.map((s) => ({
                value: s.id,
                label: s.strength,
              }))}
              onChange={(id) => {
                const s = strengths.find((x) => x.id === id);
                if (s)
                  onChange({
                    medicineId: s.id,
                    name: s.name,
                    genericName: s.molecule,
                    brand: s.brand,
                    form: s.form,
                    unlisted: false,
                  });
              }}
            />
          </div>
        )}

        <label className={styles.lineField}>
          <span className={styles.lineLabel}>Dose</span>
          <input
            className={styles.smallInput}
            value={line.dose}
            maxLength={60}
            placeholder="1 tablet"
            onChange={(e) => onChange({ dose: e.target.value })}
          />
        </label>

        <div className={styles.lineField}>
          <span className={styles.lineLabel}>How often</span>
          <ChoiceChips
            label="How often"
            value={line.frequency}
            options={FREQUENCIES}
            onChange={(frequency) => onChange({ frequency })}
          />
          {line.frequency === "OTHER" && (
            <input
              className={styles.smallInput}
              value={line.frequencyOther}
              maxLength={80}
              placeholder="For example, every other day"
              aria-label="How often, in words"
              autoFocus
              onChange={(e) => onChange({ frequencyOther: e.target.value })}
            />
          )}
        </div>

        <div className={styles.lineField}>
          <span className={styles.lineLabel}>For how long</span>
          <ChoiceChips
            label="For how long"
            value={custom || !preset ? "other" : preset.value}
            options={[
              ...durations.map((d) => ({ value: d.value, label: d.label })),
              { value: "other", label: "Other" },
            ]}
            onChange={(value) => {
              if (value === "other") return setCustom(true);
              const d = durations.find((x) => x.value === value);
              if (!d) return;
              setCustom(false);
              onChange({ durationValue: d.n, durationUnit: d.unit });
            }}
          />
          {(custom || !preset) && (
            <div className={styles.forRow}>
              <input
                className={`${styles.smallInput} ${styles.number} num`}
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={line.durationValue || ""}
                aria-label="How long, a number"
                onChange={(e) =>
                  onChange({
                    durationValue: Math.max(
                      0,
                      Math.min(365, Math.round(Number(e.target.value) || 0)),
                    ),
                  })
                }
              />
              <ChoiceChips
                label="How long, in"
                value={line.durationUnit}
                options={UNITS}
                onChange={(unit) => unit && onChange({ durationUnit: unit })}
              />
            </div>
          )}
        </div>

        {!injection && (
          <div className={styles.lineField}>
            <span className={styles.lineLabel}>Take it</span>
            <ChoiceChips
              label="Take it"
              value={line.intake}
              options={INTAKES}
              onChange={(intake) => onChange({ intake })}
            />
          </div>
        )}
      </div>
    </li>
  );
}
