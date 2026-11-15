"use client";

import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowRight, LockSimple, Plus, Stethoscope } from "@phosphor-icons/react";
import { ASSESSMENT_URL, Art, Mask, Tag } from "./ui";
import { MeasureField } from "./tools/kit";
import { kgTo, useUnits } from "./tools/units";
import s from "./LossCalculator.module.css";

/*
  How much weight could you lose: what a published study of doctor-led care reports, worked out for one
  weight. An estimate from an average, never a prediction, a timeline or a promise.

  The figure (client call, 12 Nov 2026: "15% is the realistic market standard"; it was about 20%, the
  two best-performing study groups of one trial): 14.9% of body weight over about 16 months, the average
  in a large trial where doctors prescribed medication alongside diet and activity support (14.9% at
  68 weeks, Wilding et al., NEJM 2021). A second large trial supports it: 15.0% at 72 weeks in its study
  group that lost the least (Jastreboff et al., NEJM 2022). Shown as "about 15%".
  - 5% is drawn on the ruler for context only: ADA Standards of Care 2026, section 8 (Diabetes Care
    2026;49(Suppl 1):S166), "a minimum weight loss of 5% or more seems necessary to achieve metabolic
    improvements".
  Height only sets the healthy range for Asian Indians (BMI 18.5 to 23, Misra et al., 2025), so a
  visitor already in it is never shown a loss. BMI itself lives in the BMI tool.
*/

/** The share of body weight the calculator reports (14.9%, written "about 15%"). */
const SHARE = 0.149;
// the ruler shows today's weight on the right and 20% lower on the left
const SPAN = 0.2;
const at = (fraction: number) => `${(1 - fraction / SPAN) * 100}%`;

// the published reference points, drawn on the ruler and listed under it
const MARKS = [
  { f: 0.05, pct: "5%", what: "The first milestone. Linked with better blood sugar, blood pressure and blood fats.", ref: 1 },
  { f: SHARE, pct: "15%", what: "The average in a large trial where doctors prescribed medication, at 68 weeks.", ref: 2 },
];

// where the last two words start, so they and the footnote never break apart
const tail = (s: string) => s.lastIndexOf(" ", s.lastIndexOf(" ") - 1) + 1;

// a footnote number opens the sources before the browser jumps to the line it points at
const openSources = () => {
  const d = document.getElementById("calc-sources") as HTMLDetailsElement | null;
  if (d) d.open = true;
};

/**
 * The homepage section, or with `bare` just the instrument, for the weight loss calculator tool page,
 * whose own header carries the heading and the answer.
 */
export default function LossCalculator({ bare = false }: { bare?: boolean }) {
  // 80 kg at 5 ft 4 in: round numbers in the default units, and the worked example without JavaScript
  const [weight, setWeight] = useState(80);
  const [height, setHeight] = useState(162.56);
  const wu = useUnits().weight;

  // arriving from the BMI tool with ?w=&h= (kilograms, centimetres) keeps the visitor's own numbers
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const w = Number(q.get("w"));
    const h = Number(q.get("h"));
    /* eslint-disable react-hooks/set-state-in-effect -- one read of the address on arrival */
    if (w >= 30 && w <= 250) setWeight(w);
    if (h >= 140 && h <= 200) setHeight(h);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const r = useMemo(() => {
    const h2 = (height / 100) ** 2;
    const bmi = weight / h2;
    // all arithmetic on the whole number the visitor sees, so the figures always add up
    const today = Math.round(kgTo(weight, wu));
    // whole units, rounded inward so the range never overstates
    const loss = (f: number) => Math.round(today * f);
    const kg = loss(SHARE);
    // healthy for this height, rounded inward so both ends sit inside it
    const okLo = Math.ceil(kgTo(18.5 * h2, wu));
    const okHi = Math.floor(kgTo(23 * h2, wu));
    const state = bmi < 18.5 ? "under" : bmi <= 23 ? "healthy" : "above";
    return { today, kg, loss, okLo, okHi, state };
  }, [weight, height, wu]);

  const above = r.state === "above";
  const summary = above
    ? `At ${r.today} ${wu}, you could lose about ${r.kg} ${wu}, or about 15% of your weight, over about 16 months.`
    : r.state === "healthy"
      ? `At ${r.today} ${wu}, your weight is within the healthy range for your height, ${r.okLo} to ${r.okHi} ${wu}.`
      : `At ${r.today} ${wu}, your weight is below the healthy range for your height, ${r.okLo} to ${r.okHi} ${wu}.`;

  // the live region speaks once the visitor pauses, not on every slider step
  const deferred = useDeferredValue(summary);
  const [spoken, setSpoken] = useState(summary);
  useEffect(() => {
    const id = window.setTimeout(() => setSpoken(deferred), 500);
    return () => window.clearTimeout(id);
  }, [deferred]);

  const instrument = (
    <div className={`${s.instrument} ${bare ? s.bare : ""}`} suppressHydrationWarning data-reveal="rise" style={{ "--d": "120ms" } as CSSProperties}>
      <div className={s.result}>
        <p className="sr-only" aria-live="polite">
          {spoken}
        </p>

        {above ? (
          <div className={s.answer}>
            <p className={s.k} aria-hidden="true">
              You could lose about
            </p>
            <p className={s.big} aria-hidden="true">
              <span key={`${r.kg}${wu}`} className={s.roll}>
                {r.kg}
              </span>
              <span className={s.unit}>{wu}</span>
            </p>
            <p className={s.when}>
              over about <span className={s.nw}>16 months</span>
            </p>
            {/* the qualifier stays beside the number at every width (ASCI: a claim's basis sits next to it):
                which groups, that medication was prescribed, and the source, with nothing else */}
            <p className={s.sub}>
              About 15% of your weight: the average in a large published trial, with{" "}
              <span className={s.nw}>
                medication.
                <sup className={s.sup}>
                  <a href="#src-2" className={s.ref} onClick={openSources} aria-label="Source 2">
                    2
                  </a>
                </sup>
              </span>
            </p>
          </div>
        ) : (
          <div className={s.answer}>
            <p className={s.k} aria-hidden="true">
              Healthy for your height
            </p>
            <p className={s.big} aria-hidden="true">
              <span key={`${r.okLo}${r.okHi}${wu}`} className={s.roll}>
                {r.okLo}
                <span className={s.to}>to</span>
                {r.okHi}
              </span>
              <span className={s.unit}>{wu}</span>
            </p>
            <p className={s.sub}>
              {r.state === "healthy"
                ? "Your weight is within the healthy range for Asian Indians, so there is no loss to work out."
                : "Your weight is below the healthy range for your height."}
            </p>
          </div>
        )}
      </div>

      <div className={s.controls}>
        <MeasureField kind="weight" label="Weight" value={weight} min={30} max={250} onChange={setWeight} plain />
        <MeasureField kind="height" label="Height" value={height} min={140} max={200} onChange={setHeight} plain />
        <ul className={s.assure}>
          <li>
            <span className={s.badge} aria-hidden="true">
              <LockSimple size={15} />
            </span>
            Private to this device
          </li>
          <li>
            <span className={s.badge} aria-hidden="true">
              <Stethoscope size={15} />
            </span>
            Only a doctor can set your target
          </li>
        </ul>
      </div>

      <div className={s.readout}>
        {above && (
          <div className={s.meter} suppressHydrationWarning data-reveal="draw" aria-hidden="true">
            {/* shares of today's weight above the ruler, the weights they mean below it */}
            <div className={s.axis}>
              {MARKS.map((m) => (
                <span key={m.f} className="num" style={{ "--x": at(m.f) } as CSSProperties}>
                  {m.pct}
                </span>
              ))}
              <span className={s.end}>Today</span>
            </div>
            <div className={s.track}>
              {/* the loss itself, drawn from today back to about 15% */}
              <span className={s.band} style={{ "--a": at(SHARE), "--b": at(0) } as CSSProperties} />
              {MARKS.map((m) => (
                <span key={m.f} className={s.mark} style={{ "--x": at(m.f) } as CSSProperties} />
              ))}
              <span className={s.now} />
            </div>
            <div className={`${s.axis} ${s.values}`}>
              {MARKS.map((m) => (
                <span key={m.f} className="num" style={{ "--x": at(m.f) } as CSSProperties}>
                  {r.today - r.loss(m.f)}
                </span>
              ))}
              <span className={`num ${s.end}`}>
                {r.today}&nbsp;{wu}
              </span>
            </div>
          </div>
        )}

        {above && (
          <dl className={s.ledger}>
            {MARKS.map((m) => (
              <div key={m.f}>
                <dt>
                  <span className="num">
                    {r.loss(m.f)}&nbsp;{wu}
                  </span>
                  <span className={s.pct}>{m.pct}</span>
                </dt>
                <dd>
                  {m.what.slice(0, tail(m.what))}
                  <span className={s.nw}>
                    {m.what.slice(tail(m.what))}
                    <sup className={s.sup}>
                    <a href={`#src-${m.ref}`} className={s.ref} onClick={openSources} aria-label={`Source ${m.ref}`}>
                      {m.ref}
                    </a>
                  </sup>
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        )}

        {/* the results-vary line lives in Sources and method, read by anyone who opens the figures (client, 16 Oct 2026) */}
        {!above && (
          <p className={s.note}>
            {r.state === "healthy" ? (
              <>Weight is one measure. Blood sugar matters too, and a doctor can check it.</>
            ) : (
              <>Weight below the healthy range deserves a conversation with your own doctor.</>
            )}
          </p>
        )}

        <div className={s.next}>
          {r.state !== "under" && (
            <a href={ASSESSMENT_URL} className={`btn ${s.go}`}>
              <span>Book consultation</span>
              <span className="well" aria-hidden="true">
                <ArrowRight size={18} />
              </span>
            </a>
          )}
          <a href="/tools/bmi-calculator" className={s.quiet}>
            Check your BMI on the Indian scale
            <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>

        <details className={s.sources} id="calc-sources">
          <summary>
            Sources and method
            <Plus size={14} aria-hidden="true" />
          </summary>
          <div className={s.sourcesBody}>
            <p>
              An estimate for adults 18 and over, from published averages: your weight times each share, rounded to
              a whole {wu === "kg" ? "kilogram" : "pound"}. Results vary, and in any one person can be lower or higher.
              Your doctor sets your target. Medication is used only if your doctor judges it clinically appropriate,
              and not everyone is prescribed it.
            </p>
            <ol>
              <li id="src-1">
                American Diabetes Association. Standards of Care in Diabetes 2026, section 8. Diabetes Care
                2026;49(Suppl 1):S166. A loss of 5% or more is the minimum linked with metabolic improvement.
              </li>
              <li id="src-2">
                Wilding JPH, et al. N Engl J Med 2021;384:989. 14.9% average loss at 68 weeks, with medication
                alongside diet and activity support. The calculator uses this figure.
              </li>
              <li id="src-3">
                Jastreboff AM, et al. N Engl J Med 2022;387:205. 15.0% average loss at 72 weeks in the study group
                that lost the least, with medication alongside diet and activity support.
              </li>
            </ol>
            {!above && (
              <p>Healthy range for your height: Misra A, et al. Diabetes Metab Syndr 2025 (BMI 18.5 to 23).</p>
            )}
          </div>
        </details>
      </div>
    </div>
  );

  if (bare) return instrument;
  return (
    <section id="check" className={`section ${s.calc}`} aria-labelledby="check-title">
      <Art kind="ticks" className={s.art} />
      <div className={`wrap ${s.grid}`}>
        <header className={s.intro}>
          <div className={s.introHead}>
            <Tag>Weight loss calculator</Tag>
            <Mask id="check-title" className="h2" lines={["How much weight", "could you lose?"]} soft={1} />
          </div>
          <div className={s.introBody}>
            <p className="lede" suppressHydrationWarning data-reveal="rise" style={{ "--d": "200ms" } as CSSProperties}>
              Move the sliders to see what published studies report for someone your weight. Every figure has its
              source.
            </p>
          </div>
        </header>
        {instrument}
      </div>
    </section>
  );
}
