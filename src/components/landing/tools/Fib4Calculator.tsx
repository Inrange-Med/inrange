"use client";

import { useState } from "react";
import { BandTrack, NextStep, ReadingRuler, Seg } from "./kit";
import b from "./BmiCalculator.module.css";
import k from "./Kit.module.css";
import m from "./More.module.css";

/*
  FIB-4 (Sterling et al., Hepatology 2006): (age x AST) / (platelets [10^9/L] x square root of ALT).
  Advanced scarring unlikely below 1.30 (2.0 from age 65, McPherson et al., 2017), likely above 2.67,
  and in between it needs a liver scan (elastography) to tell (AASLD practice guidance, 2023).
  Indian reports often give platelets in lakh per cumm: 2.5 lakh = 250 x 10^9/L.
*/

type Pu = "lakh" | "thousand";

export default function Fib4Calculator() {
  const [age, setAge] = useState(45);
  const [ast, setAst] = useState(38);
  const [alt, setAlt] = useState(52);
  const [pu, setPu] = useState<Pu>("lakh");
  // stored as 10^9/L; 2.4 lakh per cumm
  const [plt, setPlt] = useState(240);

  const fib4 = (age * ast) / (plt * Math.sqrt(alt));
  const low = age >= 65 ? 2.0 : 1.3;
  const band =
    fib4 < low
      ? { tone: 1 as const, label: "Advanced scarring unlikely" }
      : fib4 <= 2.67
        ? { tone: 2 as const, label: "Not clear from blood tests" }
        : { tone: 3 as const, label: "Advanced scarring possible" };
  const text =
    fib4 < low
      ? "A low score makes advanced liver scarring unlikely. Fatty liver still deserves attention to weight, blood sugar and alcohol, and doctors usually repeat the score every one to three years."
      : fib4 <= 2.67
        ? "An in-between score cannot rule scarring in or out. The usual next step is a liver scan called elastography (often FibroScan), which measures stiffness."
        : "A high score suggests scarring may be present. It is a reason to see a liver specialist (a hepatologist or gastroenterologist) soon for further tests.";

  return (
    <div className={b.instrument} suppressHydrationWarning data-reveal="rise">
      <div className={`${b.controls} ${m.stack}`}>
        <ReadingRuler label="Age" unit="years" value={age} min={18} max={90} onChange={(v) => setAge(Math.round(v))} />
        <ReadingRuler label="AST (SGOT)" unit="U/L" value={ast} min={5} max={300} onChange={setAst} />
        <ReadingRuler label="ALT (SGPT)" unit="U/L" value={alt} min={5} max={300} onChange={setAlt} />
        <Seg<Pu>
          label="How does your report show platelets?"
          value={pu}
          onChange={setPu}
          options={[
            { v: "lakh", label: "Lakh/cumm", sub: "such as 2.4" },
            { v: "thousand", label: "Thousand/µL", sub: "such as 240" },
          ]}
        />
        {pu === "lakh" ? (
          <ReadingRuler label="Platelets" unit="lakh" value={plt / 100} min={0.2} max={6} step={0.01} onChange={(v) => setPlt(Math.round(v * 100))} />
        ) : (
          <ReadingRuler label="Platelets" unit="thousand" value={plt} min={20} max={600} onChange={(v) => setPlt(Math.round(v))} />
        )}
      </div>

      <div className={b.readout}>
        <div className={k.readingRow}>
          <div>
            <p className={b.k}>FIB-4 score</p>
            <p className={k.reading}>{fib4.toFixed(2)}</p>
          </div>
          <div className={k.side}>
            <span>Low below</span>
            <strong className="num">{low.toFixed(1)}</strong>
          </div>
        </div>
        <p className={k.status} data-tone={band.tone} aria-live="polite">
          <i aria-hidden="true" />
          {band.label}
        </p>
        <BandTrack
          min={0}
          max={4}
          value={fib4}
          bands={[
            { to: low, tone: 1 },
            { to: 2.67, tone: 2 },
            { to: 99, tone: 3 },
          ]}
          cuts={[low, 2.67]}
          format={(c) => (c === 2.67 ? "2.67" : c.toFixed(1))}
        />
        <p className={k.explain}>{text}</p>
        {age < 35 && <p className={m.note}>FIB-4 is less reliable under the age of 35, so a doctor may go straight to a scan.</p>}
        <NextStep
          action={false}
          fine={
            <>
              FIB-4 (Sterling et al., 2006) estimates the chance of advanced liver scarring from routine blood tests. It does not
              diagnose, and results can be misleading with recent illness, heavy alcohol use or other liver conditions. Cut-offs
              from the AASLD practice guidance, 2023, with 2.0 as the lower cut-off from age 65. Only a doctor can interpret it
              for you.
            </>
          }
        />
      </div>
    </div>
  );
}
