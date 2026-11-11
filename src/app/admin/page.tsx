/* /admin: eligibility reviews waiting for the team and the ones decided lately. The page sets the title; ReviewsView loads them. */

import type { Metadata } from "next";
import ReviewsView from "./components/ReviewsView";

export const metadata: Metadata = { title: "Reviews | inrange" };

export default function ReviewsPage() {
  return <ReviewsView />;
}
