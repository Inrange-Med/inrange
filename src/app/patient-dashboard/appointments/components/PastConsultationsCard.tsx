/**
 * Past consultations on Appointments: what each was, when and with whom, newest first. The
 * doctor's summary and next steps (in the design) need a notes endpoint the backend does not have
 * yet, so they are not shown.
 */

import Card from "@/components/ui/Card";
import { consultationMinutes } from "@/lib/consultations/consultationTime";
import { shortDate } from "@/lib/format/dateTime";
import type { Appointment } from "@/types/appointment";
import styles from "../AppointmentsPage.module.css";

/** "20 Sep", with the year only when it is not this one. */
function dateOf(iso: string) {
  const year = new Date(iso).getFullYear();
  return year === new Date().getFullYear()
    ? shortDate(iso)
    : `${shortDate(iso)} ${year}`;
}

export default function PastConsultationsCard({
  past,
}: {
  past: Appointment[];
}) {
  return (
    <Card title="Past consultations" className={styles.card} id="past">
      {past.length === 0 ? (
        <p className={styles.empty}>
          Your consultations appear here afterwards.
        </p>
      ) : (
        <ol className={styles.past}>
          {past.map((appointment) => (
            <li key={appointment.id}>
              <strong className={styles.pastHead}>
                {appointment.status === "CANCELLED"
                  ? "Cancelled consultation"
                  : appointment.visitType === "FIRST"
                    ? "First consultation"
                    : appointment.visitType === "FOLLOW_UP"
                      ? "Follow-up consultation"
                      : "Consultation"}
              </strong>
              <span className={styles.pastBy}>
                <span className="num">{dateOf(appointment.startsAt)}</span>,{" "}
                {appointment.doctorName},{" "}
                <span className="num">{consultationMinutes(appointment)}</span>{" "}
                minutes
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
