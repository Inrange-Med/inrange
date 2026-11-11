"use client";

/**
 * Yes, I have a report: the date on it, then the file (PDF or image, within the last 3 months), sent
 * with purpose ELIGIBILITY so it goes to the medical team for review. Nothing to pay on this path.
 */

import type { RefObject } from "react";
import LabReportUpload from "@/components/ui/LabReportUpload";
import { uploadReport } from "@/services/reportService";
import BloodTestScreenFrame from "./BloodTestScreenFrame";

type Props = {
  direction: 1 | -1;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSent: () => void;
};

export default function ReportUploadScreen({
  direction,
  headingRef,
  onSent,
}: Props) {
  return (
    <BloodTestScreenFrame
      screenKey="upload"
      direction={direction}
      title="Upload your report"
      why="A PDF or a photo of a blood test from the last 3 months. Our medical team reviews it."
      headingRef={headingRef}
    >
      <LabReportUpload
        chooseLabel="Choose the report"
        submitLabel="Send for review"
        onUpload={async (report) => {
          await uploadReport({ ...report, purpose: "ELIGIBILITY" });
          onSent();
        }}
      />
    </BloodTestScreenFrame>
  );
}
