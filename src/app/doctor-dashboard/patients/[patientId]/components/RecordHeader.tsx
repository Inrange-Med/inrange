/*
  The record's head (Arhaan's PatientRecord header): back to where it was opened from, who the
  patient is, their mobile, next visit and identity check, and one main action: Start consultation
  from ten minutes before the visit (as the patient's Join is). Messages is off the doctor's navigation
  (doctor portal v2), so the header no longer links to it.
*/

import Link from "next/link";
import { ArrowRight, IdentificationBadge } from "@phosphor-icons/react";
import Avatar from "@/components/ui/Avatar";
import BackLink from "@/components/ui/BackLink";
import { clockTime, shortDate } from "@/lib/format/dateTime";
import type { BackDestination } from "@/lib/navigation/backDestination";
import type { Appointment } from "@/types/appointment";
import type { DoctorPatient } from "@/types/doctor";
import type { PatientRecord } from "@/types/patientRecord";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "./RecordHeader.module.css";

export default function RecordHeader({
  patient,
  record,
  origin,
  nextVisit,
  now,
}: {
  patient: DoctorPatient;
  record: PatientRecord | null;
  origin: BackDestination;
  nextVisit?: Appointment;
  now: number;
}) {
  const startsAt = nextVisit ? Date.parse(nextVisit.startsAt) : 0;
  const live =
    !!nextVisit && now >= startsAt - 10 * 6e4 && now < startsAt + 30 * 6e4;
  const startMain = live;
  const facts = [patient.age, patient.sex].filter(Boolean).join(", ");
  const care = record
    ? [record.programme, record.careWeek ? `week ${record.careWeek}` : ""]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <>
      <div className={styles.back}>
        <BackLink href={origin.href} label={origin.label} />
      </div>

      <header className={styles.recHead}>
        <div className={styles.recWho}>
          <Avatar name={patient.fullName} size={64} />
          <div>
            <h1 className={styles.recName}>{patient.fullName}</h1>
            {(facts || record?.city || care) && (
              <p className={clinicStyles.sub}>
                <span className="num">{facts}</span>
                {record?.city ? `${facts ? ", " : ""}${record.city}` : ""}
                {facts || record?.city ? "." : ""}
                {care ? ` ${care}.` : ""}
              </p>
            )}
            <p className={styles.recIds}>
              {patient.mobile && <span className="num">{patient.mobile}</span>}
              <span>
                {nextVisit
                  ? `Next visit ${shortDate(nextVisit.startsAt)}, ${clockTime(new Date(nextVisit.startsAt))}`
                  : "No visit booked"}
              </span>
              {record && (
                <span
                  className={clinicStyles.pill}
                  data-tone={record.identityVerified ? "ok" : "warn"}
                >
                  <IdentificationBadge size={14} />{" "}
                  {record.identityVerified
                    ? "Identity verified"
                    : "Verify identity at start"}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className={styles.recActions}>
          {nextVisit && (
            <Link
              href={`/consultation/${nextVisit.id}`}
              className={startMain ? "btn btn--signal" : "btn btn--ghost"}
            >
              <span>Start consultation</span>
              {startMain && (
                <span className="well" aria-hidden="true">
                  <ArrowRight size={18} />
                </span>
              )}
            </Link>
          )}
          {record && (
            <a href="#notes" className="btn btn--ghost">
              Add a note
            </a>
          )}
        </div>
      </header>
    </>
  );
}
