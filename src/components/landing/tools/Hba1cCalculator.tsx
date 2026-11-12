"use client";

import { useMemo, useState } from "react";
import { ArrowRight, LockSimple, Stethoscope } from "@phosphor-icons/react";
import { ASSESSMENT_URL } from "../ui";
import { BandTrack, ReadingRuler, Seg } from "./kit";
import b from "./BmiCalculator.module.css";
import k from "./Kit.module.css";

/*
  HbA1c and estimated average glucose (eAG).
  eAG (mg/dL) = 28.7 x HbA1c - 46.7   (ADAG study, Nathan et al., Diabetes Care 2008)
  Bands (ADA Standards of Care 2025, S2; ICMR 2018): <5.7 normal, 5.7-6.4 prediabetes, >=6.5 diabetes range.
  With diabetes, a common goal is below 7%, set individually by the doctor (ADA S6).
*/

type Dx = "no" | "yes";
const eag = (a1c: number) => Math.round(28.7 * a1c - 46.7);
const MIN = 4;
const MAX = 14;
// the band track stops at 10 so the 5.7 and 6.5 cut-offs have room; higher readings pin to its end
const TRACK_MAX = 10;

export default function Hba1cCalculator() {
  const [a1c, setA1c] = useState(6.2);
  const [dx, setDx] = useState<Dx>("no");

  const r = useMemo(() => {
    const avg = eag(a1c);
    const bands =
      dx === "no"
        ? [
            { to: 5.7, tone: 1 as const, label: "Normal" },
            { to: 6.5, tone: 2 as const, label: "Prediabetes range" },
            { to: Infinity, tone: 3 as const, label: "Diabetes range" },
          ]
        : [
            { to: 7, tone: 1 as const, label: "At the common goal" },
            { to: 8, tone: 2 as const, label: "Above the common goal" },
            { to: Infinity, tone: 3 as const, label: "Well above the common goal" },
          ];
    const band = bands.find((x) => a1c < x.to) ?? bands[bands.length - 1];
    let text: string;
    if (dx === "no") {
      text =
        band.label === "Normal"
          ? "Within the normal range. HbA1c reflects your average blood sugar over roughly the last three months."
          : band.label === "Prediabetes range"
            ? "In the prediabetes range. This is the stage where changes in food, movement, sleep and weight have the most room to help. Your doctor may repeat the test to confirm."
            : "In the diabetes range. A doctor confirms diabetes with a repeat test or a second kind of test, so book one soon.";
    } else {
      text =
        band.label === "At the common goal"
          ? "At or below 7%, the goal many doctors use. Your doctor may set a different goal for you."
          : band.label === "Above the common goal"
            ? "Above the common goal of 7%. Each step down in HbA1c matters, and your doctor can adjust your plan."
            : "Well above the common goal. Talk to your doctor soon about adjusting your plan.";
    }
    return { avg, mmol: (avg / 18).toFixed(1), bands, band, text };
  }, [a1c, dx]);

  return (
    <div className={b.instrument} suppressHydrationWarning data-reveal="rise">
      <div className={b.controls}>
        <Seg<Dx>
          label="Have you been told you have diabetes?"
          value={dx}
          onChange={setDx}
          options={[
            { v: "no", label: "No, or not sure" },
            { v: "yes", label: "Yes" },
          ]}
        />
        <ReadingRuler label="Your HbA1c" unit="%" value={a1c} min={MIN} max={MAX} step={0.1} onChange={(v) => setA1c(Math.round(v * 10) / 10)} />
      </div>

      <div className={b.readout}>
        <div className={k.readingRow}>
          <div>
            <p className={b.k}>Average blood sugar</p>
            <p className={k.reading}>
              {r.avg}
              <span className={k.readingUnit}>mg/dL</span>
            </p>
          </div>
          <div className={k.side}>
            <span>Same as</span>
            <strong className="num">{r.mmol} mmol/L</strong>
          </div>
        </div>
        <p className={k.status} data-tone={r.band.tone} aria-live="polite">
          <i aria-hidden="true" />
          {r.band.label}
        </p>
        <BandTrack min={MIN} max={TRACK_MAX} value={a1c} bands={r.bands} cuts={dx === "no" ? [5.7, 6.5] : [7, 8]} />
        <p className={k.explain}>{r.text}</p>
        <div className={b.next}>
          <a href={ASSESSMENT_URL} className={`btn ${b.go}`}>
            <span>Book consultation</span>
            <span className="well" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </a>
          <ul className={b.assure}>
            <li>
              <span className={b.badge} aria-hidden="true">
                <LockSimple size={15} />
              </span>
              Private to this device
            </li>
            <li>
              <span className={b.badge} aria-hidden="true">
                <Stethoscope size={15} />
              </span>
              Only a doctor can diagnose
            </li>
          </ul>
          <p className={`fineprint ${b.disclaim}`}>
            Estimated average glucose uses the ADAG formula (28.7 &times; HbA1c &minus; 46.7). Ranges from the American
            Diabetes Association Standards of Care, 2025, and ICMR guidelines. Anaemia, pregnancy and some blood conditions
            can make HbA1c less reliable.
          </p>
        </div>
      </div>
    </div>
  );
}
