/* /doctor-dashboard: the doctor's Today. The page sets the title; TodayView loads and shows the day. */

import type { Metadata } from "next";
import TodayView from "./components/today/TodayView";

export const metadata: Metadata = { title: "Today | InRange" };

export default function TodayPage() {
  return <TodayView />;
}
