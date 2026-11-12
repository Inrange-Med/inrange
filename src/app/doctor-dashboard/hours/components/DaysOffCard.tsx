"use client";

/*
  Days off: the whole days ahead the doctor is away (today onward), each with Remove, and a native
  date field to add one. A day off closes every open time that day; booked consultations stay.
*/

import { useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import { useToast } from "@/components/ui/ToastProvider";
import { errorMessage } from "@/lib/http/apiClient";
import {
  combineDateAndTime,
  shortDate,
  toApiDate,
  weekdayShort,
} from "@/lib/format/dateTime";
import { addDayOff, removeDayOff } from "@/services/doctorPortalService";
import type { DoctorAvailability } from "@/types/doctor";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "../HoursPage.module.css";

/** "Thu 12 Nov" for "2026-11-12", read at noon India time so the day never slips. */
function dayWords(day: string) {
  const iso = combineDateAndTime(day, "12:00");
  return `${weekdayShort(iso)} ${shortDate(iso)}`;
}

export default function DaysOffCard({
  daysOff,
  onChanged,
}: {
  daysOff: string[];
  onChanged: (availability: DoctorAvailability) => void;
}) {
  const toast = useToast();
  const [picked, setPicked] = useState("");
  // the day being added or removed, so only its control waits
  const [busyDay, setBusyDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = toApiDate(new Date());

  const run = async (
    day: string,
    change: (day: string) => Promise<DoctorAvailability>,
    done: string,
  ) => {
    if (busyDay) return;
    setBusyDay(day);
    setError(null);
    try {
      onChanged(await change(day));
      toast(done);
      return true;
    } catch (caught) {
      setError(errorMessage(caught));
      return false;
    } finally {
      setBusyDay(null);
    }
  };

  const adding = picked !== "" && busyDay === picked;

  const add = async () => {
    if (!picked) return setError("Choose a day.");
    if (picked < today) return setError("Choose today or a later day.");
    if (daysOff.includes(picked)) return setError("That day is already off.");
    if (await run(picked, addDayOff, "Day off added")) setPicked("");
  };

  return (
    <section className={clinicStyles.panel} aria-labelledby="days-off-h">
      <div className={clinicStyles.panelHead}>
        <h2 id="days-off-h" className={clinicStyles.h2}>
          Days off
        </h2>
        <span className={`${clinicStyles.count} num`}>{daysOff.length}</span>
      </div>

      {daysOff.length ? (
        <ul className={styles.offList}>
          {daysOff.map((day) => (
            <li key={day}>
              <span className="num">{dayWords(day)}</span>
              <button
                type="button"
                className={clinicStyles.textBtn}
                aria-label={`Remove day off on ${dayWords(day)}`}
                aria-busy={busyDay === day}
                disabled={busyDay !== null}
                onClick={() => run(day, removeDayOff, "Day off removed")}
              >
                {busyDay === day ? "Removing" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={clinicStyles.empty}>No days off ahead.</p>
      )}

      <form
        className={styles.addOff}
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <label className={formStyles.field}>
          <span className={formStyles.label}>Add a day off</span>
          <input
            type="date"
            className={formStyles.input}
            min={today}
            value={picked}
            onChange={(event) => {
              setError(null);
              setPicked(event.target.value);
            }}
          />
        </label>
        <button
          type="submit"
          className={`btn btn--ghost ${styles.addBtn}`}
          data-busy={adding}
          aria-busy={adding}
        >
          {/* the label keeps the button's width while the spinner sits over it */}
          <span data-hidden={adding}>Add</span>
          {adding && <i className={formStyles.spin} aria-label="Adding" />}
        </button>
      </form>

      {error && <ErrorNotice message={error} />}
    </section>
  );
}
