/* /doctor-dashboard/hours: the doctor's weekly working hours and days off. The page sets the title; HoursView loads and edits them. */

import type { Metadata } from "next";
import HoursView from "./components/HoursView";

export const metadata: Metadata = { title: "Hours | inrange" };

export default function HoursPage() {
  return <HoursView />;
}
