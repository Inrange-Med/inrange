/* /admin/doctors: the doctor roster, adding a doctor and editing one. The page sets the title; DoctorsView loads them. */

import type { Metadata } from "next";
import DoctorsView from "./components/DoctorsView";

export const metadata: Metadata = { title: "Doctors | InRange" };

export default function DoctorsPage() {
  return <DoctorsView />;
}
