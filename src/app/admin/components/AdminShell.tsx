"use client";

/*
  The inrange team's workspace around every /admin page: Reviews, Medicine (the patients, the queue, the
  calls, the payments) and Doctors. Admins only (StaffShell sends anyone else to their own home): a coach
  works in /coach and a salesperson in /sales, each with their own shell.
*/

import type { ReactNode } from "react";
import { ClipboardText, Package, Stethoscope } from "@phosphor-icons/react";
import StaffShell from "@/components/ui/StaffShell";

const SECTIONS = [
  { href: "/admin", label: "Reviews", icon: ClipboardText },
  { href: "/admin/medicine", label: "Medicine", icon: Package },
  { href: "/admin/doctors", label: "Doctors", icon: Stethoscope },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <StaffShell
      role="ADMIN"
      portal="Admin"
      title="inrange team"
      home="/admin"
      sections={SECTIONS}
    >
      {children}
    </StaffShell>
  );
}
