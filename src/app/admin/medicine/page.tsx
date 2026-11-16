/* /admin/medicine: the medicine queue (admin and health coach). MedicineView loads it; ?tab= picks the view. */

import { Suspense } from "react";
import type { Metadata } from "next";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import MedicineView from "./components/MedicineView";

export const metadata: Metadata = { title: "Medicine | inrange" };

export default function MedicinePage() {
  // the view reads ?tab= and ?patient=, which needs a Suspense boundary in this Next.js
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <MedicineView />
    </Suspense>
  );
}
