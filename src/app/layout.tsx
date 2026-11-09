/** The root layout for every page: the two brand fonts (Jost, Wix Madefor Text), globals.css and the "js" class set before paint. */

import type { Metadata, Viewport } from "next";
import { Jost, Wix_Madefor_Text } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const display = Jost({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: "variable",
});

const text = Wix_Madefor_Text({
  variable: "--font-text",
  subsets: ["latin", "latin-ext"],
  weight: "variable",
});

/**
 * The site-wide defaults (the team's own landing copy). Pages set their own titles ("Care | InRange");
 * every signed-in area, sign-in, onboarding and the video call set noindex in their own layout or page.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://inrangemed.com"),
  title: {
    default: "InRange | Doctor-led care for weight and blood sugar",
    template: "%s",
  },
  description:
    "A doctor-led programme for obesity and type 2 diabetes in India. A free check, a free first consultation, blood tests at home, nutrition built on Indian food, and a care team that follows your progress every week.",
  openGraph: {
    title: "InRange | Doctor-led care for weight and blood sugar",
    description:
      "A doctor-led programme for obesity and type 2 diabetes. Consultation, tests, nutrition and follow-up in one plan.",
    locale: "en_IN",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#0B1F22",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-IN"
      className={`${display.variable} ${text.variable}`}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="add-js-class"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
