/* /patient-dashboard/payments: what the patient has paid, newest first (doctor portal v2, Home's third row). */

import type { Metadata } from "next";
import PaymentsView from "./components/PaymentsView";

export const metadata: Metadata = { title: "Payments | inrange" };

export default function PaymentsPage() {
  return <PaymentsView />;
}
