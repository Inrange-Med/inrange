/*
  The admin layout: every /admin page renders inside AdminShell, which checks the session (the
  inrange team only), applies the design tokens and draws the rail, the dock and the toast. The
  whole area stays out of search engines.
*/

import type { Metadata } from "next";
import type { ReactNode } from "react";
import AdminShell from "./components/AdminShell";

export const metadata: Metadata = {
  title: "Admin | inrange",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
