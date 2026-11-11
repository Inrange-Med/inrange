/*
  Safety, never folded away (Arhaan's record safety strip): allergies, the current prescription,
  conditions and other medicines, then each flagged symptom (severe first) until the doctor records
  what was done about it.
*/

import { Warning, WarningCircle } from "@phosphor-icons/react";
import { clockTime, shortDate } from "@/lib/format/dateTime";
import type { PatientRecord } from "@/types/patientRecord";
import SymptomOutcomes from "./SymptomOutcomes";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "./SafetyStrip.module.css";

export default function SafetyStrip({
  record,
  onChanged,
}: {
  record: PatientRecord;
  onChanged: () => void;
}) {
  const signed = record.prescriptions.find((rx) => rx.status === "SIGNED");
  const flagged = record.symptoms
    .filter((symptom) => symptom.requiresReview && !symptom.acknowledged)
    .sort(
      (a, b) =>
        (a.severity === "Severe" ? 0 : 1) - (b.severity === "Severe" ? 0 : 1),
    );
  return (
    <section className={styles.safety} aria-label="Safety">
      <div
        data-warn={!record.allergies || !/^No known/i.test(record.allergies)}
      >
        <span className={styles.safetyLabel}>
          <Warning size={15} /> Allergies
        </span>
        <strong>
          {record.allergies ?? "Not recorded. Ask before prescribing."}
        </strong>
      </div>
      <div>
        <span className={styles.safetyLabel}>On inrange prescription</span>
        <strong>
          {signed
            ? signed.items
                .map(
                  (item) =>
                    `${item.name.replace(/ \(.*\)/, "")} ${item.strength}`,
                )
                .join("; ")
            : "Nothing prescribed"}
        </strong>
        {record.injections?.lastAt && (
          <em className={styles.safetyNote}>
            Last injection {shortDate(record.injections.lastAt)}
            {record.injections.lastSite
              ? `, ${record.injections.lastSite}`
              : ""}
          </em>
        )}
      </div>
      <div>
        <span className={styles.safetyLabel}>Conditions</span>
        <strong>
          {record.conditions.length
            ? record.conditions.join(", ")
            : "None reported"}
        </strong>
      </div>
      <div>
        <span className={styles.safetyLabel}>Other medicines</span>
        <strong>
          {record.outsideMedicines === null
            ? "Not recorded"
            : record.outsideMedicines.length
              ? record.outsideMedicines.join("; ")
              : "None reported"}
        </strong>
      </div>
      {flagged.map((symptom, i) => (
        <div
          key={symptom.id}
          id={i === 0 ? "flagged" : undefined}
          data-warn="true"
          data-severity={symptom.severity}
          className={styles.safetyWide}
        >
          <span className={styles.safetyLabel}>
            <WarningCircle
              size={15}
              weight={symptom.severity === "Severe" ? "fill" : "regular"}
            />{" "}
            Flagged by the patient, {shortDate(symptom.at)},{" "}
            {clockTime(new Date(symptom.at))}
            {symptom.severity === "Severe" && (
              <span className={clinicStyles.qSevere}>Severe</span>
            )}
          </span>
          <strong>
            {symptom.label}, {symptom.severity.toLowerCase()}.
            {symptom.note ? ` ${symptom.note}` : ""}
          </strong>
          <SymptomOutcomes
            patientId={record.patientId}
            symptom={symptom}
            onChanged={onChanged}
          />
        </div>
      ))}
    </section>
  );
}
