"use client";

/**
 * Choose a week, a day, then a time; then confirm. Data-agnostic: the page passes `loadSlots`
 * (one day at a time, as inrange's /api/schedule/slots works) and `onConfirm` (the booking call).
 * Used by patient booking, onboarding lab booking and rescheduling. Days and times are India's
 * (lib/format/dateTime), so the calendar matches the backend on a phone in any time zone.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, WarningCircle } from "@phosphor-icons/react";
import { groupIntoWeeks, upcomingOpenDays } from "@/lib/calendar/bookingWeeks";
import {
  clockTime,
  dayOfMonth,
  inIndiaTime,
  relativeDayName,
  spokenDay,
  weekdayDayMonth,
  weekdayShort,
} from "@/lib/format/dateTime";
import { errorMessage } from "@/lib/http/apiClient";
import SegmentedControl from "./SegmentedControl";
import formStyles from "./styles/FormControls.module.css";
import styles from "./SlotPicker.module.css";

/** One bookable time. `id` is whatever the backend needs to book it (inrange: SlotId). */
export type PickableSlot = { id: string; at: string; open: boolean };

const DAY_MS = 864e5;
const SUNDAY_ONLY = [0];
/** Pass as closedWeekdays when every day is bookable (home lab collection). */
export const NO_CLOSED_DAYS: number[] = [];

const DAY_PARTS = [
  { name: "Morning", contains: (hour: number) => hour < 12 },
  { name: "Afternoon", contains: (hour: number) => hour >= 12 && hour < 17 },
  { name: "Evening", contains: (hour: number) => hour >= 17 },
];

/** "7:00", "6:30" on a time chip: the Morning/Afternoon/Evening label above it already says am or pm. */
const chipTime = (date: Date) => {
  const time = clockTime(date).replace(/ [ap]m$/, "");
  return time.includes(":") ? time : `${time}:00`;
};

export default function SlotPicker({
  loadSlots,
  onConfirm,
  confirmLabel = "Book",
  dayCount = 12,
  closedWeekdays = SUNDAY_ONLY,
  note = "Times are India time (IST).",
}: {
  loadSlots: (day: Date) => Promise<PickableSlot[]>;
  onConfirm: (slot: PickableSlot) => Promise<void>;
  confirmLabel?: string;
  dayCount?: number;
  /** Weekdays with no bookings. Consultations close on Sunday; home lab collection runs daily (pass []). */
  closedWeekdays?: number[];
  note?: string;
}) {
  const days = useMemo(
    () => upcomingOpenDays(dayCount, closedWeekdays),
    [dayCount, closedWeekdays],
  );
  const weeks = useMemo(() => groupIntoWeeks(days), [days]);
  const [selectedDay, setSelectedDay] = useState<Date>(days[0]);
  const [loaded, setLoaded] = useState<{
    day: string;
    slots: PickableSlot[];
  } | null>(null);
  const [picked, setPicked] = useState<PickableSlot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedKey = selectedDay.toDateString();
  const slots = loaded?.day === selectedKey ? loaded.slots : null;

  // pages must pass a stable loadSlots (useCallback), or this reloads on every render
  useEffect(() => {
    let live = true;
    loadSlots(selectedDay)
      .then((result) => live && setLoaded({ day: selectedKey, slots: result }))
      .catch((caught) => {
        if (!live) return;
        setLoaded({ day: selectedKey, slots: [] });
        setError(errorMessage(caught));
      });
    return () => {
      live = false;
    };
  }, [selectedDay, selectedKey, loadSlots]);

  const chooseDay = (day: Date) => {
    setSelectedDay(day);
    setPicked(null);
    setError(null);
  };

  const weekIndex = Math.max(
    0,
    weeks.findIndex((week) =>
      week.days.some((day) => day?.toDateString() === selectedKey),
    ),
  );

  const groups = useMemo(
    () =>
      DAY_PARTS.map((part) => ({
        name: part.name,
        slots: (slots ?? []).filter(
          (slot) =>
            slot.open &&
            part.contains(inIndiaTime(new Date(slot.at)).getUTCHours()),
        ),
      })).filter((group) => group.slots.length),
    [slots],
  );

  const confirm = async () => {
    if (!picked || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(picked);
    } catch (caught) {
      setError(errorMessage(caught));
      setPicked(null);
    } finally {
      setBusy(false);
    }
  };

  const chosenAt = picked ? new Date(picked.at) : null;

  return (
    <div className={styles.frame}>
      <div className={styles.wrap}>
        <div className={styles.when}>
          {weeks.length > 1 ? (
            <div className={styles.weeks}>
              <SegmentedControl
                label="Week"
                value={String(weekIndex)}
                options={weeks.map((week, i) => ({
                  value: String(i),
                  label: (
                    <span className={styles.week}>
                      <span className={styles.weekName}>{week.name}</span>
                      <span className={`${styles.weekRange} num`}>
                        {week.range}
                      </span>
                    </span>
                  ),
                }))}
                onChange={(value) => {
                  const first = weeks[Number(value)].days.find(Boolean);
                  if (first) chooseDay(first);
                }}
              />
            </div>
          ) : (
            <p className={styles.weekSolo}>
              {weeks[0].name} <span className="num">{weeks[0].range}</span>
            </p>
          )}

          <div
            className={styles.days}
            role="radiogroup"
            aria-label={`Day, ${weeks[weekIndex].name}`}
            key={weekIndex}
          >
            {weeks[weekIndex].days.map((day, column) =>
              day ? (
                <button
                  key={day.toISOString()}
                  type="button"
                  role="radio"
                  aria-checked={day.toDateString() === selectedKey}
                  aria-label={weekdayDayMonth.format(day)}
                  className={styles.day}
                  onClick={() => chooseDay(day)}
                >
                  <span className={styles.dayName}>
                    {relativeDayName(day.toISOString()) === "Today"
                      ? "Today"
                      : weekdayShort(day.toISOString())}
                  </span>
                  <span className={`${styles.dayNum} num`}>
                    {dayOfMonth(day)}
                  </span>
                </button>
              ) : (
                // a day already gone (or closed): its name and date, faded, so the row still reads as a calendar
                <span
                  key={column}
                  className={`${styles.day} ${styles.past}`}
                  aria-hidden="true"
                >
                  <span className={styles.dayName}>
                    {weekdayShort(
                      new Date(
                        weeks[weekIndex].monday + column * DAY_MS,
                      ).toISOString(),
                    )}
                  </span>
                  <span className={`${styles.dayNum} num`}>
                    {dayOfMonth(
                      new Date(weeks[weekIndex].monday + column * DAY_MS),
                    )}
                  </span>
                </span>
              ),
            )}
          </div>
        </div>

        <div className={styles.pickTime}>
          <div className={styles.times} key={selectedDay.toISOString()}>
            <p className={styles.dayFull}>
              {weekdayDayMonth.format(selectedDay)}
            </p>
            {slots === null &&
              Array.from({ length: 2 }, (_, i) => (
                <div key={i} className={styles.group}>
                  <span className={`${styles.part} ${styles.ghostLine}`} />
                  <div className={styles.grid}>
                    {Array.from({ length: 8 }, (_, chip) => (
                      <span
                        key={chip}
                        className={`${styles.slot} ${styles.ghost}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            {slots !== null && groups.length === 0 && (
              <p className={formStyles.hint}>
                No open times on this day. Try another day.
              </p>
            )}
            {groups.map((group) => (
              <fieldset key={group.name} className={styles.group}>
                <legend className={styles.part}>{group.name}</legend>
                <div className={styles.grid}>
                  {group.slots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      className={styles.slot}
                      aria-pressed={picked?.id === slot.id}
                      aria-label={clockTime(new Date(slot.at))}
                      onClick={() => setPicked(slot)}
                    >
                      <span className="num">{chipTime(new Date(slot.at))}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          {error && (
            <p className={formStyles.err} role="alert">
              <WarningCircle size={16} />
              {error}
            </p>
          )}

          <div className={styles.confirm}>
            <button
              type="button"
              className={`btn ${formStyles.go}`}
              disabled={!picked}
              onClick={confirm}
              data-busy={busy}
              aria-busy={busy}
            >
              <span>
                {busy
                  ? "Booking"
                  : chosenAt
                    ? `${confirmLabel} ${spokenDay(chosenAt)}, ${clockTime(chosenAt)}`
                    : "Choose a time"}
              </span>
              <span className="well" aria-hidden="true">
                {busy ? (
                  <i className={formStyles.spin} />
                ) : (
                  <ArrowRight size={18} />
                )}
              </span>
            </button>
            <p className={`${formStyles.hint} ${styles.note}`}>{note}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
