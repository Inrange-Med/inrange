import Image from "next/image";
import ContourField from "./ContourField";
import { Mask } from "./ui";
import s from "./Hero.module.css";
import { openLogin } from "./Nav";
function Ruler() {
  // 1 tick every 8px, a longer index tick every 5th: the brand's measuring edge
  const ticks = Array.from({ length: 121 }, (_, i) => i);
  return (
    <svg
      className={s.ruler}
      viewBox="0 0 14 968"
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
    >
      {ticks.map((i) => (
        <line
          key={i}
          x1={i % 5 === 0 ? 0 : 7}
          x2="14"
          y1={4 + i * 8}
          y2={4 + i * 8}
        />
      ))}
    </svg>
  );
}

export default function Hero() {
  return (
    <section id="top" className={s.hero} aria-labelledby="hero-title">
      <div className={s.panel}>
        <ContourField className={s.field} density={10} lineAlpha={0.15} />
        <div className={s.copy}>
          <Mask
            as="h1"
            id="hero-title"
            className={`display ${s.title}`}
            lines={["Doctor-led care", "for weight and", "blood sugar."]}
            delay={150}
          />
          <p
            className={s.lede}
            data-reveal="rise"
            style={{ "--d": "520ms" } as React.CSSProperties}
          >
            A medical programme for obesity and type 2 diabetes. Doctors, blood
            tests at home, nutrition and follow-up in one plan, run by a single
            care team.
          </p>
          <div
            className={s.actions}
            data-reveal="rise"
            style={{ "--d": "640ms" } as React.CSSProperties}
          >
            <button type="button" onClick={openLogin} className="btn btn--mint">
              Start free check
            </button>
            <a href="#check" className="btn btn--ghost-dark">
              See where you stand
            </a>
          </div>
          <p
            className={s.proof}
            data-reveal="rise"
            style={{ "--d": "760ms" } as React.CSSProperties}
          >
            Your check and your first 15-minute doctor consultation are free.
            You pay only after your doctor&rsquo;s review.
          </p>
        </div>
        <Ruler />
      </div>
      <figure
        className={s.media}
        data-reveal="wipe"
        style={{ "--d": "200ms" } as React.CSSProperties}
      >
        <Image
          src="/img/hero-call.jpg"
          alt="A woman in her forties at her dining table in Delhi, on a video consultation with her doctor"
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(max-width: 1023px) 100vw, 42vw"
          className={s.img}
        />
      </figure>
    </section>
  );
}
