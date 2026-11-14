/**
 * The free check (every "Book consultation" on the public site lands here): height, weight, age and
 * health questions, the BMI explained on the Indian scale, what happens next, then the sign-in sheet
 * for the mobile number (client call, 12 Nov 2026). The check runs in the browser
 * (components/landing/check/FreeCheck.tsx); without JavaScript the page offers the /sign-in page.
 */
import type { Metadata } from "next";
import FreeCheck from "@/components/landing/check/FreeCheck";
import LoginSheet from "@/components/landing/LoginSheet";

export const metadata: Metadata = {
  title: "Free check | inrange",
  description:
    "Two minutes: your height, weight and health, your BMI on the Indian scale and what it means, then what happens next with an inrange doctor.",
  alternates: { canonical: "/assessment" },
  // a step in booking, not a page to arrive at from search
  robots: { index: false, follow: true },
};

export default function AssessmentPage() {
  return (
    <>
      <noscript>
        <p style={{ padding: 24 }}>
          The free check needs JavaScript. You can{" "}
          <a href="/sign-in">sign in with your mobile number</a> instead.
        </p>
      </noscript>
      <FreeCheck />
      <LoginSheet />
    </>
  );
}
