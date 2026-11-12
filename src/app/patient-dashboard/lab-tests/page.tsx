/* /patient-dashboard/lab-tests: home blood tests, under way and earlier (LabTestsView). */

import type { Metadata } from "next";
import LabTestsView from "./components/LabTestsView";

export const metadata: Metadata = { title: "Blood tests | inrange" };

export default function LabTestsPage() {
  return <LabTestsView />;
}
