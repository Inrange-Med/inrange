/* /patient-dashboard/lab-tests/book: book a home blood test, one step a screen (BookLabTestView). */

import type { Metadata } from "next";
import BookLabTestView from "../components/BookLabTestView";

export const metadata: Metadata = { title: "Book a home test | InRange" };

export default function BookLabTestPage() {
  return <BookLabTestView />;
}
