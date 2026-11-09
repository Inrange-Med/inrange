"use client";

/*
  Weekly hours: Monday to Sunday, each open or closed, with one or more time ranges in half hours
  (06:00 to 22:00). A doctor who has never saved sees the default week filled in, ready to change.
  The same rules as the backend are checked before saving: each range ends after it starts and no
  two on a day overlap. At least one day stays open, since an empty week means the default again.
*/

import { useState } from "react";
import { ArrowRight, CaretDown, Plus, X } from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import { useToast } from "@/components/ui/ToastProvider";
import { errorMessage } from "@/lib/http/apiClient";
import { saveWeeklyHours } from "@/services/doctorPortalService";
import type { DoctorAvailability, WorkingRange } from "@/types/doctor";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "../HoursPage.module.css";

type Range = { start: string; end: string };
type Day = { on: boolean; ranges: Range[] };

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** The week every doctor has until they save their own (the backend's default timetable). */
const DEFAULT_RANGES: Range[] = [
  { start: "10:00", end: "13:00" },
  { start: "15:00", end: "19:00" },
];

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};
const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const FIRST = toMinutes("06:00");
const LAST = toMinutes("22:00");
const TIMES = Array.from({ length: (LAST - FIRST) / 30 + 1 }, (_, index) =>
  toTime(FIRST + index * 30),
);

const byStart = (first: Range, second: Range) =>
  first.start.localeCompare(second.start);

function daysFrom(availability: DoctorAvailability): Day[] {
  return DAY_NAMES.map((_, index) => {
    if (availability.usesDefault)
      return { on: index < 6, ranges: index < 6 ? [...DEFAULT_RANGES] : [] };
    const ranges = availability.weekly
      .filter((range) => range.weekday === index + 1)
      .map(({ start, end }) => ({ start, end }));
    return { on: ranges.length > 0, ranges };
  });
}

const weeklyFrom = (days: Day[]): WorkingRange[] =>
  days.flatMap((day, index) =>
    day.on
      ? [...day.ranges]
          .sort(byStart)
          .map((range) => ({ weekday: index + 1, ...range }))
      : [],
  );

/** The first rule the week breaks, in words, or null when it can be saved. */
function problemIn(days: Day[]): string | null {
  if (!days.some((day) => day.on && day.ranges.length))
    return "Keep at least one day open. For time away, add days off.";
  for (const [index, day] of days.entries()) {
    if (!day.on) continue;
    const sorted = [...day.ranges].sort(byStart);
    if (sorted.some((range) => range.end <= range.start))
      return `${DAY_NAMES[index]}: each range has to end after it starts.`;
    if (sorted.some((range, at) => at > 0 && range.start < sorted[at - 1].end))
      return `${DAY_NAMES[index]}: two ranges overlap.`;
  }
  return null;
}

/** The next range after a day's last one: an hour long, or null when the day is full. */
function nextRange(ranges: Range[]): Range | null {
  if (!ranges.length) return DEFAULT_RANGES[0];
  const from = Math.max(...ranges.map((range) => toMinutes(range.end)));
  if (from >= LAST) return null;
  return { start: toTime(from), end: toTime(Math.min(from + 60, LAST)) };
}

function TimeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  // a time saved outside the list (set by an admin) still shows as it is
  const options = TIMES.includes(value) ? TIMES : [...TIMES, value].sort();
  return (
    <span className={styles.time}>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((time) => (
          <option key={time} value={time}>
            {time}
          </option>
        ))}
      </select>
      <CaretDown size={14} weight="bold" aria-hidden="true" />
    </span>
  );
}

export default function WeeklyHoursCard({
  availability,
  onSaved,
}: {
  availability: DoctorAvailability;
  onSaved: (availability: DoctorAvailability) => void;
}) {
  const toast = useToast();
  const [days, setDays] = useState(() => daysFrom(availability));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saved = availability.usesDefault ? [] : availability.weekly;
  const changed = JSON.stringify(weeklyFrom(days)) !== JSON.stringify(saved);

  const updateDay = (index: number, change: (day: Day) => Day) => {
    setError(null);
    setDays((current) =>
      current.map((day, at) => (at === index ? change(day) : day)),
    );
  };

  const save = async () => {
    if (busy) return;
    const problem = problemIn(days);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      onSaved(await saveWeeklyHours(weeklyFrom(days)));
      toast("Hours saved");
    } catch (caught) {
      setError(errorMessage(caught, "The hours were not saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={clinicStyles.panel} aria-labelledby="weekly-hours-h">
      <div className={clinicStyles.panelHead}>
        <h2 id="weekly-hours-h" className={clinicStyles.h2}>
          Weekly hours
        </h2>
      </div>

      {availability.usesDefault && (
        <p className={clinicStyles.muted}>
          You are on the standard week: Monday to Saturday, 10:00 to 13:00 and
          15:00 to 19:00. Change it below and save.
        </p>
      )}

      <ul className={styles.week}>
        {days.map((day, index) => {
          const name = DAY_NAMES[index];
          const next = nextRange(day.ranges);
          return (
            <li key={name} className={styles.day} data-on={day.on}>
              <button
                type="button"
                role="switch"
                aria-checked={day.on}
                className={styles.switch}
                onClick={() =>
                  updateDay(index, (current) => ({
                    on: !current.on,
                    ranges:
                      !current.on && !current.ranges.length
                        ? [DEFAULT_RANGES[0]]
                        : current.ranges,
                  }))
                }
              >
                <span className={styles.knob} aria-hidden="true" />
                {name}
              </button>

              {day.on ? (
                <div className={styles.ranges}>
                  {day.ranges.map((range, at) => (
                    <div key={at} className={styles.range}>
                      <TimeSelect
                        label={`${name}, range ${at + 1}, starts`}
                        value={range.start}
                        onChange={(start) =>
                          updateDay(index, (current) => ({
                            ...current,
                            ranges: current.ranges.map((item, i) =>
                              i === at ? { ...item, start } : item,
                            ),
                          }))
                        }
                      />
                      <span className={styles.to}>to</span>
                      <TimeSelect
                        label={`${name}, range ${at + 1}, ends`}
                        value={range.end}
                        onChange={(end) =>
                          updateDay(index, (current) => ({
                            ...current,
                            ranges: current.ranges.map((item, i) =>
                              i === at ? { ...item, end } : item,
                            ),
                          }))
                        }
                      />
                      <button
                        type="button"
                        className={clinicStyles.iconBtn}
                        aria-label={`Remove ${range.start} to ${range.end} on ${name}`}
                        onClick={() =>
                          updateDay(index, (current) => {
                            const ranges = current.ranges.filter(
                              (_, i) => i !== at,
                            );
                            // the last range gone closes the day
                            return { on: ranges.length > 0, ranges };
                          })
                        }
                      >
                        <X size={16} weight="bold" />
                      </button>
                    </div>
                  ))}
                  {next && (
                    <button
                      type="button"
                      className={clinicStyles.textBtn}
                      aria-label={`Add a range on ${name}`}
                      onClick={() =>
                        updateDay(index, (current) => ({
                          ...current,
                          ranges: [...current.ranges, next],
                        }))
                      }
                    >
                      <Plus size={16} weight="bold" aria-hidden="true" />
                      Add a range
                    </button>
                  )}
                </div>
              ) : (
                <p className={clinicStyles.muted}>Closed</p>
              )}
            </li>
          );
        })}
      </ul>

      {error && <ErrorNotice message={error} />}

      <button
        type="button"
        className={`btn ${formStyles.go} ${styles.save}`}
        onClick={save}
        disabled={!changed && !busy}
        data-busy={busy}
        aria-busy={busy}
      >
        <span>{busy ? "Saving" : "Save hours"}</span>
        <span className="well" aria-hidden="true">
          {busy ? <i className={formStyles.spin} /> : <ArrowRight size={18} />}
        </span>
      </button>
    </section>
  );
}
