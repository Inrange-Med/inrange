/*
  /doctor-dashboard/patients/[patientId]?from=today|schedule|messages|notes: one patient's record.
  This server page sets the title and reads the id from the URL; PatientRecordView loads the record.
*/

import type { Metadata } from "next";
import PatientRecordView from "./components/PatientRecordView";

export const metadata: Metadata = { title: "Patient record | inrange" };

export default async function PatientRecordPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  return <PatientRecordView patientId={patientId} />;
}
