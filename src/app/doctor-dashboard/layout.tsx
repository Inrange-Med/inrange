/*
  The doctor dashboard layout: every /doctor-dashboard page renders inside DoctorShell, which checks
  the session (doctors only), applies the design tokens and draws the rail, the dock and the toast.
  The whole dashboard stays out of search engines.
*/

import type { Metadata } from "next";
import type { ReactNode } from "react";
import DoctorShell from "./components/DoctorShell";

export const metadata: Metadata = {
  title: "Clinician | InRange",
  robots: { index: false, follow: false },
};

export default function DoctorDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <DoctorShell>{children}</DoctorShell>;
}
