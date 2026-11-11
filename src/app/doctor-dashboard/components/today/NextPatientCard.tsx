/*
  Today's lead plate (Arhaan's "Next" card): who is next, when, why, a four-line brief from their
  record, and Start consultation from ten minutes before the start (as the patient's Join is).
  The brief needs the patient record endpoint; until the backend has it, the plate shows without it.
*/

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import ContourField from "@/components/ui/ContourField";
import { clockTime, weekdayDayMonth } from "@/lib/format/dateTime";
import type { Appointment } from "@/types/appointment";
import type { PatientRecord } from "@/types/patientRecord";
import NextPatientBrief from "./NextPatientBrief";
import styles from "./NextPatientCard.module.css";

const OPENS_BEFORE_MS = 10 * 6e4;

export default function NextPatientCard({
  appointment,
  record,
  inProgress,
  notToday,
  now,
  className,
}: {
  appointment: Appointment;
  record: PatientRecord | null;
  inProgress: boolean;
  notToday: boolean;
  now: number;
  /** where the plate sits in the Today grid */
  className: string;
}) {
  const startsAt = new Date(appointment.startsAt);
  const opensAt = startsAt.getTime() - OPENS_BEFORE_MS;
  const minutes = Math.round((startsAt.getTime() - now) / 6e4);
  return (
    <section
      className={`${styles.plate} ${className}`}
      aria-labelledby="next-patient-heading"
    >
      <ContourField
        className={styles.field}
        density={9}
        lineAlpha={0.1}
        signalAlpha={0.34}
        seed={9}
        interactive={false}
      />
      <p className={styles.kicker}>
        {inProgress ? "In progress" : notToday ? "Next working day" : "Next"}
        <span className={styles.until}>
          {inProgress
            ? "now"
            : notToday
              ? `${weekdayDayMonth.format(startsAt)}, ${clockTime(startsAt)}`
              : minutes < 60
                ? `in ${Math.max(0, minutes)} min`
                : `at ${clockTime(startsAt)}`}
        </span>
      </p>
      <h2 id="next-patient-heading" className={styles.title}>
        {appointment.patientName}
        <span className={styles.visitKind}>
          {" "}
          {appointment.visitType === "FIRST"
            ? "first consultation"
            : appointment.visitType === "FOLLOW_UP"
              ? "follow-up"
              : "video consultation"}
        </span>
      </h2>
      {appointment.reason && (
        <p className={styles.reason}>{appointment.reason}</p>
      )}
      {record && <NextPatientBrief record={record} />}
      <div className={styles.actions}>
        {now >= opensAt ? (
          <Link
            href={`/consultation/${appointment.id}`}
            className="btn btn--signal"
          >
            <span>Start consultation</span>
            <span className="well" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </Link>
        ) : (
          <span className={styles.opensAt}>
            Start opens at{" "}
            <span className="num">{clockTime(new Date(opensAt))}</span>
          </span>
        )}
        {appointment.patientId && (
          <Link
            href={`/doctor-dashboard/patients/${appointment.patientId}?from=today`}
            className="btn btn--ghost-dark"
          >
            Open record
          </Link>
        )}
      </div>
    </section>
  );
}
