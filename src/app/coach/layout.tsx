/*
  The coach's panel: every /coach page renders inside StaffShell, which lets in only a signed-in coach (role
  COACH, a health coach or a fitness coach) and sends anyone else to their own home. The API checks the same
  on every call and shows a coach only the patients given to them. The area stays out of search engines.
*/

import type { Metadata } from "next";
import type { ReactNode } from "react";
import CoachShell from "./components/CoachShell";

export const metadata: Metadata = {
  title: "Coach | inrange",
  robots: { index: false, follow: false },
};

export default function CoachLayout({ children }: { children: ReactNode }) {
  return <CoachShell>{children}</CoachShell>;
}
