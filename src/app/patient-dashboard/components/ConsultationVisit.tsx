"use client";

/**
 * One booked consultation: when, with whom, and its actions. Join replaces "Test camera and mic"
 * once the call is open (10 minutes before). Change time and Message only show when the page
 * passes them (they need the doctor's id).
 */

import Link from "next/link";
import { ArrowRight, CalendarPlus } from "@phosphor-icons/react";
import { downloadConsultationIcs } from "@/lib/calendar/consultationIcs";
import {
  consultationMinutes,
  visitDay,
} from "@/lib/consultations/consultationTime";
import { clockTime, isCallJoinable } from "@/lib/format/dateTime";
import type { Appointment } from "@/types/appointment";
import styles from "./ConsultationVisit.module.css";

export default function ConsultationVisit({
  appointment,
  now,
  onCheckDevices,
  onChangeTime,
  messageHref,
}: {
  appointment: Appointment;
  now: number;
  onCheckDevices: () => void;
  onChangeTime?: () => void;
  messageHref?: string;
}) {
  const minutes = consultationMinutes(appointment);
  const callOpen = isCallJoinable(appointment.startsAt, minutes, now);
  return (
    <div className={styles.visit}>
      <div className={styles.visitText}>
        <p className={styles.visitWhat}>
          Consultation with {appointment.doctorName}
        </p>
        <p className={styles.visitWhen}>
          {visitDay(appointment.startsAt)},{" "}
          <span className="num">
            {clockTime(new Date(appointment.startsAt))}
          </span>
        </p>
        <p className={styles.visitMeta}>
          {callOpen
            ? "By video. The call is open now."
            : "By video. Join opens 10 minutes before."}
        </p>
      </div>
      <div className={styles.actions}>
        {callOpen ? (
          <Link
            href={`/consultation/${appointment.id}`}
            className={`btn ${styles.join} ${styles.lead}`}
          >
            <span>Join the call</span>
            <span className="well" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </Link>
        ) : (
          <button
            type="button"
            className={`btn btn--ghost ${styles.pill} ${styles.lead}`}
            onClick={onCheckDevices}
          >
            Test camera and mic
          </button>
        )}
        {onChangeTime && (
          <button
            type="button"
            className={`btn btn--ghost ${styles.pill}`}
            onClick={onChangeTime}
          >
            Change time
          </button>
        )}
        {messageHref && (
          <Link
            href={messageHref}
            className={`btn btn--ghost ${styles.pill}`}
            aria-label={`Message ${appointment.doctorName}`}
          >
            Message
          </Link>
        )}
        <button
          type="button"
          className={`btn btn--ghost ${styles.cal}`}
          onClick={() => downloadConsultationIcs(appointment)}
          aria-label="Add to calendar"
        >
          <CalendarPlus size={18} aria-hidden="true" />
          <span className={styles.calText}>Add to calendar</span>
        </button>
      </div>
    </div>
  );
}
