/** Medicine changes found in the call. Included ones become a draft prescription, signed separately. */

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import {
  addMedicine,
  ADDED_MEDICINE_PREFIX,
  removeMedicine,
  toggleMedicine,
} from "@/app/doctor-dashboard/notes/components/noteEdits";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import { rxChanges } from "@/app/doctor-dashboard/notes/components/noteState";
import { useNoteReview } from "./NoteReviewContext";
import AddMedicineSheet from "./AddMedicineSheet";
import EvidenceButton from "./EvidenceButton";
import EvidenceCard from "./EvidenceCard";
import ListSectionHead from "./ListSectionHead";
import TickBox from "./TickBox";
import sectionStyles from "./NoteSections.module.css";
import styles from "./NoteListSections.module.css";

const ACTION = {
  START: "Start",
  CHANGE: "Change",
  STOP: "Stop",
  CONTINUE: "Continue",
} as const;

export default function MedicinesSection({
  nextPrescriptionVersion,
}: {
  nextPrescriptionVersion: number;
}) {
  const review = useNoteReview();
  const [adding, setAdding] = useState(false);
  const { note, done, pin } = review;
  const changes = rxChanges(note).length;
  const signedVersion = note.signed?.prescriptionVersion ?? null;
  return (
    <section
      id="sec-medicines"
      data-sec="medicines"
      tabIndex={-1}
      aria-labelledby="h-medicines"
      className={sectionStyles.sec}
    >
      <ListSectionHead listKey="medicines" />
      <div className={sectionStyles.body}>
        {note.medicines.length ? (
          <ul className={styles.rows}>
            {note.medicines.map((medicine) => (
              <li key={medicine.id}>
                <div
                  className={styles.medRow}
                  data-out={
                    (!medicine.include && medicine.action !== "CONTINUE") ||
                    undefined
                  }
                >
                  <span className={styles.act} data-act={medicine.action}>
                    {ACTION[medicine.action]}
                  </span>
                  <span className={styles.medText}>
                    <strong>
                      {medicine.name} {medicine.strength}
                    </strong>
                    <span>{medicine.detail}</span>
                    {medicine.was && <em>Was: {medicine.was}</em>}
                  </span>
                  <span className={styles.rowTools}>
                    <EvidenceButton
                      id={`med-${medicine.id}`}
                      evidence={medicine.evidence}
                      label={medicine.name}
                    />
                    {!done && medicine.id.startsWith(ADDED_MEDICINE_PREFIX) && (
                      <button
                        type="button"
                        className={formStyles.link}
                        onClick={() =>
                          review.apply(removeMedicine(note, medicine.id))
                        }
                      >
                        Remove
                        <span className="sr-only"> {medicine.name}</span>
                      </button>
                    )}
                    {medicine.action !== "CONTINUE" && !done && (
                      <TickBox
                        on={medicine.include}
                        onChange={() =>
                          review.apply(toggleMedicine(note, medicine.id))
                        }
                        label={
                          <>
                            Include
                            <span className="sr-only">
                              : {ACTION[medicine.action].toLowerCase()}{" "}
                              {medicine.name}
                            </span>
                          </>
                        }
                      />
                    )}
                  </span>
                </div>
                {pin && !review.shown && pin.at === `med-${medicine.id}` && (
                  <EvidenceCard />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={sectionStyles.none}>
            No medicine came up on this call.
          </p>
        )}
        {!done && (
          <>
            <button
              type="button"
              className={`${formStyles.link} ${styles.addLink}`}
              onClick={() => setAdding(true)}
            >
              <Plus size={16} aria-hidden="true" />
              Add a medicine
            </button>
            <AddMedicineSheet
              open={adding}
              onClose={() => setAdding(false)}
              onAdd={(medicine) => review.apply(addMedicine(note, medicine))}
            />
          </>
        )}
        <p className={styles.foot}>
          {done
            ? signedVersion !== null
              ? `The changes became prescription version ${signedVersion}, for you to sign separately.`
              : "No change to the prescription."
            : changes
              ? `Included changes become prescription version ${nextPrescriptionVersion}, a draft you sign separately.`
              : "No change to the prescription."}
        </p>
      </div>
    </section>
  );
}
