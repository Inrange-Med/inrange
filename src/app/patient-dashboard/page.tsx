/* /patient-dashboard: the patient's Home. The page sets the title; HomeView loads and shows everything. */

import type { Metadata } from "next";
import HomeView from "./components/home/HomeView";

export const metadata: Metadata = { title: "Home | inrange" };

export default function PatientHomePage() {
  return <HomeView />;
}
