/* /doctor-dashboard/history: every past consultation of this doctor, newest first (doctor portal v2 PRD). */

import type { Metadata } from "next";
import HistoryView from "./components/HistoryView";

export const metadata: Metadata = { title: "History | inrange" };

export default function HistoryPage() {
  return <HistoryView />;
}
