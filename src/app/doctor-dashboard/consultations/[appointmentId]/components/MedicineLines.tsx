"use client";

/*
  The prescription's medicines (doctor portal v2 PRD, "Medicines"): each line is one medicine with tap
  choices for how often, for how long and with food; the dose comes filled in from the master list. New
  lines start from the search below them (MedicinePicker). A medicine typed by hand is marked: it prints,
  and our team matches it to the list before it can be ordered.
*/

import { Trash } from "@phosphor-icons/react";
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
  { value: "1-0-0", label: "1-0-0" },
  { value: "0-0-1", label: "0-0-1" },
  { value: "1-0-1", label: "1-0-1" },
  { value: "1-1-1", label: "1-1-1" },
  { value: "WEEKLY", label: "Once a week" },
  { value: "OTHER", label: "Other" },
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
    dose: item?.dose ?? "",
    frequency: weekly ? "WEEKLY" : "",
    frequencyOther: "",
    durationValue: weekly ? 1 : 30,
    durationUnit: weekly ? "MONTHS" : "DAYS",
    intake: "",
    unlisted: !item,
  };
}

export default function MedicineLines({
  lines,
  onChange,
  problemKey,
}: {
  lines: MedicineLine[];
  onChange: (lines: MedicineLine[]) => void;
  /** the line the last Create PDF stopped at */
  problemKey?: string | null;
}) {
  const update = (key: string, change: Partial<MedicineLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...change } : l)));

  return (
    <div className={styles.medicines}>
      {lines.length > 0 && (
        <ol className={styles.lines}>
          {lines.map((line, index) => (
            <li
              key={line.key}
              className={styles.line}
              data-problem={problemKey === line.key || undefined}
            >
              <div className={styles.lineHead}>
                <span className={`${styles.lineNo} num`}>{index + 1}</span>
                <span className={styles.lineName}>
                  <strong>{line.name}</strong>
                  {line.genericName && <span>{line.genericName}</span>}
                  {line.unlisted && (
                    <span className={styles.unlisted}>
                      Not on the list: it prints, and our team matches it before
                      it can be ordered
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() =>
                    onChange(lines.filter((l) => l.key !== line.key))
                  }
                  aria-label={`Remove ${line.name}`}
                >
                  <Trash size={16} aria-hidden="true" />
                  <span>Remove</span>
                </button>
              </div>

              <div className={styles.lineGrid}>
                <label className={styles.lineField}>
                  <span className={styles.lineLabel}>Dose</span>
                  <input
                    className={styles.smallInput}
                    value={line.dose}
                    maxLength={60}
                    placeholder="1 tablet"
                    onChange={(e) => update(line.key, { dose: e.target.value })}
                  />
                </label>

                <div className={styles.lineField}>
                  <span className={styles.lineLabel} id={`${line.key}-often`}>
                    How often
                  </span>
                  <ChoiceChips
                    label="How often"
                    value={line.frequency}
                    options={FREQUENCIES}
                    onChange={(frequency) => update(line.key, { frequency })}
                  />
                  {line.frequency === "OTHER" && (
                    <input
                      className={styles.smallInput}
                      value={line.frequencyOther}
                      maxLength={80}
                      placeholder="For example, every other day"
                      aria-label="How often, in words"
                      autoFocus
                      onChange={(e) =>
                        update(line.key, { frequencyOther: e.target.value })
                      }
                    />
                  )}
                </div>

                <div className={styles.lineField}>
                  <span className={styles.lineLabel}>For</span>
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
                        update(line.key, {
                          durationValue: Math.max(
                            0,
                            Math.min(
                              365,
                              Math.round(Number(e.target.value) || 0),
                            ),
                          ),
                        })
                      }
                    />
                    <ChoiceChips
                      label="How long, in"
                      value={line.durationUnit}
                      options={UNITS}
                      onChange={(unit) =>
                        unit && update(line.key, { durationUnit: unit })
                      }
                    />
                  </div>
                </div>

                <div className={styles.lineField}>
                  <span className={styles.lineLabel}>Take</span>
                  <ChoiceChips
                    label="Take it"
                    value={line.intake}
                    options={INTAKES}
                    onChange={(intake) => update(line.key, { intake })}
                  />
                </div>
              </div>
            </li>
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
