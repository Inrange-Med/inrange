"use client";

/*
  Today (doctor portal v2 PRD, 17 Nov 2026 call: "lay everything out on the plate"). Two things, top to
  bottom:
  - Do this now: anything waiting on the doctor from any date: an open call, a prescription not written,
    one not sent. The first gets the filled button; an open call also offers Write prescription.
  - Consultations: one day's list (arrows, Today, Pick date change only this list), each with its state in
    words and one button.
  It refreshes every half minute and when the doctor comes back from the call tab, so a call opening or a
  prescription sent shows without a reload. Data: GET /api/doctor/consultations?date= (consultationService).
  The old Today (next patient card, waiting queue) stays in this folder for the back office.
*/

import { useEffect, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import DatePicker from "@/components/ui/DatePicker";
import ErrorNotice from "@/components/ui/ErrorNotice";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import { useNow } from "@/hooks/useNow";
import {
  combineDateAndTime,
  toApiDate,
  weekdayDayMonth,
} from "@/lib/format/dateTime";
import { getConsultationDay } from "@/services/consultationService";
import ClinicSkeleton from "../ClinicSkeleton";
import ConsultationRow, {
  consultationListClass,
} from "../consultations/ConsultationRow";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "./TodayView.module.css";

/** "2026-11-18" moved by whole days, on India's calendar. */
const shiftDate = (date: string, days: number) =>
  toApiDate(
    new Date(Date.parse(combineDateAndTime(date, "12:00")) + days * 86_400_000),
  );

const dayTitle = (date: string) =>
  weekdayDayMonth.format(new Date(combineDateAndTime(date, "12:00")));

export default function TodayView() {
  const now = useNow(30_000);
  const today = toApiDate(new Date(now));
  const [date, setDate] = useState(today);
  const day = useApiResource(`doctor-consultations-${date}`, () =>
    getConsultationDay(date),
  );
  const { reload } = day;

  // fresh every half minute (a call opening) and on coming back from the call tab
  useEffect(() => {
    reload();
  }, [now, reload]);
  useEffect(() => {
    const back = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, [reload]);

  const head = (
    <PageHead
      className={clinicStyles.pageHead}
      title="Today"
      sub={dayTitle(today)}
    />
  );
  if (day.error && !day.data) {
    return (
      <main className={`${clinicStyles.page} ${styles.page}`}>
        {head}
        <ErrorNotice message={day.error} onRetry={reload} />
      </main>
    );
  }
  if (!day.data) {
    return (
      <main className={`${clinicStyles.page} ${styles.page}`}>
        {head}
        <ClinicSkeleton titled={false} />
      </main>
    );
  }

  const waiting = day.data.waiting;
  const list = day.data.date === date ? day.data.day : null;

  return (
    <main className={`${clinicStyles.page} ${styles.page}`}>
      {head}

      <section className={clinicStyles.panel} aria-labelledby="now-heading">
        <div className={clinicStyles.panelHead}>
          <h2 id="now-heading" className={clinicStyles.h2}>
            Do this now
          </h2>
          {waiting.length > 0 && (
            <span className={`${clinicStyles.count} num`}>
              {waiting.length}
            </span>
          )}
        </div>
        {waiting.length === 0 ? (
          <p className={clinicStyles.empty}>
            Nothing is waiting on you. Calls that open and prescriptions to
            write or send appear here.
          </p>
        ) : (
          <ol className={consultationListClass}>
            {waiting.map((row, index) => (
              <li key={row.id}>
                <ConsultationRow
                  row={row}
                  withDay
                  lead={index === 0}
                  onChanged={reload}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={clinicStyles.panel} aria-labelledby="day-heading">
        <div className={styles.dayHead}>
          <h2 id="day-heading" className={clinicStyles.h2}>
            Consultations
          </h2>
          <div className={styles.dayNav}>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => setDate(shiftDate(date, -1))}
              aria-label="The day before"
            >
              <CaretLeft size={18} />
            </button>
            <span className={styles.dayName} aria-live="polite">
              {date === today ? `Today, ${dayTitle(date)}` : dayTitle(date)}
            </span>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => setDate(shiftDate(date, 1))}
              aria-label="The day after"
            >
              <CaretRight size={18} />
            </button>
            {date !== today && (
              <button
                type="button"
                className={styles.pick}
                onClick={() => setDate(today)}
              >
                Today
              </button>
            )}
            <DatePicker
              value={date}
              onChange={setDate}
              label="Pick a date"
              className={styles.pick}
            >
              Pick date
            </DatePicker>
          </div>
        </div>
        {!list ? (
          <ClinicSkeleton titled={false} />
        ) : list.length === 0 ? (
          <p className={clinicStyles.empty}>
            {date === today
              ? "No consultations today."
              : "No consultations on this day."}
          </p>
        ) : (
          <ol className={consultationListClass}>
            {list.map((row) => (
              <li key={row.id}>
                <ConsultationRow row={row} onChanged={reload} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
