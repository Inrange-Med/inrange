/* /patient-dashboard/reports: every report in the record, and uploading one (ReportsView). */

import type { Metadata } from "next";
import ReportsView from "./components/ReportsView";

export const metadata: Metadata = { title: "Reports | InRange" };

export default function ReportsPage() {
  return <ReportsView />;
}
