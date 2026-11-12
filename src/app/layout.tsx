import type { Metadata, Viewport } from "next";
import { Jost } from "next/font/google";
import "./globals.css";
import { SITE } from "@/components/landing/tools/catalog";

/* The root layout for every page, public and signed in.
   Jost, everywhere (inrange brand guidelines v1.1): headings in Medium 500,
   body in Regular 400. The wordmark is outlined from Jost Medium. */
const display = Jost({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: "variable",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Doctor-led weight and diabetes care in India | inrange",
  description:
    "Doctor-led care for obesity and type 2 diabetes in India. A free check, then a 30-minute video consultation with a doctor, blood tests at home, Indian nutrition and one care team.",
  openGraph: {
    title: "inrange: doctor-led care for weight and blood sugar",
    description:
      "Doctor-led care for obesity and type 2 diabetes. A free check, then a 30-minute video consultation with a doctor, blood tests at home and one care team.",
    locale: "en_IN",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  // iOS Safari draws edge to edge; opting in makes env(safe-area-inset-*) real,
  // so the floating nav and action dock can keep clear of the system UI
  viewportFit: "cover",
  themeColor: "#0a0b0a",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IN" className={display.variable} suppressHydrationWarning>
      <head>
        {/* Reveal states must exist before first paint, or content flashes and then hides. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
      </head>
      <body>
        {children}
        {/* Start the reveals already on screen at first paint, without waiting for the page's JavaScript
            (about two seconds on a mid-range phone). Two frames later, so the transition still plays. The
            main content then counts as visible straight away, which is what Google measures (LCP). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "requestAnimationFrame(function(){requestAnimationFrame(function(){var h=innerHeight;document.querySelectorAll('[data-reveal]').forEach(function(e){if(e.getBoundingClientRect().top<h*0.88)e.classList.add('in')})})})",
          }}
        />
      </body>
    </html>
  );
}
