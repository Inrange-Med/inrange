/* /doctor-dashboard/consultations/<id>: one consultation, top to bottom (doctor portal v2 PRD): the
   patient and Join, the reports, the last prescription, then the prescription, its PDF and Send. */

import type { Metadata } from "next";
import ConsultationView from "./components/ConsultationView";

export const metadata: Metadata = { title: "Consultation | inrange" };

export default async function ConsultationPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  return <ConsultationView appointmentId={appointmentId} />;
}
