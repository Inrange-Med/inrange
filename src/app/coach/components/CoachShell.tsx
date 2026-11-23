"use client";

/* The coach's workspace: their patients, and the queue of who needs a call. Only role COACH gets in (StaffShell). */

import type { ReactNode } from "react";
import { ListChecks, UsersThree } from "@phosphor-icons/react";
import StaffShell from "@/components/ui/StaffShell";

const SECTIONS = [
  { href: "/coach", label: "Patients", icon: UsersThree },
  { href: "/coach/queue", label: "Queue", icon: ListChecks },
];

export default function CoachShell({ children }: { children: ReactNode }) {
  return (
    <StaffShell
      role="COACH"
      portal="Coach"
      title="Coach"
      home="/coach"
      sections={SECTIONS}
    >
      {children}
    </StaffShell>
  );
}
