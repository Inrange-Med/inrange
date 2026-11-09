/* /doctor-dashboard/schedule: the month and the picked day. The page sets the title; ScheduleView loads and shows it. */

import type { Metadata } from "next";
import ScheduleView from "./components/ScheduleView";

export const metadata: Metadata = { title: "Schedule | InRange" };

export default function SchedulePage() {
  return <ScheduleView />;
}
