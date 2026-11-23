/*
  The sales panel: every /sales page renders inside StaffShell, which lets in only a signed-in salesperson
  (role SALES) and sends anyone else to their own home. The API checks the same on every call and shows a
  salesperson only the customers assigned to them. The area stays out of search engines.
*/

import type { Metadata } from "next";
import type { ReactNode } from "react";
import SalesShell from "./components/SalesShell";

export const metadata: Metadata = {
  title: "Sales | inrange",
  robots: { index: false, follow: false },
};

export default function SalesLayout({ children }: { children: ReactNode }) {
  return <SalesShell>{children}</SalesShell>;
}
