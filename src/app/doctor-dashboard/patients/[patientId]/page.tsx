/*
  /doctor-dashboard/patients/[patientId]: one patient, opened from the doctor's patient list. The same page
  a consultation opens (PatientPageView): what the doctor needs at the top, then prescriptions (one can be
  written here with no consultation), reports and coach remarks. The older, longer record
  (components/PatientRecordView and its panels) is kept in the repo for the back office and is not routed.
*/

import type { Metadata } from "next";
import PatientPageView from "@/app/doctor-dashboard/components/patient/PatientPageView";

export const metadata: Metadata = { title: "Patient | inrange" };

export default async function PatientPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  return <PatientPageView patientId={patientId} />;
}
