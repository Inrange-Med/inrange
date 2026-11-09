/* /patient-dashboard/care: the care team, the programme, blood tests and the next consultation (CareView). */

import type { Metadata } from "next";
import CareView from "./components/CareView";

export const metadata: Metadata = { title: "Your care | InRange" };

export default function CarePage() {
  return <CareView />;
}
