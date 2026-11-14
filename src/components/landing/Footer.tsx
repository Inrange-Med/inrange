import ContourField from "./ContourField";
import { PROGRAMMES, programmeHref } from "./programme-data";
import { Cta, Mask, Wordmark } from "./ui";
import { COMPANY } from "./company";
import s from "./Footer.module.css";

const COLS = [
  {
    title: "Programmes",
    links: [...PROGRAMMES.map((p) => [p.short, programmeHref(p)]), ["Plans", "/#pricing"]],
  },
  {
    title: "inrange",
    links: [
      ["How it works", "#how"],
      ["What we measure", "#measures"],
      ["Doctors", "/doctors"],
      ["Questions", "#questions"],
    ],
  },
  {
    title: "Free resources",
    links: [
      ["All free tools", "/tools"],
      ["Diabetes risk score", "/tools/diabetes-risk-score"],
      ["Weight loss calculator", "/tools/weight-loss-calculator"],
      ["Blood sugar chart", "/guides/blood-sugar-level-chart"],
      ["All guides", "/guides"],
    ],
  },
  {
    title: "Contact and legal",
    links: [
      [COMPANY.email, `mailto:${COMPANY.email}`],
      ["Privacy policy", "/privacy"],
      ["Terms of service", "/terms"],
      ["Cancellation and refunds", "/refund"],
      ["Grievance officer", "/grievance"],
    ],
  },
];

/** `field`: the WebGL texture; off on content pages, where speed on mid-range phones comes first. */
export default function Footer({
  home = true,
  field = true,
  notes,
  close,
}: {
  home?: boolean;
  field?: boolean;
  /** the closing call: a coming-soon page closes on its waitlist, never on a booking it cannot take */
  close?: { title: string[]; text: string; action: React.ReactNode };
  /** numbered sources for figures on the page, shown as footnotes above the legal text */
  notes?: React.ReactNode[];
}) {
  const base = home ? "" : "/";
  return (
    <footer id="foot" className={s.foot}>
      {field && <ContourField className={s.field} density={10} lineAlpha={0.1} signalAlpha={0.45} seed={17} />}
      <div className={`wrap ${s.cta}`}>
        <Mask className={`display ${s.title}`} lines={close?.title ?? ["Start with", "two minutes."]} soft={1} />
        <div className={s.ctaSide} suppressHydrationWarning data-reveal="rise" style={{ "--d": "200ms" } as React.CSSProperties}>
          <p>
            {close?.text ??
              "Answer a few questions and see what your BMI means. Then come your blood tests and your doctor, with every fee shown first."}
          </p>
          {close?.action ?? <Cta variant="light" />}
        </div>
      </div>

      <div className={`wrap ${s.base}`}>
        <div className={s.brand} suppressHydrationWarning data-reveal="rise">
          <Wordmark height={34} sting />
          <p>Doctor-led care for weight and diabetes, with PCOS and sexual health opening soon. Consultations by video, anywhere in India.</p>
        </div>
        <nav className={s.cols} aria-label="Footer">
          {COLS.map((c) => (
            <div key={c.title}>
              <p className={s.colTitle}>{c.title}</p>
              <ul>
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    <a href={href.startsWith("#") ? base + href : href}>{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className={s.legal}>
          {notes && (
            <ol className={s.notes} id="notes" aria-label="Notes">
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ol>
          )}
          <p>
            inrange provides medical consultations and a care programme through registered medical practitioners, and
            runs its own licensed pharmacy, stocked through licensed distributors. Video consultations follow the Telemedicine Practice Guidelines, 2020. inrange
            does not advertise any medicine. Any prescription is issued only by a registered medical practitioner after
            clinical assessment, where medically appropriate, and is dispensed by a registered pharmacist, at inrange&rsquo;s
            pharmacy or at any licensed pharmacy the patient chooses.
          </p>
          <p>
            Content on this site is general health information and does not replace a consultation, diagnosis or treatment.
            Results vary between individuals and no outcome is guaranteed. Available to adults aged 18 and over. In an emergency,
            go to your nearest hospital or call 112.
          </p>
          {/* who runs the service and where to reach it; each line shows once company.ts has it */}
          <address className={s.copy}>
            <span>© 2026 {COMPANY.legalName}.</span>
            {COMPANY.registeredOffice && <span>Registered office: {COMPANY.registeredOffice}.</span>}
            <span>
              Email: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
            </span>
            {COMPANY.drugLicence && (
              <span>
                Pharmacy: {COMPANY.drugLicence.holder}, drug licence {COMPANY.drugLicence.numbers}.
              </span>
            )}
          </address>
        </div>
      </div>
    </footer>
  );
}
