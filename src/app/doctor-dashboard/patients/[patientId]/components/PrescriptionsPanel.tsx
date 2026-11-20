"use client";

/*
  Prescriptions (Arhaan's record panel): a draft (never visible to the patient) with Review and
  sign, the current version, and earlier versions folded away. Signing asks once more in place,
  naming the doctor, because the patient and the pharmacy see it once signed. Beside each one: which
  doctor sent it (or edited and sent it) and when, for every doctor who treats the patient. Only the
  current one opens as a PDF; replaced ones are read here (19 Nov 2026 call).
*/

import { useState } from "react";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react";
import FileOpenButton from "@/components/ui/FileOpenButton";
import { useToast } from "@/components/ui/ToastProvider";
import { clockTime, shortDate } from "@/lib/format/dateTime";
import { errorMessage } from "@/lib/http/apiClient";
import { getFile } from "@/services/fileService";
import { signPrescription } from "@/services/patientRecordService";
import type { RecordPrescription } from "@/types/patientRecord";
import PrescriptionItems from "./PrescriptionItems";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "./PrescriptionsPanel.module.css";

/** "Sent by Dr. Ananya Iyer, 19 Nov, 7:30 pm" */
const sentBy = (rx: RecordPrescription) =>
  [
    `${rx.edited ? "Edited and sent" : "Sent"}${rx.doctorName ? ` by ${rx.doctorName}` : ""}`,
    rx.sentAt && `${shortDate(rx.sentAt)}, ${clockTime(new Date(rx.sentAt))}`,
  ]
    .filter(Boolean)
    .join(", ");

export default function PrescriptionsPanel({
  patientId,
  prescriptions,
  doctorName,
  onChanged,
}: {
  patientId: string;
  prescriptions: RecordPrescription[];
  doctorName: string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [signing, setSigning] = useState(false);
  const draft = prescriptions.find((rx) => rx.status === "DRAFT");
  const signed = prescriptions.find((rx) => rx.status === "SIGNED");
  const history = prescriptions.filter((rx) => rx.status === "SUPERSEDED");

  const sign = async (rx: RecordPrescription) => {
    setSigning(true);
    try {
      await signPrescription(patientId, rx.id);
      setConfirming(false);
      toast(`Version ${rx.version} signed`);
      onChanged();
    } catch (caught) {
      toast(errorMessage(caught));
    } finally {
      setSigning(false);
    }
  };

  return (
    <section
      id="prescriptions"
      className={clinicStyles.panel}
      aria-labelledby="prescriptions-heading"
    >
      <div className={clinicStyles.panelHead}>
        <h2 id="prescriptions-heading" className={clinicStyles.h2}>
          Prescriptions
        </h2>
      </div>
      {draft && (
        <div className={styles.rx} data-draft="true">
          <div className={styles.rxHead}>
            <strong>Version {draft.version}</strong>
            <span className={clinicStyles.pill} data-tone="warn">
              Draft, not visible to the patient
            </span>
          </div>
          <PrescriptionItems prescription={draft} />
          {confirming ? (
            <div className={clinicStyles.confirm}>
              <p>
                Sign version {draft.version} as {doctorName}? The patient and
                the pharmacy see it once signed.
              </p>
              <div>
                <button
                  type="button"
                  className="btn"
                  disabled={signing}
                  onClick={() => sign(draft)}
                >
                  <span>Sign</span>
                  <span className="well" aria-hidden="true">
                    <CheckCircle size={18} />
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setConfirming(false)}
                >
                  Not yet
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => setConfirming(true)}
            >
              <span>Review and sign</span>
              <span className="well" aria-hidden="true">
                <ArrowRight size={18} />
              </span>
            </button>
          )}
        </div>
      )}
      {signed ? (
        <div className={styles.rx}>
          <div className={styles.rxHead}>
            <strong>Version {signed.version}</strong>
            <span className={clinicStyles.pill} data-tone="ok">
              Current
            </span>
          </div>
          <div className={styles.by}>
            <span className="num">{sentBy(signed)}</span>
            {signed.pdf && (
              <FileOpenButton
                load={() => getFile(signed.pdf!)}
                className={clinicStyles.textBtn}
              >
                {(opening) => (opening ? "Opening" : "View PDF")}
              </FileOpenButton>
            )}
          </div>
          <PrescriptionItems prescription={signed} />
        </div>
      ) : (
        !draft && (
          <p className={clinicStyles.empty}>
            No prescription. Medicine only if you judge it clinically
            appropriate.
          </p>
        )
      )}
      {history.length > 0 && (
        <details className={clinicStyles.history}>
          <summary>Earlier versions, replaced</summary>
          {history.map((rx) => (
            <p key={rx.id}>
              <strong>Version {rx.version}</strong>.{" "}
              <span className="num">{sentBy(rx)}</span>.{" "}
              {rx.items
                .map((item) => `${item.name} ${item.strength}`)
                .join(", ")}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
