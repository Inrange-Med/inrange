/* /patient-dashboard/resources: short videos and reads for where the patient is in care. */

import type { Metadata } from "next";
import ResourcesView from "./components/ResourcesView";

export const metadata: Metadata = { title: "Resources | InRange" };

export default function ResourcesPage() {
  return <ResourcesView />;
}
