/*
  /doctor-dashboard/messages?p=<patientId>: the doctor's chats. The page sets the title; the inbox
  reads the open chat from the address, so it renders inside a Suspense boundary as Next.js
  requires for useSearchParams.
*/

import type { Metadata } from "next";
import { Suspense } from "react";
import ClinicSkeleton from "@/app/doctor-dashboard/components/ClinicSkeleton";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import MessagesView from "./components/MessagesView";

export const metadata: Metadata = { title: "Messages | inrange" };

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <main className={clinicStyles.page}>
          <ClinicSkeleton />
        </main>
      }
    >
      <MessagesView />
    </Suspense>
  );
}
