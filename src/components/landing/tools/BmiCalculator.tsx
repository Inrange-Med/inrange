"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, LockSimple } from "@phosphor-icons/react";
import { ASSESSMENT_URL } from "../ui";
import { MeasureField } from "./kit";
import s from "./BmiCalculator.module.css";

// the scale runs from BMI 15 to 40
const AXIS = { min: 15, max: 40 };
const pct = (v: number) => ((Math.min(AXIS.max, Math.max(AXIS.min, v)) - AXIS.min) / (AXIS.max - AXIS.min)) * 100;

// revised definition of obesity in Asian Indians (Misra et al., 2025): a BMI over 23 is obesity
const INDIAN = [
  { from: 0, to: 18.5, label: "Underweight" },
  { from: 18.5, to: 23.05, label: "Healthy" },
  { from: 23.05, to: Infinity, label: "Obesity" },
];

const band = (b: number) => INDIAN.findIndex((t) => b >= t.from && b < t.to);

/** BMI on the Indian scale: weight and height in, one number and one band out. */
export default function BmiCalculator() {
  // 5 ft 4 in: a whole number in the default units
  const [height, setHeight] = useState(162.56);
  const [weight, setWeight] = useState(71);

  const r = useMemo(() => {
    // categorise the number the visitor actually sees
    const bmi = Math.round((weight / (height / 100) ** 2) * 10) / 10;
    const at = band(bmi);
    let verdict: string;
    if (bmi < 18.5) verdict = "Your BMI is below the healthy range for Asian Indians, which runs from 18.5 to 23.";
    else if (bmi <= 23) verdict = "Your BMI is within the healthy range for Asian Indians, which runs from 18.5 to 23.";
    else {
      const glob = bmi < 25 ? "healthy" : bmi < 30 ? "overweight" : "obesity";
      verdict =
        glob === "obesity"
          ? "Both the 2025 Indian definition and the global chart call this obesity."
          : `By the 2025 Indian definition, a BMI over 23 is obesity. The global chart would call it ${glob}.`;
    }
    return { bmi, at, verdict, under: bmi < 18.5 };
  }, [height, weight]);

  return (
    <div className={s.instrument} suppressHydrationWarning data-reveal="rise" style={{ "--d": "120ms" } as React.CSSProperties}>
      <div className={s.controls}>
        <MeasureField kind="weight" label="Weight" value={weight} min={30} max={250} onChange={setWeight} />
        <MeasureField kind="height" label="Height" value={height} min={140} max={200} onChange={setHeight} />
      </div>

      <div className={s.readout}>
        <div className={s.bmiRow}>
          <div>
            <p className={s.k}>Your BMI</p>
            <p className={s.bmi}>{r.bmi.toFixed(1)}</p>
          </div>
          <div className={s.whtr}>
            <p className={s.k}>Indian definition</p>
            <p className={s.bandName} data-level={r.at}>
              {INDIAN[r.at].label}
            </p>
          </div>
        </div>

        <div className={s.chart} role="img" aria-label={`BMI ${r.bmi.toFixed(1)}: ${INDIAN[r.at].label}, on the Indian scale`}>
          <div className={s.trackWrap}>
            <div className={s.track}>
              {INDIAN.map((b, i) => (
                <div
                  key={b.label}
                  className={s.band}
                  data-level={i}
                  data-on={r.at === i}
                  style={{ left: `${pct(b.from)}%`, width: `${pct(b.to) - pct(b.from)}%` }}
                />
              ))}
            </div>
            <span className={s.marker} style={{ "--x": `${pct(r.bmi)}%` } as React.CSSProperties} aria-hidden="true" />
          </div>
          <div className={s.axis} aria-hidden="true">
            {[18.5, 23, 30, 35].map((t) => (
              <span key={t} className="num" style={{ left: `${pct(t)}%` }}>
                {t}
              </span>
            ))}
          </div>
        </div>

        <p className={s.verdict} aria-live="polite">
          {r.verdict}
        </p>

        <div className={s.next}>
          {r.under ? (
            <p className={s.under}>Weight below the healthy range deserves a conversation with your own doctor.</p>
          ) : (
            <a href={ASSESSMENT_URL} className={`btn ${s.go}`}>
              <span>Book consultation</span>
              <span className="well" aria-hidden="true">
                <ArrowRight size={18} />
              </span>
            </a>
          )}
          {!r.under && (
            <Link href={`/?w=${Math.round(weight)}&h=${Math.round(height)}#check`} className={s.toCalc}>
              See how much you could lose
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          )}
          <ul className={s.assure}>
            <li>
              <span className={s.badge} aria-hidden="true">
                <LockSimple size={15} />
              </span>
              Private to this device
            </li>
          </ul>
          <p className={`fineprint ${s.disclaim}`}>
            Results vary between individuals. For adults aged 18 and over, and not for emergencies. Care is provided by
            registered medical practitioners, and video consultations follow the Telemedicine Practice Guidelines, 2020.
          </p>
        </div>
      </div>
    </div>
  );
}
