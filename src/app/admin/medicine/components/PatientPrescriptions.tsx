/*
  Every prescription the patient was sent, the current one first, each with who sent it and when (19 Nov
  2026 call: admin and the coach team read old ones too). A new prescription makes the old one invalid, so
  none is offered as a PDF here: this is to read.
*/

import type { OpsPatient } from "@/types/medicineOps";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";
import s from "./Medicine.module.css";
import { when } from "./words";

export default function PatientPrescriptions({
  prescriptions,
}: {
  prescriptions: OpsPatient["prescriptions"];
}) {
  if (!prescriptions.length) return null;
  return (
    <section className={s.section} aria-label="Prescriptions">
      <h3 className={s.sectionHead}>Prescriptions</h3>
      <ol className={s.timeline}>
        {prescriptions.map((rx) => (
          <li key={rx.id}>
            <time dateTime={rx.sentAt ?? undefined}>
              {rx.sentAt ? when(rx.sentAt) : ""}
            </time>
            <span>
              <strong>
                <span className="num">Version {rx.version}</span>
                {rx.current ? ", current" : ", replaced"}.{" "}
                {rx.edited ? "Edited and sent by" : "Sent by"}{" "}
                {rx.doctorName || "the doctor"}
              </strong>
              {rx.diagnosis && (
                <span className={s.reply}>Diagnosis: {rx.diagnosis}</span>
              )}
              {rx.medicines.map((m, i) => (
                <span key={i} className={s.reply}>
                  {m.name}
                  {m.words ? `: ${m.words.toLowerCase()}` : ""}
                </span>
              ))}
              {rx.medicines.length === 0 && (
                <span className={`${s.reply} ${adminStyles.muted}`}>
                  Advice only, no medicines
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
