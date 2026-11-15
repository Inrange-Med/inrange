/**
 * Question 9 as the choice itself (call, 12 Nov 2026, "too many clicks before payment"): the care
 * package with home blood tests, priced and ready to book, and below it the way out for someone with
 * a recent report. One tap starts either path, where a yes/no question and then a package card took
 * two. The package card is the lab booking feature's own (CarePackageStep).
 */

import { ArrowRight, FileArrowUp } from "@phosphor-icons/react";
import CarePackageStep from "@/features/lab-booking/components/CarePackageStep";
import type { CarePackage } from "@/types/carePackage";
import type { LabPackage } from "@/types/labTest";
import styles from "./FirstStepChoice.module.css";

export default function FirstStepChoice({
  onLab,
  onUpload,
}: {
  onLab: (chosen: { care: CarePackage; lab: LabPackage }) => void;
  onUpload: () => void;
}) {
  return (
    <div className={styles.choice}>
      <CarePackageStep onChoose={onLab} />
      <button type="button" className={styles.upload} onClick={onUpload}>
        <span className={styles.icon} aria-hidden="true">
          <FileArrowUp size={20} />
        </span>
        <span className={styles.text}>
          <strong>Had blood tests in the last 3 months?</strong>
          <span>Upload the report instead. No home test needed.</span>
        </span>
        <ArrowRight size={18} className={styles.go} aria-hidden="true" />
      </button>
    </div>
  );
}
