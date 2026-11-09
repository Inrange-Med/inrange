/* /doctor-dashboard/patients: every patient under this doctor. The page sets the title; PatientsView loads and filters. */

import type { Metadata } from "next";
import PatientsView from "./components/PatientsView";

export const metadata: Metadata = { title: "Patients | InRange" };

export default function PatientsPage() {
  return <PatientsView />;
}
