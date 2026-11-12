"use client";

import { useState } from "react";
import { BandTrack, MeasureField, NextStep, Seg } from "./kit";
import { fmtLength, useUnits } from "./units";
import b from "./BmiCalculator.module.css";
import k from "./Kit.module.css";
import m from "./More.module.css";

/*
  Waist against two yardsticks:
  - the Indian thresholds, 80 cm for women and 90 cm for men (Misra et al., 2025)
  - waist-to-height ratio: under 0.5 is healthy, 0.5 to 0.59 is raised risk, 0.6 or more is high
    (NICE NG246, 2025; the 2025 Indian definition also uses 0.5). Put simply: keep your waist under half your height.
*/

type Sex = "woman" | "man";

export default function WaistCalculator() {
  const [sex, setSex] = useState<Sex>("woman");
  // 34 inches and 5 ft 3 in: whole numbers in the default units
  const [waist, setWaist] = useState(86.36);
  const [height, setHeight] = useState(160.02);
  const units = useUnits();
  const wu = units.waist;

  const whtr = waist / height;
  const limit = sex === "man" ? 90 : 80;
  const high = waist >= limit;
  const band =
    whtr < 0.5
      ? { tone: 1 as const, label: "Under half your height" }
      : whtr < 0.6
        ? { tone: 2 as const, label: "Raised risk" }
        : { tone: 3 as const, label: "High risk" };
  const who = sex === "man" ? "men" : "women";
  const t = fmtLength(limit, wu);

  const text =
    whtr < 0.5 && !high
      ? `Your waist is under half your height and within the Indian threshold of ${t} for ${who}. Both point to less fat stored around the organs.`
      : whtr < 0.5
        ? `Your waist is under half your height, but above the Indian threshold of ${t} for ${who}. Doctors in India look at both, and either being high is worth a conversation.`
        : !high
          ? `Your waist is more than half your height, although it is within the Indian threshold of ${t} for ${who}. The ratio allows for height, which matters most for shorter adults.`
          : `Your waist is above the Indian threshold of ${t} for ${who}, and more than half your height. Fat stored deep around the organs raises the risk of type 2 diabetes and heart disease.`;

  return (
    <div className={b.instrument} suppressHydrationWarning data-reveal="rise">
      <div className={`${b.controls} ${m.stack}`}>
        <Seg<Sex>
          label="Sex, for the waist threshold"
          value={sex}
          onChange={setSex}
          options={[
            { v: "woman", label: "Woman" },
            { v: "man", label: "Man" },
          ]}
        />
        <MeasureField kind="waist" label="Waist" value={waist} min={60} max={140} onChange={setWaist} />
        <MeasureField kind="height" label="Height" value={height} min={140} max={200} onChange={setHeight} />
      </div>

      <div className={b.readout}>
        <div className={k.readingRow}>
          <div>
            <p className={b.k}>Waist to height</p>
            <p className={k.reading}>{whtr.toFixed(2)}</p>
          </div>
          <div className={k.side}>
            <span>Half your height</span>
            <strong className="num">{fmtLength(height / 2, wu)}</strong>
          </div>
        </div>
        <p className={k.status} data-tone={band.tone} aria-live="polite">
          <i aria-hidden="true" />
          {band.label}
        </p>
        <BandTrack
          min={0.35}
          max={0.75}
          value={whtr}
          bands={[
            { to: 0.5, tone: 1 },
            { to: 0.6, tone: 2 },
            { to: 1, tone: 3 },
          ]}
          cuts={[0.5, 0.6]}
          format={(c) => c.toFixed(1)}
        />
        <p className={k.explain}>{text}</p>
        <NextStep
          fine={
            <>
              Waist thresholds from the revised definition of obesity in Asian Indians (Misra et al., 2025); waist-to-height
              bands from NICE, 2025. A waist measure is a guide, and only a doctor can assess what it means for you. For
              adults aged 18 and over.
            </>
          }
        />
      </div>
    </div>
  );
}
