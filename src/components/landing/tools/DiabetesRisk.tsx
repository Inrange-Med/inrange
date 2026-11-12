"use client";

import { useState } from "react";
import { BandTrack, Choice, MeasureField, NextStep, ReadingRuler, Seg } from "./kit";
import { fmtLength, useUnits } from "./units";
import b from "./BmiCalculator.module.css";
import k from "./Kit.module.css";
import m from "./More.module.css";

/*
  Indian Diabetes Risk Score (Mohan V, Deepa R, Deepa M, Somannavar S, Datta M.
  J Assoc Physicians India 2005;53:759-63). Four questions, 100 points:
    age: under 35 = 0, 35 to 49 = 20, 50 or more = 30
    waist, women: under 80 cm = 0, 80 to 89 = 10, 90 or more = 20
    waist, men: under 90 cm = 0, 90 to 99 = 10, 100 or more = 20
    activity: vigorous exercise or strenuous work = 0, moderate = 10, mild = 20, none and sedentary = 30
    family history of diabetes: neither parent = 0, one parent = 10, both parents = 20
  Under 30 low risk, 30 to 50 moderate, 60 or more high. It screens; only a blood test diagnoses.
*/

type Sex = "woman" | "man";
type Activity = "vigorous" | "moderate" | "mild" | "none";
type Family = "neither" | "one" | "both";

const ACTIVITY: Record<Activity, number> = { vigorous: 0, moderate: 10, mild: 20, none: 30 };
const FAMILY: Record<Family, number> = { neither: 0, one: 10, both: 20 };

export default function DiabetesRisk() {
  const [age, setAge] = useState(42);
  const [sex, setSex] = useState<Sex>("woman");
  // 34 inches, a whole number in the default waist unit
  const [waist, setWaist] = useState(86.36);
  const [activity, setActivity] = useState<Activity>("moderate");
  const [family, setFamily] = useState<Family>("neither");
  const units = useUnits();

  const agePts = age < 35 ? 0 : age < 50 ? 20 : 30;
  const [w1, w2] = sex === "man" ? [90, 100] : [80, 90];
  const waistPts = waist < w1 ? 0 : waist < w2 ? 10 : 20;
  const actPts = ACTIVITY[activity];
  const famPts = FAMILY[family];
  const score = agePts + waistPts + actPts + famPts;

  const band = score < 30 ? { tone: 1 as const, label: "Low risk" } : score < 60 ? { tone: 2 as const, label: "Moderate risk" } : { tone: 3 as const, label: "High risk" };
  const text =
    score >= 60
      ? "A score of 60 or more is high risk. It does not mean you have diabetes, but it is a strong reason to have a fasting blood sugar or HbA1c test soon."
      : score >= 30
        ? "A moderate score. A fasting blood sugar or HbA1c test at your next check-up is sensible, and your waist and activity are the parts of the score you can change."
        : "A low score today. Your waist and activity are the parts of the score you can change, so it is worth checking again if either changes.";

  const parts = [
    { label: `Age, ${age}`, pts: agePts, max: 30 },
    { label: `Waist, ${fmtLength(waist, units.waist)}`, pts: waistPts, max: 20 },
    { label: "Physical activity", pts: actPts, max: 30 },
    { label: "Parents with diabetes", pts: famPts, max: 20 },
  ];

  return (
    <div className={b.instrument} suppressHydrationWarning data-reveal="rise">
      <div className={`${b.controls} ${m.stack}`}>
        <ReadingRuler label="Age" unit="years" value={age} min={18} max={90} onChange={(v) => setAge(Math.round(v))} />
        <Seg<Sex>
          label="Sex, for the waist thresholds"
          value={sex}
          onChange={setSex}
          options={[
            { v: "woman", label: "Woman" },
            { v: "man", label: "Man" },
          ]}
        />
        <MeasureField kind="waist" label="Waist" value={waist} min={60} max={140} onChange={setWaist} />
        <Choice<Activity>
          label="How active are you, at work, at home and in exercise?"
          value={activity}
          onChange={setActivity}
          options={[
            { v: "vigorous", label: "Vigorous", sub: "Regular hard exercise or heavy physical work" },
            { v: "moderate", label: "Moderate", sub: "Regular brisk exercise, or an active job or home" },
            { v: "mild", label: "Mild", sub: "Light exercise, or light activity at work and home" },
            { v: "none", label: "Not active", sub: "No exercise, and sitting most of the day" },
          ]}
        />
        <Seg<Family>
          label="Do your parents have diabetes?"
          value={family}
          onChange={setFamily}
          options={[
            { v: "neither", label: "Neither" },
            { v: "one", label: "One" },
            { v: "both", label: "Both" },
          ]}
        />
      </div>

      <div className={b.readout}>
        <div className={k.readingRow}>
          <div>
            <p className={b.k}>Indian Diabetes Risk Score</p>
            <p className={`${k.reading} ${m.score}`}>
              {score}
              <span className={m.of}>out of 100</span>
            </p>
          </div>
        </div>
        <p className={k.status} data-tone={band.tone} aria-live="polite">
          <i aria-hidden="true" />
          {band.label}
        </p>
        <BandTrack
          min={0}
          max={100}
          value={score}
          bands={[
            { to: 30, tone: 1 },
            { to: 60, tone: 2 },
            { to: 101, tone: 3 },
          ]}
          cuts={[30, 60]}
        />
        <p className={k.explain}>{text}</p>

        <div className={m.parts}>
          <p className={m.partsK}>What adds to your score</p>
          {parts.map((p) => (
            <div key={p.label} className={m.part}>
              <span>{p.label}</span>
              <strong>
                {p.pts}
                <span className={m.of}> / {p.max}</span>
              </strong>
              <span className={m.partBar} aria-hidden="true">
                <i style={{ "--p": p.pts / p.max } as React.CSSProperties} />
              </span>
            </div>
          ))}
        </div>

        <NextStep
          fine={
            <>
              The Indian Diabetes Risk Score was developed by the Madras Diabetes Research Foundation (Mohan et al., 2005) to
              find adults who should have a blood test. It is for people who have not been told they have diabetes. It screens;
              only a blood test can show diabetes. For adults aged 18 and over, and not for emergencies.
            </>
          }
        />
      </div>
    </div>
  );
}
