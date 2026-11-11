import type { Metadata } from "next";
import Link from "next/link";
import Motion from "@/components/landing/Motion";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import { Mask, Tag } from "@/components/landing/ui";
import {
  SITE,
  UPDATED,
  UPDATED_LABEL,
} from "@/components/landing/tools/catalog";
import s from "@/components/landing/tools/ToolPage.module.css";

const DESC =
  "How inrange writes and checks its free tools and guides: Indian sources first, no predictions or medicine promotion, private calculators, medical review, updates and corrections.";

export const metadata: Metadata = {
  title: "Editorial standards: how we write and check our pages | inrange",
  description: DESC,
  alternates: { canonical: "/editorial-standards" },
  openGraph: {
    title: "How we write and check our pages",
    description: DESC,
    url: "/editorial-standards",
    locale: "en_IN",
    type: "website",
  },
};

const SECTIONS: { q: string; body: React.ReactNode }[] = [
  {
    q: "Indian sources first",
    body: (
      <p>
        Where Indian guidance exists, we use it: the 2025 Indian definition of
        obesity, ICMR and ICMR-NIN guidelines, the Indian Diabetes Risk Score
        and the Indian liver society. We add international sources, such as the
        American Diabetes Association, the World Health Organization and NICE,
        where they fill a gap. Every page lists its sources, and every number is
        checked against the original text.
      </p>
    ),
  },
  {
    q: "What we never do",
    body: (
      <ul>
        <li>
          Promise results. The weight loss calculator shows averages from
          published studies, with their sources, and says plainly that results
          vary and your doctor sets your target.
        </li>
        <li>Name or promote medicines, or suggest who should take them.</li>
        <li>
          Use testimonials, before and after pictures or superlatives about
          ourselves.
        </li>
        <li>
          Hide a result behind a sign-up, or ask for your phone number to show
          it.
        </li>
      </ul>
    ),
  },
  {
    q: "Your numbers stay on your device",
    body: (
      <p>
        Every calculator works inside your browser. Nothing you enter is sent to
        us, and results never appear in a web address. The only thing a tool
        remembers is your choice of units, such as kilograms or pounds, and it
        keeps that on your own device.
      </p>
    ),
  },
  {
    q: "Medical review",
    body: (
      <p>
        Pages are being reviewed by doctors registered with a State Medical
        Council. When a page has been reviewed, it shows the doctor&rsquo;s
        name, qualifications, registration number and the date, and until then
        it shows none. We use software, including AI tools, to help draft and
        check pages; every clinical figure is checked against its source, and
        only a registered doctor can mark a page as reviewed.
      </p>
    ),
  },
  {
    q: "Updates",
    body: (
      <p>
        Every page is checked at least once a year, and sooner when a guideline
        it relies on changes. The date on a page changes only when its content
        does.
      </p>
    ),
  },
  {
    q: "Corrections",
    body: (
      <p>
        If you find an error, write to{" "}
        <a href="mailto:care@inrangemed.com?subject=Correction">
          care@inrangemed.com
        </a>{" "}
        with &ldquo;Correction&rdquo; in the subject. We check every report, fix
        confirmed errors and note the change on the page.
      </p>
    ),
  },
];

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Editorial standards",
    url: `${SITE}/editorial-standards`,
    inLanguage: "en-IN",
    dateModified: UPDATED,
    description: DESC,
    about: {
      "@type": "Organization",
      name: "inrange",
      url: SITE,
      publishingPrinciples: `${SITE}/editorial-standards`,
    },
  };
  return (
    <>
      <Motion />
      <Nav home={false} />
      <main id="main" className={s.page}>
        <header className={`wrap ${s.head}`}>
          <nav className={s.crumbs} aria-label="Breadcrumb">
            <Link href="/">inrange</Link>
            <span aria-hidden="true">/</span>
            <Link href="/guides">Guides</Link>
          </nav>
          <Tag>Editorial standards</Tag>
          <Mask
            as="h1"
            className={`h2 ${s.title}`}
            lines={["How we write", "and check these pages."]}
            soft={1}
          />
          <p
            className={s.answer}
            suppressHydrationWarning
            data-reveal="rise"
            style={{ "--d": "160ms" } as React.CSSProperties}
          >
            Our free tools and guides answer the questions people bring to a
            doctor, with the numbers used for Indians. These are the rules every
            page follows.
          </p>
        </header>
        <div className={`wrap ${s.body}`}>
          {SECTIONS.map((sec) => (
            <section key={sec.q} className={s.sec}>
              <h2 className={`h3 ${s.q}`}>{sec.q}</h2>
              <div className={s.prose}>{sec.body}</div>
            </section>
          ))}
          <p className={s.updated}>Last updated {UPDATED_LABEL}.</p>
        </div>
      </main>
      <Footer home={false} field={false} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
