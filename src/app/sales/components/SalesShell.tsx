"use client";

/* The salesperson's workspace: one place, their customers. Only role SALES gets in (StaffShell). */

import type { ReactNode } from "react";
import { UsersThree } from "@phosphor-icons/react";
import StaffShell from "@/components/ui/StaffShell";

const SECTIONS = [{ href: "/sales", label: "Customers", icon: UsersThree }];

export default function SalesShell({ children }: { children: ReactNode }) {
  return (
    <StaffShell
      role="SALES"
      portal="Sales"
      title="Sales team"
      home="/sales"
      sections={SECTIONS}
    >
      {children}
    </StaffShell>
  );
}
