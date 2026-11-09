import ContourField from "./ContourField";
import { Mask, Wordmark } from "./ui";
import s from "./Footer.module.css";
import { openLogin } from "./Nav";

const COLS = [
  {
    title: "Programme",
    links: [
      ["How it works", "#how"],
      ["What we measure", "#measures"],
      ["Pricing", "#pricing"],
      ["Questions", "#questions"],
    ],
  },
  {
    title: "Contact",
    links: [["care@inrange.in", "mailto:care@inrange.in"]],
  },
  {
    title: "Legal",
    links: [
      ["Privacy policy", "/privacy"],
      ["Terms of service", "/terms"],
      ["Grievance officer", "/grievance"],
    ],
  },
];

export default function Footer() {
  return (
    <footer id="foot" className={s.foot}>
      <ContourField
        className={s.field}
        density={10}
        lineAlpha={0.1}
        signalAlpha={0.45}
        seed={17}
      />
      <div className={`wrap ${s.cta}`}>
        <Mask
          className={`display ${s.title}`}
          lines={["Start with", "two minutes."]}
        />
        <div
          className={s.ctaSide}
          data-reveal="rise"
          style={{ "--d": "200ms" } as React.CSSProperties}
        >
          <p>
            Answer a few questions and a doctor reviews them. Your first
            consultation is free, and you pay only after your doctor&rsquo;s
            review.
          </p>
          {/* <Cta onClick={openLogin} variant="mint" /> */}
          <button type="button" onClick={openLogin} className="btn btn--mint">
            Start free check
          </button>
        </div>
      </div>

      <div className={`wrap ${s.base}`}>
        <div className={s.brand} data-reveal="rise">
          <Wordmark height={34} sting />
          <p>
            Doctor-led care for weight and blood sugar. Consultations by video,
            anywhere in India.
          </p>
        </div>
        <nav className={s.cols} aria-label="Footer">
          {COLS.map((c) => (
            <div key={c.title}>
              <p className={s.colTitle}>{c.title}</p>
              <ul>
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    <a href={href}>{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className={s.legal}>
          <p>
            InRange provides medical consultations and a care programme through
            registered medical practitioners, and runs its own licensed
            pharmacy, stocked through licensed distributors. Video consultations
            follow the Telemedicine Practice Guidelines, 2020. InRange does not
            advertise any medicine. Any prescription is issued only by a
            registered medical practitioner after clinical assessment, where
            medically appropriate, and is dispensed by a registered pharmacist,
            at InRange&rsquo;s pharmacy or at any licensed pharmacy the patient
            chooses.
          </p>
          <p>
            Content on this site is general health information and does not
            replace a consultation, diagnosis or treatment. Results vary between
            individuals and no outcome is guaranteed. Available to adults aged
            18 and over. In an emergency, go to your nearest hospital or call
            112. Photographs on this site are{" "}
            <span style={{ whiteSpace: "nowrap" }}>AI-generated</span>{" "}
            illustrations.
          </p>
          <p className={s.copy}>© 2026 InRange Health Private Limited.</p>
        </div>
      </div>
    </footer>
  );
}
