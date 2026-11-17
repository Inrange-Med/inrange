"use client";

/**
 * "Your doses" on Care, for patients on a plan once a delivery has arrived: the dose due today (Taken,
 * or Skip with a reason), else the next one, the last few, and the reminder's day and time. The same
 * reminder comes on WhatsApp when it is on; both log to the same place, so a dose logged in one never
 * asks again in the other. Side effects tell the care team, who call (the answer says when).
 * Data: GET /api/care/doses (carePlanService). Docs: docs/backend/medicine-flow.md.
 */

import { useState } from "react";
import { ArrowRight, Check } from "@phosphor-icons/react";
import Card from "@/components/ui/Card";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Sheet from "@/components/ui/Sheet";
import {
  clockTime,
  relativeDayName,
  shortDate,
  toApiDate,
} from "@/lib/format/dateTime";
import type { DoseEvent, Doses, DoseSchedule } from "@/types/carePlan";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import pageStyles from "../CarePage.module.css";
import styles from "./DosesCard.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LONG_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const REASONS = [
  { code: "UNWELL", label: "Not feeling well" },
  { code: "FORGOT", label: "Forgot" },
  { code: "SIDE_EFFECTS", label: "Side effects" },
  { code: "OTHER", label: "Something else" },
] as const;
const DONE_WORDS = {
  TAKEN: "Taken",
  TAKEN_LATE: "Taken late",
  SKIPPED: "Skipped",
  MISSED: "Missed",
} as const;
// every half hour from 6 am to 11 pm
const TIMES = Array.from(
  { length: 35 },
  (_, i) =>
    `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);
const clockOf = (hhmm: string) =>
  clockTime(new Date(`2026-01-01T${hhmm}:00+05:30`));

/** "Today, 9 am", "Tomorrow, 8:30 pm", "Sun 23 Nov, 9 am" */
const dueLine = (iso: string) => {
  const day = relativeDayName(iso);
  return `${day === "Today" || day === "Tomorrow" ? day : `${day} ${shortDate(iso)}`}, ${clockTime(new Date(iso))}`;
};

function rhythm(s: DoseSchedule) {
  const times = s.times.map(clockOf).join(" and ");
  if (s.cadence === "WEEKLY")
    return `Every ${s.weekday ? LONG_DAYS[s.weekday - 1] : "week"} at ${times}`;
  return `Every day at ${times}`;
}

export type DoseActions = {
  log: (
    eventId: string,
    status: "TAKEN" | "SKIPPED",
    reason?: string,
  ) => Promise<string>;
  change: (
    scheduleId: string,
    change: { weekday?: number; time?: string; paused?: boolean },
  ) => Promise<void>;
};

function ReminderSheet({
  schedule,
  open,
  onClose,
  onSave,
}: {
  schedule: DoseSchedule;
  open: boolean;
  onClose: () => void;
  onSave: DoseActions["change"];
}) {
  const [weekday, setWeekday] = useState(String(schedule.weekday ?? 1));
  const [time, setTime] = useState(schedule.times[0] ?? "09:00");
  const [paused, setPaused] = useState(schedule.paused);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <Sheet open={open} onClose={onClose} title="Dose reminder">
      <div className={pageStyles.sheetBody}>
        <p className={pageStyles.sheetMeta}>
          {schedule.medicine}. Your doctor sets the dose; this only moves the
          reminder.
        </p>
        {schedule.cadence === "WEEKLY" && (
          <div className={formStyles.field}>
            <span className={formStyles.label} id="dose-day">
              Day
            </span>
            <div className={styles.days}>
              <SegmentedControl
                label="Day of the week"
                value={weekday}
                options={WEEKDAYS.map((d, i) => ({
                  value: String(i + 1),
                  label: d,
                }))}
                onChange={setWeekday}
              />
            </div>
          </div>
        )}
        <label className={formStyles.field}>
          <span className={formStyles.label}>
            {schedule.cadence === "TWICE_DAILY"
              ? "Morning time (the evening one is 12 hours on)"
              : "Time"}
          </span>
          <select
            className={styles.select}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          >
            {TIMES.map((t) => (
              <option key={t} value={t}>
                {clockOf(t)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.tick}>
          <input
            type="checkbox"
            checked={paused}
            onChange={(e) => setPaused(e.target.checked)}
          />
          <span>Pause reminders for now</span>
        </label>
        {problem && (
          <p className={formStyles.err} role="alert">
            {problem}
          </p>
        )}
        <button
          type="button"
          className={`btn ${formStyles.go}`}
          data-busy={busy}
          aria-busy={busy}
          disabled={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setProblem(null);
            try {
              await onSave(schedule.id, {
                ...(schedule.cadence === "WEEKLY"
                  ? { weekday: Number(weekday) }
                  : {}),
                time,
                paused,
              });
              onClose();
            } catch (caught) {
              setProblem(
                caught instanceof Error
                  ? caught.message
                  : "That was not saved. Try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <span>{busy ? "Saving" : "Save"}</span>
          <span className="well" aria-hidden="true">
            {busy ? (
              <i className={formStyles.spin} />
            ) : (
              <ArrowRight size={18} />
            )}
          </span>
        </button>
      </div>
    </Sheet>
  );
}

export default function DosesCard({
  doses,
  now,
  actions,
}: {
  doses: Doses;
  now: number;
  actions: DoseActions;
}) {
  const [skipping, setSkipping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [editing, setEditing] = useState<DoseSchedule | null>(null);
  // the sheet stays mounted on the last schedule opened, so closing it animates and returns focus;
  // each opening starts from the saved values (`opened` remounts it)
  const [sheetFor, setSheetFor] = useState<DoseSchedule | null>(null);
  const [opened, setOpened] = useState(0);
  const edit = (schedule: DoseSchedule) => {
    setEditing(schedule);
    setSheetFor(schedule);
    setOpened((n) => n + 1);
  };
  const live = doses.schedules.filter(
    (s) => !s.endsOn || s.endsOn >= toApiDate(new Date(now)),
  );
  if (!live.length) return null;

  // due now: a dose whose time has come (or comes within the hour) and was not logged, from the last day
  const dueNow =
    doses.events
      .filter(
        (e) =>
          e.status === "DUE" &&
          new Date(e.dueAt).getTime() <= now + 3600_000 &&
          new Date(e.dueAt).getTime() > now - 86400_000,
      )
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0] ?? null;
  const upcoming =
    doses.events
      .filter(
        (e) =>
          e.status === "DUE" && new Date(e.dueAt).getTime() > now + 3600_000,
      )
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0] ?? null;
  const recent = doses.events.filter((e) => e.status !== "DUE").slice(0, 4);

  const log = async (
    event: DoseEvent,
    status: "TAKEN" | "SKIPPED",
    reason?: string,
  ) => {
    setBusy(true);
    try {
      setSaid(await actions.log(event.id, status, reason));
      setSkipping(false);
    } catch (caught) {
      setSaid(
        caught instanceof Error
          ? caught.message
          : "That was not saved. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Your doses" id="doses" className={pageStyles.card}>
      {dueNow ? (
        <div className={styles.due}>
          <p className={styles.dueLine}>
            <strong>{dueNow.medicine}</strong>
            <span className="num">
              Due {dueLine(dueNow.dueAt).replace(/^Today, /, "today, ")}
            </span>
          </p>
          {!skipping ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={`btn ${formStyles.go}`}
                disabled={busy}
                onClick={() => log(dueNow, "TAKEN")}
              >
                <span>Taken</span>
                <span className="well" aria-hidden="true">
                  {busy ? (
                    <i className={formStyles.spin} />
                  ) : (
                    <Check size={18} weight="bold" />
                  )}
                </span>
              </button>
              <button
                type="button"
                className={`btn btn--ghost ${styles.secondary}`}
                disabled={busy}
                onClick={() => setSkipping(true)}
              >
                Skip this one
              </button>
            </div>
          ) : (
            <div
              className={styles.reasons}
              role="group"
              aria-label="Why skip it"
            >
              <p className={pageStyles.text}>What got in the way?</p>
              <div className={styles.reasonList}>
                {REASONS.map((r) => (
                  <button
                    key={r.code}
                    type="button"
                    className={`btn btn--ghost ${styles.reason}`}
                    disabled={busy}
                    onClick={() => log(dueNow, "SKIPPED", r.code)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        upcoming && (
          <p className={pageStyles.text}>
            Next dose: <span className="num">{dueLine(upcoming.dueAt)}</span>
          </p>
        )
      )}
      {said && (
        <p className={pageStyles.foot} role="status">
          {said}
        </p>
      )}

      <ul className={styles.list}>
        {live.map((s) => (
          <li key={s.id} className={styles.schedule}>
            <span>
              <strong>{s.medicine}</strong>
              <span className="num">
                {s.paused ? "Reminders paused" : rhythm(s)}
              </span>
            </span>
            <button
              type="button"
              className={styles.change}
              onClick={() => edit(s)}
            >
              Change
            </button>
          </li>
        ))}
      </ul>

      {recent.length > 0 && (
        <p className={`${pageStyles.foot} num`}>
          {recent
            .map(
              (e) =>
                `${DONE_WORDS[e.status as keyof typeof DONE_WORDS]} ${shortDate(e.dueAt)}`,
            )
            .join(". ")}
          .
        </p>
      )}

      {sheetFor && (
        <ReminderSheet
          key={`${sheetFor.id}-${opened}`}
          schedule={sheetFor}
          open={editing !== null}
          onClose={() => setEditing(null)}
          onSave={actions.change}
        />
      )}
    </Card>
  );
}
