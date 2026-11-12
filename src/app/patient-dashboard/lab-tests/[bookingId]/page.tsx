/* /patient-dashboard/lab-tests/[bookingId]: one home blood test (LabBookingDetailView). */

import type { Metadata } from "next";
import LabBookingDetailView from "../components/LabBookingDetailView";

export const metadata: Metadata = { title: "Blood test | inrange" };

export default async function LabBookingPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return <LabBookingDetailView bookingId={bookingId} />;
}
