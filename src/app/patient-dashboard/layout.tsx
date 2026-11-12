/*
  The patient dashboard layout: every /patient-dashboard page renders inside PatientShell, which checks the
  session, applies the design tokens and draws the bar, the sections and the toast. Pages set their
  own titles; this one keeps the whole dashboard out of search engines.
*/

import type { ReactNode } from "react";
import type { Metadata } from "next";
import PatientShell from "./components/PatientShell";

export const metadata: Metadata = {
  title: "Your account | inrange",
  robots: { index: false, follow: false },
};

export default function PatientDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <PatientShell>{children}</PatientShell>;
}
