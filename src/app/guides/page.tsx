import type { Metadata } from "next";
import Hub from "@/components/landing/tools/Hub";
import { GUIDES, TOOLS } from "@/components/landing/tools/catalog";

const DESC =
  "Plain guides to blood sugar, HbA1c, prediabetes, fatty liver and fasting with diabetes, written for adults in India, with tables, sources and Hinglish answers.";

export const metadata: Metadata = {
  title: "Guides to blood sugar, prediabetes and fatty liver | inrange",
  description: DESC,
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "Guides to blood sugar, prediabetes and fatty liver",
    description: DESC,
    url: "/guides",
    locale: "en_IN",
    type: "website",
  },
};

export default function Page() {
  return (
    <Hub
      path="/guides"
      tag="Blog"
      title={["Plain answers,", "with the numbers."]}
      lede="Short guides to the reports and readings people bring to a doctor, written for adults in India. Each one opens with the answer, shows the numbers in a table and lists its sources."
      items={GUIDES}
      also={{
        tag: "Free tools",
        title: ["Free tools,", "built on Indian numbers."],
        href: "/tools",
        label: "All tools",
        items: TOOLS,
      }}
      description={DESC}
    />
  );
}
