import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Motion from "@/components/landing/Motion";
import ContourField from "@/components/landing/ContourField";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import Programmes from "@/components/landing/Programmes";
import { Cta, Mask, Tag } from "@/components/landing/ui";
import { inr, PLANS } from "@/components/landing/plans";
import { PROGRAMMES, programmeHref } from "@/components/landing/programme-data";
import { SITE } from "@/components/landing/tools/catalog";
import p from "@/components/landing/pages/Page.module.css";
import v from "@/components/landing/pages/ProgrammeView.module.css";

const DESC =
  "inrange's doctor-led programmes in India: weight care and type 2 diabetes care, open now, and PCOS and sexual health, opening soon. Video consultations, blood tests at home and a monthly doctor review.";

export const metadata: Metadata = {
  title: "Programmes: weight, diabetes, PCOS and sexual health | inrange",
  description: DESC,
  alternates: { canonical: "/programmes" },
  openGraph: {
    title: "inrange programmes",
    description: DESC,
    url: "/programmes",
    locale: "en_IN",
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${SITE}/programmes#page`,
      url: `${SITE}/programmes`,
      name: "inrange programmes",
      description: DESC,
      inLanguage: "en-IN",
      isPartOf: { "@id": `${SITE}/#website` },
      hasPart: PROGRAMMES.map((x) => ({
        "@type": "MedicalWebPage",
        name: x.name,
        url: `${SITE}${programmeHref(x)}`,
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "inrange", item: SITE },
        {
          "@type": "ListItem",
          position: 2,
          name: "Programmes",
          item: `${SITE}/programmes`,
        },
      ],
    },
  ],
};

const from = PLANS[PLANS.length - 1];
const FOR_SHORT = {
  weight: "A BMI over 23 on the Indian scale",
  diabetes: "Type 2 diabetes or prediabetes",
  pcos: "Adult women with PCOS or PCOD",
  sexual: "Private care for men and women",
} as const;
const CHOOSE = {
  weight: {
    for: "Adults with a BMI over 23 on the Indian scale, or a waist over 90 cm (men) or 80 cm (women)",
    rhythm: "A review every month",
    tests:
      "HbA1c, lipids, liver and thyroid tests, with waist and blood pressure",
  },
  diabetes: {
    for: "Adults with type 2 diabetes or prediabetes (HbA1c 5.7% or more)",
    rhythm: "A review every month, HbA1c every 3 months",
    tests: "HbA1c, kidney tests and lipids, with blood pressure",
  },
  pcos: {
    for: "Adult women with PCOS or PCOD, or its signs",
    rhythm: "Video consultations with the same doctor",
    tests: "Hormone tests, blood sugar and lipids",
  },
  sexual: {
    for: "Adult men and women with a sexual health concern",
    rhythm: "Private video consultations with the same doctor",
    tests:
      "Blood sugar, lipids and blood pressure, and testosterone where indicated",
  },
} as const;

function Status({ live }: { live: boolean }) {
  return live ? (
    <span>
      <span className={v.open}>Open now</span>, from{" "}
      {inr(from.price / from.months)} a month
    </span>
  ) : (
    <span>Coming soon, waitlist open</span>
  );
}

export default function ProgrammesPage() {
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
            seed={11}
            interactive={false}
          />
          <header className={`wrap ${p.head} ${p.headDark} ${p.headPair}`}>
            <nav className={p.crumbs} aria-label="Breadcrumb">
              <Link href="/">inrange</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Programmes</span>
            </nav>
            <Tag dark>Programmes</Tag>
            <Mask
              as="h1"
              className="h2"
              lines={["Choose your", "programme."]}
              soft={1}
            />
            <div className={p.headMain}>
              <p className={p.answer}>
                <strong>Weight care</strong> and <strong>diabetes care</strong>{" "}
                are open now. <strong>PCOS and hormonal health</strong> and{" "}
                <strong>sexual health</strong> open soon. Each has a doctor by
                video, blood tests at home and a care team in between.
              </p>
              <div className={p.actions}>
                <Cta variant="light" />
                <Link href="/#pricing" className={p.quiet}>
                  See pricing
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>
            {/* the four at a glance: a ruled record card, each row a link */}
            <nav
              className={`${p.spec} ${p.specHub}`}
              aria-label="The four programmes"
              suppressHydrationWarning
              data-reveal="rise"
              style={{ "--d": "240ms" } as React.CSSProperties}
            >
              <p className={p.specK}>Four programmes</p>
              <ul className={p.specList}>
                {PROGRAMMES.map((x) => (
                  <li key={x.key}>
                    <a href={programmeHref(x)}>
                      <span className={p.specName}>
                        {x.name}
                        <small>{FOR_SHORT[x.key]}</small>
                      </span>
                      <span
                        className={p.specState}
                        data-live={x.live || undefined}
                      >
                        {x.live
                          ? `Open, from ${inr(from.price / from.months)}/mo`
                          : "Coming soon"}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </header>
        </div>

        <Programmes bare />

        {/* which one is me: the four side by side, from the same words as each programme page */}
        <section
          className={`${p.sec} ${p.secPaper}`}
          aria-labelledby="choose-title"
        >
          <div className="wrap">
            <div className={`${p.secHead} ${p.secHeadSplit}`}>
              <Tag>Choosing a programme</Tag>
              <Mask
                id="choose-title"
                className="h2"
                lines={["Which one", "fits you."]}
                soft={1}
              />
              <p
                className="lede"
                suppressHydrationWarning
                data-reveal="rise"
                style={{ "--d": "160ms" } as React.CSSProperties}
              >
                Start with the free check. Your doctor confirms the right one at
                your first consultation.
              </p>
            </div>
            <div className={`${p.tableWrap} ${v.chooseWrap}`}>
              <table className={`${p.table} ${v.choose}`}>
                <caption>
                  Indicative prices for the open programmes. Medicine, only if
                  prescribed, is billed separately. Tests follow the Indian and
                  international guidelines listed on each programme page.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className={v.vh}>Compare</span>
                    </th>
                    {PROGRAMMES.map((x) => (
                      <th key={x.key} scope="col">
                        <a href={programmeHref(x)}>{x.name}</a>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">For</th>
                    {PROGRAMMES.map((x) => (
                      <td key={x.key} data-label={x.name}>
                        {CHOOSE[x.key].for}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">First tests</th>
                    {PROGRAMMES.map((x) => (
                      <td key={x.key} data-label={x.name}>
                        {CHOOSE[x.key].tests}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Your doctor</th>
                    {PROGRAMMES.map((x) => (
                      <td key={x.key} data-label={x.name}>
                        {CHOOSE[x.key].rhythm}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Status</th>
                    {PROGRAMMES.map((x) => (
                      <td key={x.key} data-label={x.name}>
                        <Status live={x.live} />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {/* phones: one block per programme, the same facts */}
            <ul className={v.chooseList}>
              {PROGRAMMES.map((x) => (
                <li key={x.key}>
                  <a href={programmeHref(x)} className={v.chooseName}>
                    {x.name}
                    <ArrowRight size={15} aria-hidden="true" />
                  </a>
                  <dl>
                    <div>
                      <dt>For</dt>
                      <dd>{CHOOSE[x.key].for}</dd>
                    </div>
                    <div>
                      <dt>First tests</dt>
                      <dd>{CHOOSE[x.key].tests}</dd>
                    </div>
                    <div>
                      <dt>Your doctor</dt>
                      <dd>{CHOOSE[x.key].rhythm}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <Status live={x.live} />
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
            <div className={p.actions} style={{ marginTop: 32 }}>
              <Cta />
              <Link href="/#pricing" className={p.quiet}>
                See pricing
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer home={false} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
