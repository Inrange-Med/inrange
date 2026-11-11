import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import Motion from "../Motion";
import ContourField from "../ContourField";
import BasicsPlate from "./BasicsPlate";
import Nav from "../Nav";
import Footer from "../Footer";
import Faq from "../Faq";
import WaitlistButton from "../Waitlist";
import DoctorBench from "../DoctorBench";
import { LISTED_DOCTORS } from "../doctor-data";
import { Art, Cta, Mask, Tag } from "../ui";
import { ASSESSMENT_PRICE, INCLUDED, inr, PLANS } from "../plans";
import { Planner } from "../Pricing";
import { PROGRAMMES, programmeHref, type Programme } from "../programme-data";
import { SITE, find } from "../tools/catalog";
import { PAGES, SUGAR_LINES } from "./programme-pages";
import p from "./Page.module.css";
import v from "./ProgrammeView.module.css";
import t from "../tools/ToolPage.module.css";

export const UPDATED = "2026-10-16";
const UPDATED_LABEL = "16 October 2026";

const LIVE_STEPS = [
  { name: "Eligibility check", text: "Two minutes online. A doctor reads your answers before anything is booked." },
  { name: "Assessment", text: "A counsellor call, home blood tests if you need them, then 30 minutes by video with your doctor." },
  { name: "Your plan", text: "Food, strength, sleep and, only if clinically appropriate, medicine. You pay only once your doctor recommends it." },
  { name: "Every month", text: "Your doctor reviews your readings and adjusts the plan. A one-minute check-in each week keeps it on track." },
];
const SOON_STEPS = [
  { name: "Join the waitlist", text: "Your name, mobile and city. We use them only to tell you when the programme opens." },
  { name: "Assessment", text: "A counsellor call, home blood tests, then a private video consultation with a doctor." },
  { name: "Your plan", text: "Agreed with your doctor, with the tests and follow-up it needs, priced before you pay." },
  { name: "Follow-up", text: "Monthly reviews with the same doctor, and your care team in the app and on WhatsApp." },
];

/**
 * One programme's page: the direct answer and the person first, then who it suits, what a doctor looks
 * at, how it runs, how it fits Indian life, the doctors, what it costs, questions and sources. The same
 * anatomy for open and coming-soon programmes, so a waitlist page is already the real page.
 */
export default function ProgrammeView({ programme }: { programme: Programme }) {
  const d = PAGES[programme.key];
  const live = programme.live;
  const url = `${SITE}${programmeHref(programme)}`;
  const steps = live ? LIVE_STEPS : SOON_STEPS;
  const others = PROGRAMMES.filter((x) => x.key !== programme.key);
  const related = d.related.map(find).filter((r) => r !== undefined);
  const from = PLANS[PLANS.length - 1];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "MedicalWebPage",
        "@id": `${url}#page`,
        url,
        name: d.seo.replace(/ \| inrange$/, ""),
        description: d.description,
        inLanguage: "en-IN",
        dateModified: UPDATED,
        isPartOf: { "@id": `${SITE}/#website` },
        about: { "@type": "MedicalCondition", name: d.condition },
        audience: { "@type": "PeopleAudience", geographicArea: { "@type": "Country", name: "India" } },
        publisher: { "@id": `${SITE}/#org` },
        citation: d.sources.map((x) => x.label),
      },
      {
        "@type": "FAQPage",
        mainEntity: d.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "inrange", item: SITE },
          { "@type": "ListItem", position: 2, name: "Programmes", item: `${SITE}/programmes` },
          { "@type": "ListItem", position: 3, name: programme.name, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <Motion />
      <Nav home={false} />
      <main id="main" className={p.page} data-no-dock={live ? undefined : true}>
        {/* the person and the answer on the brand's dark ground, under the moving isolines, as on the homepage */}
        <div className={v.heroBand} data-dark>
        <ContourField className={v.field} density={10} lineAlpha={0.12} signalAlpha={0.35} seed={programme.key.length * 7} interactive={false} />
        <header className={`wrap ${v.hero}`}>
          {/* the title on one line across the page; the answer and the person beneath it */}
          <div className={v.heroHead}>
            <nav className={p.crumbs} aria-label="Breadcrumb">
              <Link href="/">inrange</Link>
              <span aria-hidden="true">/</span>
              <Link href="/programmes">Programmes</Link>
            </nav>
            <Tag dark>{live ? programme.name : `${programme.name}, coming soon`}</Tag>
            <Mask as="h1" className={`h2 ${v.title}`} lines={d.title} soft={1} />
          </div>
          <div className={v.heroCopy}>
            {/* no entrance animation: the answer is the page's largest text block and paints at once */}
            <p className={p.answer}>{d.answer}</p>
            <div className={p.actions}>
              {live ? (
                <>
                  <Cta variant="light" />
                  <Link href="/#pricing" className={p.quiet}>
                    See pricing
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <>
                  <WaitlistButton programme={programme.key} name={programme.name} covers={programme.covers} className="btn btn--signal" />
                  <Link href="/programmes/weight-care" className={p.quiet}>
                    See what is open now
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </>
              )}
            </div>
            {/* the value at a glance, before any scrolling: what it costs and how it runs */}
            <dl className={v.facts}>
              {(live
                ? [
                    ["Plans from", `${inr(from.price / from.months)} a month`],
                    ["Assessment", `${inr(ASSESSMENT_PRICE)}, once`],
                    ["Your doctor", "Every month"],
                    ["Blood tests", "At home"],
                  ]
                : [
                    ["Opening", "Soon"],
                    ["Waitlist", "Free to join"],
                    ["Consultations", "By video"],
                    ["Blood tests", "At home"],
                  ]
              ).map(([k, val]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{val}</dd>
                </div>
              ))}
            </dl>
            {live && (
              <p className={v.factsNote}>
                Indicative prices. Medication only if your doctor judges it clinically appropriate, billed separately. Not everyone is prescribed medication.
              </p>
            )}
            <p className={p.byline}>
              Updated <time dateTime={UPDATED}>{UPDATED_LABEL}</time> &middot; <a href="#sources">{d.sources.length} sources</a> &middot;{" "}
              <a href="/editorial-standards">How we write these</a>
            </p>
          </div>
          <figure className={v.heroPhoto} suppressHydrationWarning data-reveal="wipe">
            <Image src={programme.img} alt={programme.alt} fill priority sizes="(max-width: 1023px) 100vw, 44vw" style={{ objectPosition: programme.focus }} />
            {!live && <span className="soonchip">Coming soon</span>}
          </figure>
        </header>
        </div>

        {/* the question people search, answered plainly */}
        <section className={`${p.sec} ${p.secPaper}`} aria-labelledby="explain-title">
          <div className={`wrap ${v.explain}`}>
            <div className={v.explainHead}>
              <Tag>The basics</Tag>
              <h2 id="explain-title" className="h2">
                {d.explain.q}
              </h2>
            </div>
            <div className={v.prose}>
              {d.explain.body}
              {programme.key === "diabetes" && (
                <div className={p.tableWrap}>
                  <table className={p.table}>
                    <caption>Diagnosis thresholds: ICMR 2018; American Diabetes Association 2026. Prevalence: ICMR-INDIAB-17, 2023.</caption>
                    <thead>
                      <tr>
                        <th scope="col">Test</th>
                        <th scope="col">Normal</th>
                        <th scope="col">Prediabetes</th>
                        <th scope="col">Diabetes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SUGAR_LINES.map((r) => (
                        <tr key={r.test}>
                          <th scope="row" className={v.wrapCell}>
                            {r.test}
                          </th>
                          <td>{r.normal}</td>
                          <td>{r.pre}</td>
                          <td>{r.dm}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {d.explain.caption && programme.key !== "diabetes" && <p className={v.cite}>{d.explain.caption}</p>}
            </div>
            <BasicsPlate kind={programme.key} />
          </div>
        </section>

        <section className={p.sec} aria-labelledby="who-title">
          <Art kind="arcs" className={p.cornerArt} />
          <div className="wrap">
            <div className={`${p.secHead} ${p.secHeadSplit}`}>
              <Tag>Who it is for</Tag>
              <Mask id="who-title" className="h2" lines={d.heads.who} soft={1} />
              <p className="lede" suppressHydrationWarning data-reveal="rise" style={{ "--d": "160ms" } as React.CSSProperties}>
                Your doctor confirms it at your assessment, before you pay for a plan.
              </p>
            </div>
            <div className={v.who}>
              <div>
                <h3 className={v.whoK}>It may suit you if</h3>
                <ul className={v.ticks}>
                  {d.suits.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                {d.tool && (
                  <Link href={d.tool.href} className={p.quiet} style={{ marginTop: 12 }}>
                    {d.tool.label}
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                )}
              </div>
              <div>
                <h3 className={v.whoK}>Your doctor will talk with you first if</h3>
                <ul className={v.dashes}>
                  {d.first.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className={`${p.sec} ${p.secPaper}`} aria-labelledby="checks-title">
          <Art kind="ticks" className={p.tickArt} />
          <div className="wrap">
            <div className={`${p.secHead} ${p.secHeadSplit}`}>
              <Tag>What your doctor looks at</Tag>
              <Mask id="checks-title" className="h2" lines={d.heads.checks} soft={1} />
              <p className="lede" suppressHydrationWarning data-reveal="rise" style={{ "--d": "160ms" } as React.CSSProperties}>
                {live
                  ? "A lab collects samples at home, and every result goes straight into your record."
                  : "When the programme opens, a lab will collect samples at home."}
              </p>
            </div>
            <div className={p.tableWrap}>
              <table className={`${p.table} ${v.checks}`}>
                <caption>{d.checksCaption}</caption>
                <thead>
                  <tr>
                    <th scope="col">What</th>
                    <th scope="col">Why it matters</th>
                    <th scope="col">How often</th>
                  </tr>
                </thead>
                <tbody>
                  {d.checks.map((r) => (
                    <tr key={r.measure}>
                      <th scope="row">{r.measure}</th>
                      <td>{r.why}</td>
                      <td className={p.quietCell}>{r.when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className={p.sec} aria-labelledby="how-title">
          <div className="wrap">
            <div className={`${p.secHead} ${p.secHeadSplit}`}>
              <Tag>{live ? "How it works" : "How it will work"}</Tag>
              <Mask id="how-title" className="h2" lines={["Four steps,", "one care team."]} soft={1} />
              <p className="lede" suppressHydrationWarning data-reveal="rise" style={{ "--d": "160ms" } as React.CSSProperties}>
                The same doctor stays with you. Your care team is in the app and on WhatsApp between reviews.
              </p>
            </div>
            <ol className={p.stages}>
              {steps.map((x, i) => (
                <li key={x.name} className={p.stage} suppressHydrationWarning data-reveal="rise" style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>
                  <span className={p.stop} aria-hidden="true" />
                  <h3 className={p.stageName}>{x.name}</h3>
                  <p className={p.stageText}>{x.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* how it fits an Indian household: the one dark band on the page, a person beside the plan */}
        <section className={v.life} aria-labelledby="life-title">
          <div className={`wrap ${v.lifeGrid}`}>
            <div className={v.lifeHead}>
              <Tag dark>Built for Indian life</Tag>
              <Mask id="life-title" className={`h2 ${v.lifeTitle}`} lines={d.heads.life} soft={1} />
            </div>
            <figure className={v.lifePhoto} suppressHydrationWarning data-reveal="wipe">
              <Image src={d.lifeImg.src} alt={d.lifeImg.alt} fill sizes="(max-width: 1023px) 100vw, 40vw" style={{ objectPosition: d.lifeImg.focus }} />
            </figure>
            <div className={v.lifeCopy}>
              <ul className={v.lifeList}>
                {d.life.map((x, i) => (
                  <li key={x.name} suppressHydrationWarning data-reveal="rise" style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>
                    <h3 className={v.lifeName}>{x.name}</h3>
                    <p>{x.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {live && LISTED_DOCTORS.length > 0 && (
          <section className={`${p.sec} ${p.secPaper}`} aria-labelledby="team-title">
            <div className="wrap">
              <div className={p.secHead}>
                <Tag>Your doctors</Tag>
                <Mask id="team-title" className="h2" lines={["The doctors", "on this programme."]} soft={1} />
                <p className="lede" suppressHydrationWarning data-reveal="rise" style={{ "--d": "160ms" } as React.CSSProperties}>
                  The same doctor stays with you throughout, and only your doctor prescribes.
                </p>
              </div>
              <DoctorBench doctors={LISTED_DOCTORS} plain />
            </div>
          </section>
        )}

        <section id={live ? "pricing" : undefined} className={`${p.sec} ${live && LISTED_DOCTORS.length > 0 ? "" : p.secPaper}`} aria-labelledby="cost-title">
          <div className="wrap">
            <div className={`${p.secHead} ${p.secHeadSplit}`}>
              <Tag>What it costs</Tag>
              {live ? (
                <Mask id="cost-title" className="h2" lines={["One package,", `from ${inr(from.price / from.months)} a month.`]} soft={1} />
              ) : (
                <Mask id="cost-title" className="h2" lines={["Prices before", "it opens."]} soft={1} />
              )}
              <p className="lede" suppressHydrationWarning data-reveal="rise" style={{ "--d": "160ms" } as React.CSSProperties}>
                {live
                  ? "Indicative prices. Choose a length to see what it covers. You pay only after your doctor's review."
                  : "We publish the itemised price before the programme opens. The waitlist is free."}
              </p>
            </div>
            {live ? (
              <>
                <Planner />
              </>
            ) : (
              <ul className={`${v.inc} ${v.incSoon}`}>
                {/* what the package will hold, with no figure until it is priced */}
                {INCLUDED.slice(1).map(([a, b]) => (
                  <li key={a}>
                    <span>{a}</span>
                    <span className={v.incVal} data-kind={b}>
                      {b === "Included" ? "Planned" : b}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <Faq items={d.faq} id="programme-questions" tag="Questions" title={d.heads.faq} />

        <section className={`${p.sec} ${v.ref}`} aria-label="Sources and related pages">
          <div className={`wrap ${v.refGrid}`}>
            <div id="sources">
              <h2 className={`h3 ${v.refK}`}>Sources</h2>
              <ol className={t.sources}>
                {d.sources.map((x) => (
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
              <p className={t.updated} style={{ marginTop: 16 }}>
                Last updated {UPDATED_LABEL}. General health information for adults in India; it does not replace a consultation,
                diagnosis or treatment.
              </p>
            </div>
            <div>
              <h2 className={`h3 ${v.refK}`}>Free tools and guides</h2>
              <ul className={t.related}>
                {related.map((r) => (
                  <li key={r.href}>
                    <a href={r.href}>
                      <span className={t.relName}>{r.name}</span>
                      <span className={t.relAsks}>{r.asks}</span>
                      <ArrowUpRight size={18} className={t.relArrow} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <nav className={`${p.sec} ${p.secPaper}`} aria-label="Other programmes">
          <div className="wrap">
            <h2 className={`h3 ${v.refK}`}>Other programmes</h2>
            <ul className={v.others}>
              {others.map((x) => (
                <li key={x.key}>
                  <a href={programmeHref(x)} className={v.other}>
                    <span className={v.otherPhoto}>
                      <Image src={x.img} alt="" fill sizes="(max-width: 767px) 30vw, 200px" style={{ objectPosition: x.focus }} />
                    </span>
                    <span className={v.otherName}>
                      <span className={v.long}>{x.name}</span>
                      <span className={v.brief}>{x.short}</span>
                    </span>
                    <span className={v.otherState} data-live={x.live || undefined}>
                      {x.live ? "Open now" : "Coming soon"}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </main>
      <Footer
        home={false}
        close={
          live
            ? undefined
            : {
                title: ["Be the first", "to know."],
                text: `Leave your name, mobile and city. We write once, when ${programme.key === "sexual" ? "sexual health" : programme.name} opens.`,
                action: <WaitlistButton programme={programme.key} name={programme.name} covers={programme.covers} className="btn btn--signal" />,
              }
        }
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
