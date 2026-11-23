/* /doctor-dashboard/consultations/<id>: the patient's page, opened from a consultation (Today, History):
   the consultation and Join, what the doctor needs at the top, then prescriptions, reports and coach remarks.
   ?write=1 opens the prescription form at once (Today's "Write prescription"). */

import type { Metadata } from "next";
import PatientPageView from "@/app/doctor-dashboard/components/patient/PatientPageView";

export const metadata: Metadata = { title: "Consultation | inrange" };

export default async function ConsultationPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  return <PatientPageView appointmentId={appointmentId} />;
}
