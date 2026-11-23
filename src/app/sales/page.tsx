/* /sales: a salesperson's customers. SalesView loads them; ?customer= opens one. */

import { Suspense } from "react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import SalesView from "./components/SalesView";

export default function SalesPage() {
  // the view reads ?customer=, which needs a Suspense boundary in this Next.js
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <SalesView />
    </Suspense>
  );
}
