/* /patient-dashboard/appointments: booked and past consultations. AppointmentsView loads and shows them. */

import type { Metadata } from "next";
import AppointmentsView from "./components/AppointmentsView";

export const metadata: Metadata = { title: "Appointments | inrange" };

export default function AppointmentsPage() {
  return <AppointmentsView />;
}
