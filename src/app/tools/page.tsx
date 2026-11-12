import type { Metadata } from "next";
import Hub from "@/components/landing/tools/Hub";
import { GUIDES, TOOLS } from "@/components/landing/tools/catalog";

const DESC =
  "Free tools for weight and blood sugar, built on Indian thresholds: diabetes risk score, weight loss, BMI, ideal weight, waist, vegetarian protein, blood sugar and HbA1c. Private, no sign-up.";

export const metadata: Metadata = {
  title: "Free health tools for weight and blood sugar | inrange",
  description: DESC,
  alternates: { canonical: "/tools" },
  openGraph: {
    title: "Free tools for weight and blood sugar",
    description: DESC,
    url: "/tools",
    locale: "en_IN",
    type: "website",
  },
};

export default function Page() {
  return (
    <Hub
      path="/tools"
      tag="Free tools"
      title={["Free tools,", "built on Indian numbers."]}
      lede="Honest answers to the questions people bring to a doctor, measured against the thresholds used for Indians. Everything runs on your device, in kilograms or pounds, centimetres or feet, and nothing you enter is saved."
      items={TOOLS}
      also={{
        tag: "Guides",
        title: ["Plain answers,", "with the numbers."],
        href: "/guides",
        label: "All guides",
        items: GUIDES,
      }}
      description={DESC}
    />
  );
}
