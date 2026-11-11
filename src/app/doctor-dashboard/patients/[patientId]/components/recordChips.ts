/**
 * The record's section chips, in page order, with a dot on any section that needs the doctor (a
 * draft prescription, a lab to review, a flagged symptom). A first-consultation record ("fresh")
 * has one "Before the call" section in place of prescriptions, plan, labs and visits.
 */

import type { PatientRecord } from "@/types/patientRecord";
import type { RecordChip } from "./RecordSectionNav";

/** No labs, plan, prescriptions or visits yet: the record before the first consultation. */
export function isFreshRecord(record: PatientRecord) {
  return (
    !record.labs.length &&
    !record.plan &&
    !record.prescriptions.length &&
    !record.visits.length
  );
}

export function recordChips(
  record: PatientRecord,
  photosShared: boolean,
): RecordChip[] {
  const fresh = isFreshRecord(record);
  const flagged = record.symptoms.some(
    (symptom) => symptom.requiresReview && !symptom.acknowledged,
  );
  return [
    { id: "overview", label: "Overview" },
    ...(fresh
      ? [{ id: "first", label: "Before the call" }]
      : [
          {
            id: "prescriptions",
            label: "Prescriptions",
            dot: record.prescriptions.some(
              (prescription) => prescription.status === "DRAFT",
            )
              ? { label: "draft to sign" }
              : undefined,
          },
          { id: "plan", label: "Plan" },
          { id: "programme", label: "Programme" },
          {
            id: "labs",
            label: "Labs",
            dot: record.labs.some(
              (lab) => lab.status === "DOCTOR_REVIEW_PENDING",
            )
              ? { label: "needs review" }
              : undefined,
          },
        ]),
    {
      id: "trackers",
      label: "Trackers",
      dot: flagged ? { label: "flagged symptom", urgent: true } : undefined,
    },
    { id: "notes", label: "Notes" },
    ...(photosShared ? [{ id: "photos", label: "Photos" }] : []),
    ...(fresh ? [] : [{ id: "visits", label: "Visits" }]),
    { id: "activity", label: "Activity" },
  ];
}
