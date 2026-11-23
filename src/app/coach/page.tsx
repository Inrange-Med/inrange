/* /coach: a coach's patients. CoachView loads them; ?patient= opens one. */

import { Suspense } from "react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import CoachView from "./components/CoachView";

export default function CoachPage() {
  // the view reads ?patient=, which needs a Suspense boundary in this Next.js
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <CoachView />
    </Suspense>
  );
}
