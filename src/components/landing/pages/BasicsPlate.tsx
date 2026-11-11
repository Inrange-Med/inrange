import type { CSSProperties } from "react";
import type { ProgrammeKey } from "../programme-data";
import s from "./BasicsPlate.module.css";

/*
  One drawn instrument per programme, in the homepage's measuring language: rulers, ticks, rings and
  strands, on a paper plate. Each draws a fact the section states in words, with its source; nothing
  here is a result or a promise.
    weight    the Indian and global BMI lines on one scale (Misra 2025; WHO)
    diabetes  the HbA1c scale with its two thresholds (ICMR 2018; ADA 2026)
    pcos      the Rotterdam rule: any two of three features (Teede 2023)
    sexual    the health checks that come before any plan
*/

const pct = (v: number, lo: number, hi: number) => `${((v - lo) / (hi - lo)) * 100}%`;

function Scale({ lo, hi, step, major }: { lo: number; hi: number; step: number; major: number }) {
  const n = Math.round((hi - lo) / step);
  return (
    <span className={s.ticks} aria-hidden="true">
      {Array.from({ length: n + 1 }, (_, i) => {
        const v = lo + i * step;
        const big = Math.abs(v / major - Math.round(v / major)) < 1e-6;
        return <i key={i} data-big={big || undefined} style={{ left: pct(v, lo, hi) }} />;
      })}
    </span>
  );
}

function Bmi() {
  const lo = 15;
  const hi = 35;
  return (
    <figure className={s.plate} suppressHydrationWarning data-reveal="plate">
      <figcaption className={s.k}>BMI, on two scales</figcaption>
      <div className={s.rows}>
        <div className={s.row}>
          <span className={s.rowK}>Asian Indian, 2025</span>
          <div className={s.track}>
            <Scale lo={lo} hi={hi} step={1} major={5} />
            <span className={s.band} style={{ left: pct(18.5, lo, hi), width: `calc(${pct(23, lo, hi)} - ${pct(18.5, lo, hi)})` } as CSSProperties} />
            <span className={s.mark} data-strong style={{ left: pct(23, lo, hi) }}>
              <b>23</b>
              <small>obesity</small>
            </span>
          </div>
        </div>
        <div className={s.row}>
          <span className={s.rowK}>Global, WHO</span>
          <div className={s.track}>
            <Scale lo={lo} hi={hi} step={1} major={5} />
            <span className={s.band} data-soft style={{ left: pct(18.5, lo, hi), width: `calc(${pct(25, lo, hi)} - ${pct(18.5, lo, hi)})` } as CSSProperties} />
            <span className={s.mark} style={{ left: pct(25, lo, hi) }}>
              <b>25</b>
              <small>overweight</small>
            </span>
            <span className={s.mark} style={{ left: pct(30, lo, hi) }}>
              <b>30</b>
              <small>obesity</small>
            </span>
          </div>
        </div>
      </div>
      {/* the dimension line: how much lower the Indian line sits */}
      <div className={s.dim} style={{ "--a": pct(23, lo, hi), "--b": pct(30, lo, hi) } as CSSProperties} aria-hidden="true">
        <span>7 points lower</span>
      </div>
      <p className={s.src}>Misra A, et al., 2025. World Health Organization.</p>
    </figure>
  );
}

/** One test on its own scale: three tonal zones split at the prediabetes and diabetes lines. */
function ZoneRow({ name, lo, hi, step, major, t1, t2, unit }: { name: string; lo: number; hi: number; step: number; major: number; t1: number; t2: number; unit: string }) {
  return (
    <div className={s.row}>
      <span className={s.rowK}>
        {name} <small className={s.unitK}>{unit}</small>
      </span>
      <div className={s.track} data-zones>
        <Scale lo={lo} hi={hi} step={step} major={major} />
        <span className={s.zone} data-z="0" style={{ left: 0, width: pct(t1, lo, hi) }} />
        <span className={s.zone} data-z="1" style={{ left: pct(t1, lo, hi), width: `calc(${pct(t2, lo, hi)} - ${pct(t1, lo, hi)})` } as CSSProperties} />
        <span className={s.zone} data-z="2" style={{ left: pct(t2, lo, hi), right: 0 }} />
        <span className={s.mark} data-strong style={{ left: pct(t1, lo, hi) }}>
          <b>{t1}</b>
        </span>
        <span className={s.mark} data-strong style={{ left: pct(t2, lo, hi) }}>
          <b>{t2}</b>
        </span>
      </div>
    </div>
  );
}

function Hba1c() {
  return (
    <figure className={s.plate} suppressHydrationWarning data-reveal="plate">
      <figcaption className={s.k}>Three tests, the same two lines</figcaption>
      <div className={s.rows}>
        <ZoneRow name="Fasting sugar" unit="mg/dl" lo={70} hi={150} step={5} major={10} t1={100} t2={126} />
        <ZoneRow name="2 hours after glucose" unit="mg/dl" lo={100} hi={260} step={10} major={20} t1={140} t2={200} />
        <ZoneRow name="HbA1c" unit="%" lo={4} hi={9} step={0.1} major={1} t1={5.7} t2={6.5} />
      </div>
      <p className={s.zoneLegend} aria-hidden="true">
        <span data-z="0">Normal</span>
        <span data-z="1">Prediabetes</span>
        <span data-z="2">Diabetes</span>
      </p>
      <p className={s.src}>ICMR 2018. American Diabetes Association, 2026.</p>
    </figure>
  );
}

function TwoOfThree() {
  return (
    <figure className={s.plate} suppressHydrationWarning data-reveal="plate">
      <figcaption className={s.k}>Diagnosed when any two are present</figcaption>
      <div className={s.venn}>
        {/* three features as three rings; the labels sit outside them, on short leaders */}
        <svg viewBox="0 0 400 290" aria-hidden="true">
          <circle cx="166" cy="112" r="68" />
          <circle cx="234" cy="112" r="68" />
          <circle cx="200" cy="170" r="68" />
          <path className={s.leader} d="M114 74L70 52" />
          <path className={s.leader} d="M286 74L330 52" />
          <path className={s.leader} d="M200 238V250" />
        </svg>
        <span className={s.vl} data-side="left" style={{ left: "0%", top: "18%" }}>
          Irregular or absent ovulation
        </span>
        <span className={s.vl} data-side="right" style={{ right: "0%", top: "18%" }}>
          Raised male hormones
        </span>
        <span className={s.vl} data-side="bottom" style={{ left: "50%", top: "94%" }}>
          Polycystic ovaries, by scan or AMH
        </span>
      </div>
      <p className={s.src}>Teede HJ, et al., international PCOS guideline, 2023.</p>
    </figure>
  );
}

const CHECKS = ["Blood sugar", "Blood pressure", "Cholesterol", "Hormones", "Medicines, mood and sleep"];

function Converge() {
  const ys = CHECKS.map((_, i) => 22 + i * 44);
  return (
    <figure className={s.plate} suppressHydrationWarning data-reveal="plate">
      <figcaption className={s.k}>Checked before any plan</figcaption>
      <div className={s.conv}>
        <svg viewBox="0 0 400 220" preserveAspectRatio="none" aria-hidden="true">
          {ys.map((y) => (
            <path key={y} d={`M150 ${y}C232 ${y} 250 110 318 110H392`} />
          ))}
          <circle cx="392" cy="110" r="4.5" />
        </svg>
        <ul>
          {CHECKS.map((c, i) => (
            <li key={c} style={{ top: `${(ys[i] / 220) * 100}%` }}>
              {c}
            </li>
          ))}
        </ul>
        <span className={s.out}>Your plan</span>
      </div>
      <p className={s.src}>Your doctor decides which tests you need.</p>
    </figure>
  );
}

export default function BasicsPlate({ kind }: { kind: ProgrammeKey }) {
  if (kind === "weight") return <Bmi />;
  if (kind === "diabetes") return <Hba1c />;
  if (kind === "pcos") return <TwoOfThree />;
  return <Converge />;
}
