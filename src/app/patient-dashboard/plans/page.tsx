/* /patient-dashboard/plans: the plan, the plans to choose from, and invoices (PlansView). */

import type { Metadata } from "next";
import PlansView from "./components/PlansView";

export const metadata: Metadata = { title: "Plan and payments | InRange" };

export default function PlansPage() {
  return <PlansView />;
}
