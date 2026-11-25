"use client";

/*
  The inrange team's workspace around every /admin page. An admin has all of it: Reviews, Operations (the
  patients, the queue, the calls, the payments, sales), Doctors and Team. Someone on the operations team (role
  OPS: the blood test, consultations or pharmacy desk) has Operations only, and there only their desk's work.
  A coach works in /coach and a salesperson in /sales, each with their own shell.
*/

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardText,
  Package,
  Stethoscope,
  UsersThree,
} from "@phosphor-icons/react";
import StaffShell from "@/components/ui/StaffShell";
import { useSessionUser } from "@/hooks/useSessionUser";

const OPERATIONS = "/admin/medicine";
const SECTIONS = [
  { href: "/admin", label: "Reviews", icon: ClipboardText },
  { href: OPERATIONS, label: "Operations", icon: Package },
  { href: "/admin/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/admin/team", label: "Team", icon: UsersThree },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSessionUser();
  const ops = status === "OPS";
  const away = ops && !pathname.startsWith(OPERATIONS);
  useEffect(() => {
    if (away) router.replace(OPERATIONS);
  }, [away, router]);

  return (
    <StaffShell
      role={["ADMIN", "OPS"]}
      portal={ops ? "Team" : "Admin"}
      title={ops ? "Operations team" : "inrange team"}
      home={ops ? OPERATIONS : "/admin"}
      sections={ops ? SECTIONS.filter((s) => s.href === OPERATIONS) : SECTIONS}
    >
      {away ? null : children}
    </StaffShell>
  );
}
