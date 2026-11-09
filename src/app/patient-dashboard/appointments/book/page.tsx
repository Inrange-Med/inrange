/* /patient-dashboard/appointments/book: say what the consultation is about, then choose a time (BookAppointmentView). */

import type { Metadata } from "next";
import BookAppointmentView from "./components/BookAppointmentView";

export const metadata: Metadata = { title: "Book a consultation | InRange" };

export default function BookAppointmentPage() {
  return <BookAppointmentView />;
}
