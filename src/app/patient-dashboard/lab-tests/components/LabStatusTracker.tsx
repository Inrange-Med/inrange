/**
 * A home blood test's progress, in Arhaan's lab steps (care.ts LAB_STEPS) without the doctor-review
 * step, which inrange does not track for a booked test. Renders nothing for a booking that is not
 * moving (waiting for payment, cancelled, not paid in time): the page says those in words.
 */

import StatusTracker from "@/app/patient-dashboard/components/StatusTracker";
import type { LabBookingStatus } from "@/types/labTest";

const LAB_STEPS = [
  { label: "Booked" },
  { label: "Collector assigned" },
  { label: "Sample collected" },
  { label: "At the lab" },
  { label: "Report ready" },
];

const STEP_OF: Partial<Record<LabBookingStatus, number>> = {
  BOOKED: 0,
  COLLECTOR_ASSIGNED: 1,
  SAMPLE_COLLECTED: 2,
  PROCESSING: 3,
  REPORT_READY: 4,
};

export default function LabStatusTracker({
  status,
}: {
  status: LabBookingStatus;
}) {
  const index = STEP_OF[status];
  if (index === undefined) return null;
  return <StatusTracker steps={LAB_STEPS} currentIndex={index} />;
}
