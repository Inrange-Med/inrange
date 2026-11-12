"use client";

import { useMemo, useState } from "react";
import { ArrowRight, LockSimple, Stethoscope } from "@phosphor-icons/react";
import { ASSESSMENT_URL } from "../ui";
import { BandTrack, ReadingRuler, Seg } from "./kit";
import b from "./BmiCalculator.module.css";
import k from "./Kit.module.css";

/*
  Blood sugar reading checker (mg/dL).
  Without diabetes, diagnostic ranges (ADA Standards of Care 2025, S2; ICMR guidelines for type 2 diabetes 2018):
    fasting: <100 normal, 100-125 prediabetes range, >=126 diabetes range
    2 hours after a meal: <140 normal, 140-199 prediabetes range, >=200 diabetes range
    random: >=200 with classic symptoms suggests diabetes
  With diabetes, common targets (ADA S6): before meals 80-130, 1-2 hours after meals <180.
  Low: <70 (level 1), <54 (level 2). A single reading never diagnoses; the tool says so.
*/

type When = "fasting" | "after" | "random";
type Dx = "no" | "yes";
// tick: the number printed on the axis when it differs from the band stop (130 is in target, so the stop is 131)
type Band = { to: number; tone: 0 | 1 | 2 | 3; label: string; alert?: boolean; tick?: number };

const TABLE: Record<Dx, Record<When, Band[]>> = {
  no: {
    fasting: [
      { to: 70, tone: 0, label: "Low", alert: true },
      { to: 100, tone: 1, label: "Normal" },
      { to: 126, tone: 2, label: "Prediabetes range" },
      { to: Infinity, tone: 3, label: "Diabetes range" },
    ],
    after: [
      { to: 70, tone: 0, label: "Low", alert: true },
      { to: 140, tone: 1, label: "Normal" },
      { to: 200, tone: 2, label: "Prediabetes range" },
      { to: Infinity, tone: 3, label: "Diabetes range" },
    ],
    random: [
      { to: 70, tone: 0, label: "Low", alert: true },
      { to: 140, tone: 1, label: "Usual range" },
      { to: 200, tone: 2, label: "Higher than usual" },
      { to: Infinity, tone: 3, label: "High" },
    ],
  },
  yes: {
    fasting: [
      { to: 70, tone: 0, label: "Low", alert: true },
      { to: 80, tone: 2, label: "Below target" },
      { to: 131, tone: 1, label: "In target", tick: 130 },
      { to: 250, tone: 2, label: "Above target" },
      { to: Infinity, tone: 3, label: "Very high", alert: true },
    ],
    after: [
      { to: 70, tone: 0, label: "Low", alert: true },
      { to: 180, tone: 1, label: "In target" },
      { to: 250, tone: 2, label: "Above target" },
      { to: Infinity, tone: 3, label: "Very high", alert: true },
    ],
    random: [
      { to: 70, tone: 0, label: "Low", alert: true },
      { to: 180, tone: 1, label: "In target" },
      { to: 250, tone: 2, label: "Above target" },
      { to: Infinity, tone: 3, label: "Very high", alert: true },
    ],
  },
};

const MIN = 40;
const MAX = 400;

function explain(dx: Dx, when: When, v: number, band: Band) {
  if (band.label === "Low")
    return "Below 70 mg/dL is low blood sugar. Follow the steps below now, and tell your doctor about it.";
  if (dx === "no") {
    if (when === "random")
      return v >= 200
        ? "A random reading of 200 or more, with thirst, frequent urination or weight loss you can't explain, suggests diabetes. Only a lab test confirms it, so see a doctor soon."
        : v >= 140
          ? "Higher than usual for a random reading. Check again fasting, or ask for an HbA1c test, which shows your average over three months."
          : "Within the usual range for a random reading. A fasting test or HbA1c gives a clearer picture.";
    if (band.label === "Normal") return `Within the normal range ${when === "fasting" ? "for a fasting reading" : "two hours after a meal"}.`;
    if (band.label === "Prediabetes range")
      return "In the prediabetes range. This is the stage where changes in food, movement and sleep matter most. One reading is not a diagnosis: repeat it, or ask for an HbA1c test.";
    return "In the diabetes range for this kind of reading. One reading is not a diagnosis, so confirm it with a repeat test or HbA1c and see a doctor.";
  }
  if (band.label === "In target") return "Within the usual target for people with diabetes. Your doctor may set a different target for you.";
  if (band.label === "Below target") return "Slightly below the usual fasting target. Keep an eye on symptoms, and mention it at your next review.";
  if (band.label === "Above target") return "Above the usual target. One high reading happens; a pattern of them is worth a conversation with your doctor.";
  return "Very high. If you feel very thirsty, drowsy, confused or unwell, or it stays above 250, contact your doctor today.";
}

export default function SugarChecker() {
  const [when, setWhen] = useState<When>("after");
  const [dx, setDx] = useState<Dx>("no");
  const [value, setValue] = useState(180);

  const r = useMemo(() => {
    const bands = TABLE[dx][when];
    const band = bands.find((x) => value < x.to) ?? bands[bands.length - 1];
    const cuts = bands
      .slice(0, -1)
      .map((x) => x.tick ?? x.to)
      .filter((c) => c > MIN && c < MAX)
      // 70 and 80 would print on top of each other; the low status and safety note already say 70
      .filter((c, i, a) => !(c === 70 && a[i + 1] === 80));
    return { bands, band, cuts, mmol: (value / 18).toFixed(1) };
  }, [dx, when, value]);

  return (
    <div className={b.instrument} suppressHydrationWarning data-reveal="rise">
      <div className={b.controls}>
        <Seg<When>
          label="When was it measured?"
          value={when}
          onChange={setWhen}
          options={[
            { v: "fasting", label: "Fasting", sub: "खाली पेट" },
            { v: "after", label: "After food", sub: "खाने के 2 घंटे बाद" },
            { v: "random", label: "Any time", sub: "कभी भी" },
          ]}
        />
        <Seg<Dx>
          label="Have you been told you have diabetes?"
          value={dx}
          onChange={setDx}
          options={[
            { v: "no", label: "No, or not sure" },
            { v: "yes", label: "Yes" },
          ]}
        />
        <ReadingRuler label="Your reading" unit="mg/dL" value={value} min={MIN} max={MAX} onChange={setValue} />
      </div>

      <div className={b.readout}>
        <div className={k.readingRow}>
          <div>
            <p className={b.k}>Blood sugar</p>
            <p className={k.reading}>
              {value}
              <span className={k.readingUnit}>mg/dL</span>
            </p>
          </div>
          <div className={k.side}>
            <span>Same as</span>
            <strong className="num">{r.mmol} mmol/L</strong>
          </div>
        </div>
        <p className={k.status} data-tone={r.band.tone} data-alert={!!r.band.alert} aria-live="polite">
          <i aria-hidden="true" />
          {r.band.label}
        </p>
        <BandTrack min={MIN} max={MAX} value={value} bands={r.bands} cuts={r.cuts} />
        <p className={k.explain}>{explain(dx, when, value, r.band)}</p>
        {r.band.label === "Low" && (
          <div className={k.safety} role="note">
            <strong>If it is below 70 mg/dL</strong>
            <span>
              Take 15 grams of fast sugar: three teaspoons of sugar in water, or half a glass of fruit juice. Check again after
              15 minutes and repeat if it is still low. If you feel confused, very drowsy or faint, call 112.
            </span>
          </div>
        )}
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
            A single reading is not a diagnosis, and home meters can differ from lab tests. Ranges from the American Diabetes
            Association Standards of Care, 2025, and ICMR guidelines. Not for emergencies: if you feel very unwell, call 112.
          </p>
        </div>
      </div>
    </div>
  );
}
