/* /patient-dashboard/prescriptions: every prescription the patient was sent, newest first (doctor portal v2). */

import type { Metadata } from "next";
import PrescriptionsView from "./components/PrescriptionsView";

export const metadata: Metadata = { title: "Prescriptions | inrange" };

export default function PrescriptionsPage() {
  return <PrescriptionsView />;
}
