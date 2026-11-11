import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Motion from "@/components/landing/Motion";
import ContourField from "@/components/landing/ContourField";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import Faq from "@/components/landing/Faq";
import DoctorBench from "@/components/landing/DoctorBench";
import { Dial, FACTS } from "@/components/landing/Doctors";
import { DOCTORS, LISTED_DOCTORS } from "@/components/landing/doctor-data";
import { Art, Cta, Mask, Tag } from "@/components/landing/ui";
import { SITE } from "@/components/landing/tools/catalog";
import p from "@/components/landing/pages/Page.module.css";
import d from "@/components/landing/Doctors.module.css";

/*
  The doctors, as a page of their own: a plain directory of registered doctors who agreed to be listed
  (CLAUDE.md: no ratings, years, patient counts or quotes), how they work, what the first consultation
  covers, and the questions people ask about them. Physician markup only for real, registered entries.
*/

const UPDATED = "2026-10-16";
const UPDATED_LABEL = "16 October 2026";

const DESC =
  "inrange's doctors in India: physicians registered with the NMC or a State Medical Council, consulting by video, with the same doctor from your first consultation.";

export const metadata: Metadata = {
  title: "Our doctors: registered physicians in India | inrange",
  description: DESC,
  alternates: { canonical: "/doctors" },
  openGraph: {
    title: "inrange doctors",
    description: DESC,
    url: "/doctors",
    locale: "en_IN",
    type: "website",
  },
};

const CONSULT = [
  {
    name: "Before",
    text: "A counsellor takes your history, and a lab comes home for blood tests if you have none from the last 90 days. Your doctor reads both before you meet.",
  },
  {
    name: "Thirty minutes",
    text: "By video, from home or work. Your doctor goes through your results and what you want to change, and explains every option.",
  },
  {
    name: "Your plan",
    text: "In the app the same day: food, strength, sleep and, only if clinically appropriate, medicine.",
  },
  {
    name: "Every month",
    text: "The same doctor reviews your readings and adjusts the plan. Your care team is in the app and on WhatsApp in between.",
  },
];

const QA = [
  {
    q: "Are inrange doctors registered?",
    a: "Yes. Every doctor is registered with the National Medical Commission or a State Medical Council, and each profile shows the council and registration number.",
  },
  {
    q: "Will I see the same doctor every time?",
    a: "Yes. The doctor who writes your plan stays with you for the whole programme and reviews it every month.",
  },
  {
    q: "Who prescribes medicine?",
    a: "Only a doctor on your care team, and only if they judge it clinically appropriate after your assessment and blood tests. Not everyone is prescribed medication, and doctors are never paid per prescription.",
  },
  {
    q: "Are consultations only by video?",
    a: "Yes, by secure video from anywhere in India, under the Telemedicine Practice Guidelines. If you need a physical examination, your doctor will refer you.",
  },
  {
    q: "Can I keep my own doctor or diabetologist?",
    a: "Yes. With your permission we share your plan and results with them, so you all work from the same record.",
  },
  {
    q: "Which languages do the doctors speak?",
    a: "Each profile lists the languages that doctor consults in. Your care team on WhatsApp replies in English, Hindi or Hinglish.",
  },
];

// structured data only for real doctors with a registration number (samples never qualify)
const physicians = DOCTORS.map((x) => ({
  "@type": "Physician",
  name: x.name,
  hasCredential: x.degrees,
  ...(x.languages ? { knowsLanguage: x.languages.split(/,\s*/) } : {}),
  ...(x.reg
    ? {
        identifier: {
          "@type": "PropertyValue",
          name: `${x.council} registration`,
          value: x.reg,
        },
      }
    : {}),
  worksFor: { "@id": `${SITE}/#org` },
}));

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${SITE}/doctors#page`,
      url: `${SITE}/doctors`,
      name: "inrange doctors",
      description: DESC,
      inLanguage: "en-IN",
      dateModified: UPDATED,
      isPartOf: { "@id": `${SITE}/#website` },
      ...(physicians.length ? { mainEntity: physicians } : {}),
    },
    {
      "@type": "FAQPage",
      mainEntity: QA.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "inrange", item: SITE },
        {
          "@type": "ListItem",
          position: 2,
          name: "Doctors",
          item: `${SITE}/doctors`,
        },
      ],
    },
  ],
};

export default function DoctorsPage() {
  return (
    <>
      <Motion />
      <Nav home={false} />
      <main id="main" className={p.page}>
        <div className={p.darkBand} data-dark>
          <ContourField
            className={p.bandField}
            density={10}
            lineAlpha={0.12}
            signalAlpha={0.35}
            seed={23}
            interactive={false}
          />
          <header className={`wrap ${p.head} ${p.headDark} ${p.headPair}`}>
            <nav className={p.crumbs} aria-label="Breadcrumb">
              <Link href="/">inrange</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Doctors</span>
            </nav>
            <Tag dark>Doctors</Tag>
            <Mask
              as="h1"
              className="h2"
              lines={["A doctor who", "knows your file."]}
              soft={1}
            />
            <div className={p.headMain}>
              <p className={p.answer}>
                Every inrange doctor is <strong>registered</strong> with the
                National Medical Commission or a State Medical Council. You keep{" "}
                <strong>the same doctor</strong> from your first video
                consultation, and only your doctor prescribes, when it is
                clinically appropriate.
              </p>
              <div className={p.actions}>
                <Cta variant="light" />
                <Link href="/programmes" className={p.quiet}>
                  See the programmes
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>
            {/* what every profile carries, drawn as a record card in the brand's instrument style */}
            <figure
              className={p.spec}
              suppressHydrationWarning
              data-reveal="rise"
              style={{ "--d": "240ms" } as React.CSSProperties}
            >
              <figcaption className={p.specK}>
                On every doctor&rsquo;s profile
              </figcaption>
              <dl>
                {[
                  ["Name", "As registered"],
                  ["Qualifications", "As on the medical register"],
                  ["Registered with", "NMC or a State Medical Council"],
                  ["Consults", "By video, 30 minutes"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <p className={p.specFoot}>
                Never ratings, patient counts or quotes
              </p>
            </figure>
          </header>
        </div>

        {LISTED_DOCTORS.length > 0 && (
          <section
            className={`${p.sec} ${p.secPaper}`}
            aria-labelledby="team-title"
          >
            <div className="wrap">
              <div className={p.secHead}>
                <Tag>The care team</Tag>
                <Mask
                  id="team-title"
                  className="h2"
                  lines={["The doctors", "on your care team."]}
                  soft={1}
                />
                <p
                  className="lede"
                  suppressHydrationWarning
                  data-reveal="rise"
                  style={{ "--d": "160ms" } as React.CSSProperties}
                >
                  Every doctor is registered with the National Medical
                  Commission or a State Medical Council.
                </p>
              </div>
              <DoctorBench doctors={LISTED_DOCTORS} plain grid />
            </div>
          </section>
        )}

        <section className={p.sec} aria-labelledby="work-title">
          <Art kind="arcs" className={p.cornerArt} />
          <div className="wrap">
            <div className={p.secHead}>
              <Tag>How they work</Tag>
              <Mask
                id="work-title"
                className="h2"
                lines={["Held to the", "same four standards."]}
                soft={1}
              />
            </div>
            <dl className={`${d.facts} ${p.factsGrid}`}>
              {FACTS.map((f, i) => (
                <div
                  key={f.lead}
                  className={d.fact}
                  suppressHydrationWarning
                  data-reveal="rise"
                  style={{ "--d": `${i * 70}ms` } as React.CSSProperties}
                >
                  <Dial icon={f.icon} />
                  <dt>{f.lead}</dt>
                  <dd>{f.text}</dd>
                </div>
              ))}
            </dl>
            <a
              className={p.quiet}
              style={{ marginTop: 24 }}
              href="https://www.nmc.org.in/information-desk/indian-medical-register/"
              rel="noopener"
            >
              Check any registration number on the National Medical
              Commission&rsquo;s register
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>
        </section>

        <section
          className={`${p.sec} ${p.secPaper}`}
          aria-labelledby="consult-title"
        >
          <Art kind="ticks" className={p.tickArt} />
          <div className="wrap">
            <div className={p.secHead}>
              <Tag>Your first consultation</Tag>
              <Mask
                id="consult-title"
                className="h2"
                lines={["Thirty minutes,", "and a plan you agree."]}
                soft={1}
              />
              <p
                className="lede"
                suppressHydrationWarning
                data-reveal="rise"
                style={{ "--d": "160ms" } as React.CSSProperties}
              >
                Before, during and after you meet your doctor.
              </p>
            </div>
            <ol className={p.stages}>
              {CONSULT.map((x, i) => (
                <li
                  key={x.name}
                  className={p.stage}
                  suppressHydrationWarning
                  data-reveal="rise"
                  style={{ "--d": `${i * 90}ms` } as React.CSSProperties}
                >
                  <span className={p.stop} aria-hidden="true" />
                  <h3 className={p.stageName}>{x.name}</h3>
                  <p className={p.stageText}>{x.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <Faq
          items={QA}
          id="doctor-questions"
          tag="Questions"
          title={["Questions about", "the doctors."]}
        />
        <div className={p.updatedFoot}>
          <p className="wrap">
            Updated <time dateTime={UPDATED}>{UPDATED_LABEL}</time>
          </p>
        </div>
      </main>
      <Footer home={false} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
