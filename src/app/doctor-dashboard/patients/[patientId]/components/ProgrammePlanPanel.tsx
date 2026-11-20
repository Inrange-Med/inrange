/* The patient's programme plan on the record, for the doctor to see: active, or put on by admin and not paid
   yet, and who sells to the patient and coaches them. The doctor never chooses or suggests a plan: a
   salesperson sells it on the call, after the doctor (19 Nov 2026 call). */

import { inIndiaTime, shortDate } from "@/lib/format/dateTime";
import type { PatientRecord } from "@/types/patientRecord";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import recordStyles from "../PatientRecordPage.module.css";
import styles from "./ProgrammePlanPanel.module.css";

/** "12 Feb", with the year when it is not this one ("12 Feb 2027") */
function dayMonth(iso: string) {
  const year = inIndiaTime(new Date(iso)).getUTCFullYear();
  return year === inIndiaTime(new Date()).getUTCFullYear()
    ? shortDate(iso)
    : `${shortDate(iso)} ${year}`;
}

export default function ProgrammePlanPanel({
  record,
}: {
  record: Pick<
    PatientRecord,
    "activePlan" | "planRecommendation" | "salesperson" | "coachName"
  >;
}) {
  const team = [
    record.salesperson && `Salesperson: ${record.salesperson}`,
    record.coachName && `Health coach: ${record.coachName}`,
  ].filter(Boolean);
  return (
    <section
      id="programme"
      className={`${clinicStyles.panel} ${recordStyles.full}`}
      aria-labelledby="programme-heading"
    >
      <div className={clinicStyles.panelHead}>
        <h2 id="programme-heading" className={clinicStyles.h2}>
          Programme plan
        </h2>
      </div>
      {record.activePlan ? (
        <div className={styles.plan}>
          <div className={styles.rxHead}>
            <strong>{record.activePlan.planName}</strong>
            <span className={`${clinicStyles.pill} num`} data-tone="ok">
              Active until {dayMonth(record.activePlan.endsAt)}
            </span>
          </div>
        </div>
      ) : record.planRecommendation ? (
        <div className={styles.plan}>
          <div className={styles.rxHead}>
            <strong>{record.planRecommendation.planName}</strong>
            <span className={clinicStyles.pill} data-tone="warn">
              Not paid yet
            </span>
          </div>
        </div>
      ) : (
        <p className={clinicStyles.empty}>
          No plan yet. Our sales team takes the patient through the plans after
          your consultation, so prescriptions are for one month until then.
        </p>
      )}
      {team.length > 0 && <p className={styles.team}>{team.join("  ·  ")}</p>}
    </section>
  );
}
