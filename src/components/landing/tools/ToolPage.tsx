import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import Motion from "../Motion";
import Nav from "../Nav";
import Footer from "../Footer";
import { Mask, Tag } from "../ui";
import { SITE, TOOLS, UPDATED, UPDATED_LABEL, find } from "./catalog";
import Toc from "./Toc";
import s from "./ToolPage.module.css";

export { SITE, TOOLS, UPDATED };

/** a stable anchor for a question heading, so answers can be linked to directly */
export const anchor = (q: string) =>
  q
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

type Reviewer = {
  name: string;
  credentials: string;
  council: string;
  reg: string;
  date: string;
  href?: string;
};

/**
 * Every free tool and guide has the same anatomy, built to be read by people and quoted by
 * search and AI answers: a direct answer first, then the tool (server-rendered in its default
 * state, so crawlers see a worked example) or the key table, question-led sections with plain
 * tables, questions people ask, sources and related pages. No WebGL on these routes.
 */
export default function ToolPage({
  kind = "tool",
  slug,
  name,
  title,
  answer,
  points,
  tool,
  sections,
  faq,
  sources,
  description,
  related,
  about,
  schema = [],
  reviewer,
}: {
  kind?: "tool" | "guide";
  slug: string;
  name: string;
  title: string[];
  answer: ReactNode;
  /** a few plain facts under the answer, for guides */
  points?: ReactNode[];
  tool?: ReactNode;
  sections: { q: string; body: ReactNode }[];
  faq: { q: string; a: string }[];
  sources: { label: string; href?: string }[];
  description: string;
  /** hrefs of the pages to suggest next; defaults to the other tools */
  related?: string[];
  /** the condition the page is about, for structured data */
  about?: string;
  schema?: object[];
  /** shown only once a registered doctor has reviewed the page */
  reviewer?: Reviewer;
}) {
  const base = kind === "tool" ? "/tools" : "/guides";
  const url = `${SITE}${base}/${slug}`;
  const next = (related ?? TOOLS.map((t) => t.href))
    .filter((h) => !h.endsWith(`/${slug}`))
    .map(find)
    .filter((r) => r !== undefined);
  const guide = kind === "guide";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "MedicalWebPage",
        "@id": `${url}#page`,
        url,
        name: title.join(" "),
        headline: name,
        description,
        inLanguage: "en-IN",
        dateModified: UPDATED,
        audience: {
          "@type": "PeopleAudience",
          geographicArea: { "@type": "Country", name: "India" },
        },
        publisher: {
          "@type": "Organization",
          name: "inrange",
          url: SITE,
          publishingPrinciples: `${SITE}/editorial-standards`,
        },
        citation: sources.map((x) => x.label),
        ...(about ? { about: { "@type": "MedicalCondition", name: about } } : {}),
        ...(reviewer
          ? {
              lastReviewed: reviewer.date,
              reviewedBy: {
                "@type": "Person",
                name: reviewer.name,
                honorificSuffix: reviewer.credentials,
                ...(reviewer.href ? { url: `${SITE}${reviewer.href}` } : {}),
              },
            }
          : {}),
      },
      ...(guide
        ? []
        : [
            {
              "@type": "WebApplication",
              name,
              url,
              applicationCategory: "HealthApplication",
              operatingSystem: "Any",
              isAccessibleForFree: true,
              offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
            },
          ]),
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
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
            name: guide ? "Guides" : "Free tools",
            item: `${SITE}${base}`,
          },
          { "@type": "ListItem", position: 3, name, item: url },
        ],
      },
      ...schema,
    ],
  };

  return (
    <>
      <Motion />
      <Nav home={false} />
      <main id="main" className={s.page}>
        <header className={`wrap ${s.head} ${points ? s.headSplit : ""}`}>
          <div className={s.headMain}>
            <nav className={s.crumbs} aria-label="Breadcrumb">
              <Link href="/">inrange</Link>
              <span aria-hidden="true">/</span>
              <Link href={base}>{guide ? "Guides" : "Free tools"}</Link>
            </nav>
            <Tag>{guide ? "Guide" : "Free tool"}</Tag>
            <Mask as="h1" className={`h2 ${s.title}`} lines={title} soft={1} />
            {/* no entrance animation: this answer is the largest thing on screen, so it must paint at once (LCP) */}
          <p className={s.answer}>
              {answer}
            </p>
            <p className={s.byline}>
              {reviewer ? (
                <>
                  Medically reviewed by {reviewer.href ? <a href={reviewer.href}>{reviewer.name}</a> : reviewer.name},{" "}
                  {reviewer.credentials}, {reviewer.council} Reg. No. {reviewer.reg} &middot;{" "}
                </>
              ) : null}
              Updated <time dateTime={UPDATED}>{UPDATED_LABEL}</time> &middot;{" "}
              <a href="#sources">{sources.length} sources</a> &middot;{" "}
              <a href="/editorial-standards">How we write these</a>
            </p>
          </div>
          {points && (
            <aside
              className={s.keys}
              aria-label="Key points"
              suppressHydrationWarning data-reveal="rise"
              style={{ "--d": "220ms" } as React.CSSProperties}
            >
              <p className={s.keysK}>Key points</p>
              <ul className={s.points}>
                {points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </aside>
          )}
        </header>

        {tool && (
          <div className={`wrap ${s.toolWrap}`}>
            {tool}
            {!guide && (
              <noscript>
                <p className={s.updated}>
                  The calculator needs JavaScript. The example above and the tables below let you work it out by hand.
                </p>
              </noscript>
            )}
          </div>
        )}

        <div className={`wrap ${s.body}`}>
          <div className={guide ? s.article : s.flowPlain}>
            {guide && sections.length > 3 && (
              <Toc
                items={sections.map((sec) => ({
                  id: anchor(sec.q),
                  label: sec.q,
                }))}
              />
            )}
            <div className={s.flow}>
              {sections.map((sec) => (
                <section key={sec.q} className={s.sec} id={anchor(sec.q)}>
                  <h2 className={`h3 ${s.q}`}>{sec.q}</h2>
                  <div className={s.prose}>{sec.body}</div>
                </section>
              ))}

              <section className={s.sec} id="questions">
                <h2 className={`h3 ${s.q}`}>Questions people ask</h2>
                <div className={s.faq}>
                  {faq.map((f) => (
                    <details key={f.q} className={s.item}>
                      <summary>{f.q}</summary>
                      <p>{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>

              <section className={s.sec} id="sources">
                <h2 className={`h3 ${s.q}`}>Sources</h2>
                <ol className={s.sources}>
                  {sources.map((x) => (
                    <li key={x.label}>
                      {x.href ? (
                        <a href={x.href} rel="noopener">
                          {x.label}
                        </a>
                      ) : (
                        x.label
                      )}
                    </li>
                  ))}
                </ol>
                <p className={s.updated}>
                  Last updated {UPDATED_LABEL}. General health information for adults in India; it does not replace a
                  consultation, diagnosis or treatment.
                </p>
              </section>
            </div>
          </div>

          <section className={s.sec} aria-label="Keep reading">
            <h2 className={`h3 ${s.q}`}>{guide ? "Keep reading" : "More free tools"}</h2>
            <ul className={s.related}>
              {next.map((t) => (
                <li key={t.href}>
                  <a href={t.href}>
                    <span className={s.relName}>{t.name}</span>
                    <span className={s.relAsks}>{t.asks}</span>
                    <ArrowUpRight size={18} className={s.relArrow} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <Footer home={false} field={false} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
