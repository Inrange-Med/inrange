import { preload } from "react-dom";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Cta, Mask } from "./ui";
import { PROGRAMMES, programmeHref } from "./programme-data";
import { SEAL } from "./Pharmacy";
import s from "./Hero.module.css";

function Ruler() {
  // 1 tick every 8px, a longer index tick every 5th: the brand's measuring edge
  const ticks = Array.from({ length: 121 }, (_, i) => i);
  return (
    <svg className={s.ruler} viewBox="0 0 14 968" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      {ticks.map((i) => (
        <line key={i} x1={i % 5 === 0 ? 0 : 7} x2="14" y1={4 + i * 8} y2={4 + i * 8} />
      ))}
    </svg>
  );
}

/** the four programmes as one even index: name over status, equal cells, hairline rules. Rendered twice,
    one per breakpoint (display: none keeps a single copy in the accessibility tree): under the actions on
    laptops and tablets, under the photo on phones so the photo and its seal reach the first screen. */
function index(cls: string, delay: string) {
  return (
    <nav aria-label="Programmes" className={cls} suppressHydrationWarning data-reveal="rise" style={{ "--d": delay } as React.CSSProperties}>
      <ul className={s.progs}>
        {PROGRAMMES.map((p) => (
          <li key={p.key}>
            <a href={programmeHref(p)}>
              <span className={s.progName}>{p.short}</span>
              <span className={s.progState} data-live={p.live || undefined}>
                {p.live ? "Open now" : "Coming soon"}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function Hero() {
  // the glass is the largest thing on the first screen: fetch it with the page, not after the CSS
  preload("/img/glass-range-d.jpg", { as: "image", fetchPriority: "high" });
  return (
    <section id="top" className={s.hero} aria-labelledby="hero-title">
      {/* her call seen through fluted glass, under everything (decorative: the words carry the meaning) */}
      <div className={s.glass} aria-hidden="true" />
      <div className={s.panel}>
        <div className={s.copy}>
          <Mask
            as="h1"
            id="hero-title"
            className={`display ${s.title}`}
            lines={["Doctor-led care", "for weight and", "blood sugar."]}
            delay={150}
            join={false}
          />
          <p className={s.lede} suppressHydrationWarning data-reveal="rise" style={{ "--d": "520ms" } as React.CSSProperties}>
            A medical programme for obesity and type&nbsp;2 diabetes, with its own licensed pharmacy.
          </p>
          <div className={s.actions} suppressHydrationWarning data-reveal="rise" style={{ "--d": "640ms" } as React.CSSProperties}>
            <Cta variant="light" />
            <a href="#check" className="btn btn--ghost-dark">
              See what you could lose
            </a>
          </div>
          {index(s.indexTop, "760ms")}
        </div>
        <Ruler />
      </div>
      <figure className={s.media} suppressHydrationWarning data-reveal="wipe" style={{ "--d": "200ms" } as React.CSSProperties}>
        {/* the authenticity promise, as the label on the pack: every medicine traceable to its source */}
        <a href="#pharmacy" className={s.seal} suppressHydrationWarning data-reveal="rise" style={{ "--d": "1400ms" } as React.CSSProperties}>
          <span className={s.sealWell} aria-hidden="true">
            {/* the pack's own seal code, small: the same sticker the pharmacy section shows being scanned */}
            <svg viewBox="-1.5 -1.5 24 24" shapeRendering="crispEdges">
              <path d={SEAL} />
            </svg>
          </span>
          <span className={s.sealText}>
            <span className={s.sealK}>Every pack sealed and traceable</span>
            <span className={s.sealV}>Scan it to check batch and source</span>
          </span>
          <ArrowRight size={15} className={s.sealGo} aria-hidden="true" />
        </a>
      </figure>
      {index(s.indexBelow, "300ms")}
    </section>
  );
}
