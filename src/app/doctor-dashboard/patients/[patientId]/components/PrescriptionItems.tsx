/* A prescription's medicines (name, strength, dose, how often, for how long) and the advice under them. */

import type { RecordPrescription } from "@/types/patientRecord";
import styles from "./PrescriptionItems.module.css";

const lcFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export default function PrescriptionItems({
  prescription,
}: {
  prescription: RecordPrescription;
}) {
  return (
    <>
      <ul className={styles.items}>
        {prescription.items.map((item) => (
          <li key={item.name}>
            <strong>
              {item.name} {item.strength}
            </strong>
            <span>
              {[
                item.dose,
                item.frequency && lcFirst(item.frequency),
                item.duration && `for ${item.duration}`,
              ]
                .filter(Boolean)
                .join(", ")}
            </span>
          </li>
        ))}
      </ul>
      {prescription.advice && (
        <p className={styles.advice}>{prescription.advice}</p>
      )}
    </>
  );
}
