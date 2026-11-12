/**
 * The video consultation room, /consultation/[appointmentId], for patients and doctors alike.
 * No dashboard shell: the call owns the screen. Kept out of search.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppTheme from "@/components/ui/AppTheme";

export const metadata: Metadata = {
  title: "Consultation | inrange",
  robots: { index: false, follow: false },
};

export default function ConsultationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppTheme>{children}</AppTheme>;
}
