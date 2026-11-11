"use client";

/*
  Today's screen (Arhaan's clinician Today): who is next, what is waiting on the doctor, and the day in
  order. On a closed day or after the last call, the next working day's first patient leads.
  Real data: the day's consultations (GET /api/appointments/doctor?date=) and, when nothing is left
  today, every consultation to find the next one. Proposed: the queue and the next patient's record.
*/

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import { useNow } from "@/hooks/useNow";
import { isInProgress } from "@/lib/consultations/consultationTime";
import { clockTime, toApiDate, weekdayDayMonth } from "@/lib/format/dateTime";
import {
  listAllAppointments,
  listAppointmentsOn,
} from "@/services/doctorPortalService";
import {
  getPatientRecord,
  listWaitingItems,
} from "@/services/patientRecordService";
import AppointmentRow, { appointmentListClass } from "../AppointmentRow";
import ClinicSkeleton from "../ClinicSkeleton";
import { flagsByPatient } from "../waitingWords";
import NextPatientCard from "./NextPatientCard";
import WaitingQueue from "./WaitingQueue";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "@/app/doctor-dashboard/TodayPage.module.css";

export default function TodayView() {
  const now = useNow(60_000);
  const [today] = useState(() => new Date());
  const day = useApiResource(`doctor-day-${toApiDate(today)}`, () =>
    listAppointmentsOn(today),
  );
  const queue = useApiResource("doctor-queue", listWaitingItems);

  const appointments = day.data ?? [];
  const live =
    appointments.find((appointment) => isInProgress(appointment, now)) ??
    appointments.find(
      (appointment) =>
        appointment.status === "BOOKED" &&
        Date.parse(appointment.startsAt) > now,
    );
  // nothing left today: the next working day's first patient leads instead
  const all = useApiResource(
    day.data && !live ? "doctor-all-appointments" : null,
    listAllAppointments,
  );
  const later = (all.data ?? []).find(
    (appointment) =>
      appointment.status === "BOOKED" &&
      Date.parse(appointment.startsAt) > now &&
      new Date(appointment.startsAt).toDateString() !== today.toDateString(),
  );
  const next = live ?? (appointments.length === 0 ? later : undefined);
  const record = useApiResource(
    next?.patientId ? `record-${next.patientId}` : null,
    () => getPatientRecord(next?.patientId ?? ""),
  );

  if (day.error && !day.data) {
    return (
      <main className={clinicStyles.page}>
        <PageHead className={clinicStyles.pageHead} title="Today" />
        <ErrorNotice message={day.error} onRetry={day.reload} />
      </main>
    );
  }
  if (!day.data) {
    return (
      <main className={clinicStyles.page}>
        <PageHead className={clinicStyles.pageHead} title="Today" />
        <ClinicSkeleton titled={false} />
      </main>
    );
  }

  const waiting = queue.data ?? null;
  const flags = flagsByPatient(waiting ?? []);
  const done = appointments.filter(
    (appointment) => appointment.status === "COMPLETED",
  ).length;

  return (
    <main className={clinicStyles.page}>
      <PageHead
        className={clinicStyles.pageHead}
        title="Today"
        sub={
          <>
            {weekdayDayMonth.format(today)}.{" "}
            <span className="num">{appointments.length}</span> consultations,{" "}
            <span className="num">{done}</span> done
            {waiting && (
              <>
                , <span className="num">{waiting.length}</span> waiting on you
              </>
            )}
            .
          </>
        }
      />

      <div className={styles.todayGrid} data-quiet={!next}>
        {/* when the day's consultations are done, the plate steps aside and the queue leads */}
        {next && (
          <NextPatientCard
            appointment={next}
            record={record.data ?? null}
            inProgress={isInProgress(next, now)}
            notToday={!live}
            now={now}
            className={styles.nextUp}
          />
        )}

        <WaitingQueue
          items={queue.loading && !queue.data ? undefined : waiting}
          now={now}
          className={styles.queuePanel}
          notice={
            queue.error ? (
              <ErrorNotice message={queue.error} onRetry={queue.reload} />
            ) : null
          }
        />

        <section
          className={`${clinicStyles.panel} ${styles.dayList}`}
          aria-labelledby="day-heading"
        >
          <div className={clinicStyles.panelHead}>
            <h2 id="day-heading" className={clinicStyles.h2}>
              The day
            </h2>
            <Link
              href="/doctor-dashboard/schedule"
              className={clinicStyles.textLink}
            >
              Month <ArrowRight size={15} />
            </Link>
          </div>
          {appointments.length === 0 && (
            <p className={clinicStyles.empty}>
              No consultations today.
              {later
                ? ` Next: ${later.patientName}, ${weekdayDayMonth.format(new Date(later.startsAt))} at ${clockTime(new Date(later.startsAt))}.`
                : ""}
            </p>
          )}
          <ol className={appointmentListClass}>
            {appointments.map((appointment) => (
              <li key={appointment.id}>
                <AppointmentRow
                  appointment={appointment}
                  now={now}
                  flag={
                    appointment.patientId
                      ? flags.get(appointment.patientId)
                      : undefined
                  }
                  from="today"
                />
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
