"use client";

/*
  The free check (/assessment), before any sign-in (client call, 12 Nov 2026, from how the industry's
  booking forms work): the person's basics first, then what their BMI means for them, then their
  health, then what happens next, and only then the mobile number. In order:
    1-2  About you      which describes you, age
    3-4  Measurements   height, weight
    5    Your BMI       the number on the Indian scale, what it means, the risk, how much to lose
    6-7  Health         conditions, what they have tried
    8    Next steps     the first step, notes on what they told us, what doctors say, then booking
  Everything is worked out on the device. The finished answers are kept in this tab only
  (lib/onboarding/freeCheck) and saved to the profile by onboarding after sign-in, which then asks
  only for name, email and consent. Browser Back moves between screens. Rules: process and sourced
  facts only, never a prediction for this person (check-content.ts).
*/

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, LockSimple, Minus, Plus, X } from "@phosphor-icons/react";
import {
  AGE_MAX,
  AGE_MIN,
  CONDITIONS,
  conditionsFor,
  EXPERIENCES,
  experienceToggled,
  GENDERS,
  HEIGHT_CM,
  WEIGHT_KG,
} from "@/lib/onboarding/answerLists";
import { bmiFrom, readFreeCheck, saveFreeCheck, type FreeCheckAnswers } from "@/lib/onboarding/freeCheck";
import type { Gender } from "@/types/onboarding";
import ContourField from "../ContourField";
import { openLogin } from "../LoginSheet";
import { Wordmark } from "../ui";
import { MeasureField } from "../tools/kit";
import { healthyRange } from "../tools/data";
import { kgTo, useUnits } from "../tools/units";
import { CONDITION_NOTES, DOCTORS_SAY, EXPERIENCE_NOTES, SOURCES } from "./check-content";
import s from "./FreeCheck.module.css";

type Key = "gender" | "age" | "height" | "weight" | "bmi" | "conditions" | "tried" | "plan";
const STEPS: { key: Key; chapter: string; q: string; why: string }[] = [
  { key: "gender", chapter: "About you", q: "Which describes you?", why: "Waist limits differ for men and women, so your doctor reads your numbers against the right one." },
  { key: "age", chapter: "About you", q: "How old are you?", why: "inrange is for adults 18 and over." },
  { key: "height", chapter: "Measurements", q: "How tall are you?", why: "In feet or centimetres, whichever you know." },
  { key: "weight", chapter: "Measurements", q: "What do you weigh?", why: "A recent reading is fine." },
  { key: "bmi", chapter: "Your BMI", q: "Your BMI", why: "" },
  { key: "conditions", chapter: "Health", q: "Do you have any of these?", why: "Choose all that apply. It tells your doctor where to look first." },
  { key: "tried", chapter: "Health", q: "Have you tried to lose weight before?", why: "Choose all that apply." },
  { key: "plan", chapter: "Next steps", q: "What happens next", why: "Your first step, then a plan only if it suits you." },
];
const LAST = STEPS.length - 1;
const at = (key: Key) => STEPS.findIndex((x) => x.key === key);

type Draft = {
  gender: Gender | null;
  age: string;
  heightCm: number;
  weightKg: number;
  /** a ruler's resting value is never taken as an answer: it has to be moved or typed */
  heightSet: boolean;
  weightSet: boolean;
  conditions: string[];
  noConditions: boolean;
  otherText: string;
  experience: string[];
};
// 5 ft 4 in and 70 kg: whole numbers in the default units, where the rulers rest until touched
const START: Draft = {
  gender: null,
  age: "",
  heightCm: 162.56,
  weightKg: 70,
  heightSet: false,
  weightSet: false,
  conditions: [],
  noConditions: false,
  otherText: "",
  experience: [],
};

/** BMI bands: the revised Indian definition (Misra et al., 2025) and, for comparison, the global chart. */
const bandOf = (bmi: number) => (bmi < 18.5 ? "under" : bmi <= 23 ? "healthy" : "obesity");
const globalWord = (bmi: number) => (bmi < 25 ? "healthy" : bmi < 30 ? "overweight" : "obesity");
// the scale runs from BMI 15 to 40
const SCALE = { min: 15, max: 40 };
const onScale = (v: number) => `${((Math.min(SCALE.max, Math.max(SCALE.min, v)) - SCALE.min) / (SCALE.max - SCALE.min)) * 100}%`;

/** The answers as onboarding will save them, or what is still missing. */
function answersOf(d: Draft): FreeCheckAnswers | null {
  const age = Number(d.age);
  if (!d.gender || !Number.isInteger(age) || !d.heightSet || !d.weightSet || !d.experience.length) return null;
  const codes = conditionsFor(CONDITIONS, d.gender)
    .map((c) => c.code)
    .filter((code) => d.conditions.includes(code));
  return {
    gender: d.gender,
    ageYears: age,
    heightCm: Math.round(d.heightCm * 10) / 10,
    weightKg: Math.round(d.weightKg * 10) / 10,
    weightLossExperience: d.experience,
    noConditions: d.noConditions,
    conditions: d.noConditions ? [] : codes.map((code) => (code === "OTHER" ? { code, otherText: d.otherText.trim() } : { code })),
  };
}

/** What stops this screen's Continue, said plainly, or null when it can go on. */
function problemOf(key: Key, d: Draft): string | null {
  switch (key) {
    case "gender":
      return d.gender ? null : "Choose one.";
    case "age": {
      const age = Number(d.age);
      if (!d.age || !Number.isInteger(age)) return "Enter your age in years.";
      if (age < AGE_MIN) return "inrange is for adults aged 18 and over.";
      if (age > AGE_MAX) return `Enter an age from ${AGE_MIN} to ${AGE_MAX}.`;
      return null;
    }
    case "height":
      return d.heightSet ? null : "Move the ruler or type your height.";
    case "weight":
      return d.weightSet ? null : "Move the ruler or type your weight.";
    case "conditions": {
      if (d.noConditions) return null;
      const visible = conditionsFor(CONDITIONS, d.gender).filter((c) => d.conditions.includes(c.code));
      if (!visible.length) return "Choose at least one, or None of these.";
      if (d.conditions.includes("OTHER") && !d.otherText.trim()) return "Say what it is.";
      return null;
    }
    case "tried":
      return d.experience.length ? null : "Choose at least one.";
    default:
      return null;
  }
}

function Cite({ id }: { id: string }) {
  const src = SOURCES[id];
  if (!src) return null;
  return (
    <cite className={s.cite}>
      {src.href ? (
        <a href={src.href} target="_blank" rel="noopener noreferrer">
          {src.label}
        </a>
      ) : (
        src.label
      )}
    </cite>
  );
}

export default function FreeCheck() {
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [d, setD] = useState<Draft>(START);
  const [problem, setProblem] = useState<string | null>(null);
  const [kept, setKept] = useState(true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const advance = useRef<number | undefined>(undefined);
  // how many screens this page has pushed onto the browser's history, so Back never leaves the page
  // by mistake (a check resumed on its last screen has none behind it)
  const depth = useRef(0);
  const wu = useUnits().weight;
  const cur = STEPS[step];

  const update = (patch: Partial<Draft>) => {
    setD((prev) => ({ ...prev, ...patch }));
    setProblem(null);
  };

  // a finished check in this tab opens on its last screen (back from the doctors page, or after
  // closing the sign-in sheet and reloading)
  useEffect(() => {
    const saved = readFreeCheck();
    /* eslint-disable react-hooks/set-state-in-effect -- one read of this tab's saved answers on arrival */
    if (saved) {
      const other = saved.conditions.find((c) => c.code === "OTHER")?.otherText ?? "";
      setD({
        gender: saved.gender,
        age: String(saved.ageYears),
        heightCm: saved.heightCm,
        weightKg: saved.weightKg,
        heightSet: true,
        weightSet: true,
        conditions: saved.conditions.map((c) => c.code),
        noConditions: saved.noConditions,
        otherText: other,
        experience: saved.weightLossExperience,
      });
      setStep(LAST);
    }
    history.replaceState({ ...history.state, checkStep: saved ? LAST : 0 }, "");
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // the browser's Back and Forward move between screens
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const to = (event.state as { checkStep?: number } | null)?.checkStep;
      if (typeof to !== "number") return;
      window.clearTimeout(advance.current);
      depth.current = Math.max(0, depth.current + (to < step ? -1 : 1));
      setDir(to < step ? -1 : 1);
      setProblem(null);
      setStep(Math.max(0, Math.min(LAST, to)));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [step]);

  // each screen starts at the top with its heading read out
  useEffect(() => {
    if (!ready) return;
    window.scrollTo(0, 0);
    const timer = window.setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 80);
    return () => window.clearTimeout(timer);
  }, [step, ready]);

  useEffect(() => () => window.clearTimeout(advance.current), []);

  const go = useCallback(
    (to: number) => {
      setDir(1);
      setProblem(null);
      setStep(to);
      depth.current += 1;
      history.pushState({ ...history.state, checkStep: to }, "");
    },
    [],
  );

  const back = () => {
    window.clearTimeout(advance.current);
    if (step === 0) return;
    // a screen this page pushed: Back is the browser's own, so the two never disagree
    if (depth.current > 0) history.back();
    else {
      setDir(-1);
      setProblem(null);
      setStep(step - 1);
      history.replaceState({ ...history.state, checkStep: step - 1 }, "");
    }
  };

  const next = (draft: Draft = d) => {
    const why = problemOf(cur.key, draft);
    if (why) {
      setProblem(why);
      return;
    }
    if (cur.key === "tried") {
      const answers = answersOf(draft);
      if (answers) setKept(saveFreeCheck(answers));
    }
    go(step + 1);
  };

  /** Single answers: show the tick, then move on a beat later. */
  const pickThenGo = (patch: Partial<Draft>) => {
    const draft = { ...d, ...patch };
    update(patch);
    window.clearTimeout(advance.current);
    advance.current = window.setTimeout(() => next(draft), 260);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    next();
  };

  const bmi = bmiFrom(d.heightCm, d.weightKg);
  const band = bandOf(bmi);
  const range = useMemo(() => healthyRange(d.heightCm, wu), [d.heightCm, wu]);
  const today = Math.round(kgTo(d.weightKg, wu));
  const milestone = Math.round(today * 0.05);
  const toHealthy = Math.max(0, today - range.hi);
  const diabetes = d.conditions.includes("T2D") || d.conditions.includes("PREDIABETES");
  // weight care is not for a BMI below the healthy range; diabetes care still can be
  const canBook = band !== "under" || diabetes;

  if (!ready) return <main className={s.page} aria-busy="true" />;

  const screen: Record<Key, ReactNode> = {
    gender: (
      <div className={s.options} role="radiogroup" aria-labelledby="check-q">
        {GENDERS.map((g) => (
          <button
            key={g.code}
            type="button"
            role="radio"
            aria-checked={d.gender === g.code}
            className={s.option}
            onClick={() => {
              // PCOS is not asked of men: a tick left over from going back is dropped
              const conditions = g.code === "Male" ? d.conditions.filter((c) => c !== "PCOS") : d.conditions;
              pickThenGo({ gender: g.code, conditions });
            }}
          >
            <i className={s.mark} aria-hidden="true" />
            <span>{g.label}</span>
          </button>
        ))}
      </div>
    ),
    age: (
      <div className={s.age}>
        <button
          type="button"
          className={s.stepBtn}
          aria-label="One year younger"
          onClick={() => update({ age: String(Math.max(AGE_MIN, (Number(d.age) || 31) - 1)) })}
        >
          <Minus size={18} />
        </button>
        <label className={s.ageBox}>
          <span className="sr-only">Age in years</span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            maxLength={2}
            value={d.age}
            placeholder="35"
            aria-invalid={!!problem || undefined}
            aria-describedby={problem ? "check-problem" : undefined}
            onChange={(e) => update({ age: e.target.value.replace(/\D/g, "").slice(0, 2) })}
          />
          <span aria-hidden="true">years</span>
        </label>
        <button
          type="button"
          className={s.stepBtn}
          aria-label="One year older"
          onClick={() => update({ age: String(Math.min(AGE_MAX, (Number(d.age) || 29) + 1)) })}
        >
          <Plus size={18} />
        </button>
      </div>
    ),
    height: (
      <div className={s.measure}>
        <MeasureField
          kind="height"
          label="Height"
          value={d.heightCm}
          min={HEIGHT_CM.min}
          max={HEIGHT_CM.max}
          onChange={(v) => update({ heightCm: v, heightSet: true })}
        />
      </div>
    ),
    weight: (
      <div className={s.measure}>
        <MeasureField
          kind="weight"
          label="Weight"
          value={d.weightKg}
          min={WEIGHT_KG.min}
          max={WEIGHT_KG.max}
          onChange={(v) => update({ weightKg: v, weightSet: true })}
        />
      </div>
    ),
    bmi: (
      <div className={s.result}>
        <p className={s.meaning}>
          {band === "obesity"
            ? bmi >= 30
              ? "Both the 2025 Indian definition and the global chart call this obesity."
              : `By the 2025 Indian definition, a BMI over 23 is obesity. The global chart would call it ${globalWord(bmi)}.`
            : band === "healthy"
              ? "Your BMI is within the healthy range for Asian Indians, 18.5 to 23."
              : "Your BMI is below the healthy range for Asian Indians, 18.5 to 23."}
        </p>

        {band === "obesity" && (
          <div className={s.block}>
            <h2 className={s.blockK}>Why it matters</h2>
            <p>
              At the same weight, South Asians carry more fat around the organs, so risks such as type 2 diabetes, high
              blood pressure and fatty liver start at a lower BMI. Whether it is stage 1 or stage 2 depends on your waist and
              any related conditions, which a doctor checks.
            </p>
            <Cite id="misra" />
          </div>
        )}

        {band === "obesity" ? (
          <div className={s.block}>
            <h2 className={s.blockK}>How much to lose</h2>
            <dl className={s.ledger}>
              <div>
                <dt>First milestone, 5% of your weight</dt>
                <dd className="num">
                  {milestone}&nbsp;{wu}
                </dd>
              </div>
              <div>
                <dt>Healthy for your height</dt>
                <dd className="num">
                  {range.lo} to {range.hi}&nbsp;{wu}
                </dd>
              </div>
              <div>
                <dt>Above the top of that range</dt>
                <dd className="num">
                  {toHealthy}&nbsp;{wu}
                </dd>
              </div>
            </dl>
            <p className={s.small}>
              A loss of 5% or more is the minimum linked with better blood sugar, blood pressure and blood fats. Your
              doctor sets your own target with you.
            </p>
            <Cite id="ada" />
          </div>
        ) : (
          <div className={s.block}>
            <p>
              {band === "healthy"
                ? "Weight is one measure. Your waist and blood sugar matter too, and a doctor can check them."
                : "Losing weight is not advised at this BMI. Please speak to your own doctor about it."}
            </p>
          </div>
        )}
      </div>
    ),
    conditions: (
      <div className={s.multi}>
        <div className={s.options} role="group" aria-labelledby="check-q">
          {conditionsFor(CONDITIONS, d.gender).map((c) => {
            const on = !d.noConditions && d.conditions.includes(c.code);
            return (
              <button
                key={c.code}
                type="button"
                role="checkbox"
                aria-checked={on}
                className={s.option}
                data-multi
                onClick={() =>
                  update({
                    noConditions: false,
                    conditions: on ? d.conditions.filter((x) => x !== c.code) : [...d.conditions, c.code],
                  })
                }
              >
                <i className={s.mark} aria-hidden="true" />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
        {!d.noConditions && d.conditions.includes("OTHER") && (
          <label className={s.other}>
            <span>What is it?</span>
            <input
              value={d.otherText}
              maxLength={120}
              autoComplete="off"
              onChange={(e) => update({ otherText: e.target.value })}
              aria-invalid={problem === "Say what it is." || undefined}
            />
          </label>
        )}
        <button
          type="button"
          role="checkbox"
          aria-checked={d.noConditions}
          className={`${s.option} ${s.none}`}
          data-multi
          onClick={() => update({ noConditions: !d.noConditions, conditions: d.noConditions ? d.conditions : [] })}
        >
          <i className={s.mark} aria-hidden="true" />
          <span>None of these</span>
        </button>
      </div>
    ),
    tried: (
      <div className={s.options} role="group" aria-labelledby="check-q">
        {EXPERIENCES.map((e) => (
          <button
            key={e.code}
            type="button"
            role="checkbox"
            aria-checked={d.experience.includes(e.code)}
            className={s.option}
            data-multi
            onClick={() => update({ experience: experienceToggled(d.experience, e.code) })}
          >
            <i className={s.mark} aria-hidden="true" />
            <span>{e.label}</span>
          </button>
        ))}
      </div>
    ),
    plan: null,
  };

  const notes = [
    ...(d.noConditions ? [] : conditionsFor(CONDITIONS, d.gender).filter((c) => d.conditions.includes(c.code))).map((c) => ({
      key: c.code,
      name: c.label,
      ...CONDITION_NOTES[c.code],
    })),
    ...d.experience
      .filter((code) => EXPERIENCE_NOTES[code])
      .map((code) => ({ key: code, name: EXPERIENCES.find((e) => e.code === code)!.label, text: EXPERIENCE_NOTES[code], source: undefined })),
  ];

  const plan = (
    <>
      <ol className={s.steps}>
        <li>
          <h2 className={s.stepK}>Blood tests at home</h2>
          <p>
            A partner lab collects samples at your door, or you upload a report from the last three months. The tests look
            for what may be behind your weight.
          </p>
        </li>
        <li>
          <h2 className={s.stepK}>A review by our medical team</h2>
          <p>They read your results and confirm the programme suits you.</p>
        </li>
        <li>
          <h2 className={s.stepK}>A video consultation with your doctor</h2>
          <p>
            Your doctor goes through every result with you and explains what to do about it. Then your health coach plans
            the next steps with you.
          </p>
        </li>
        <li>
          <h2 className={s.stepK}>A plan, only if it suits you</h2>
          <p>
            You see the itemised price before you pay. Medication only if your doctor judges it clinically appropriate. Not
            everyone is prescribed medication.
          </p>
        </li>
      </ol>

      {notes.length > 0 && (
        <section className={s.block} aria-labelledby="notes-k">
          <h2 id="notes-k" className={s.blockK}>
            From what you told us
          </h2>
          <ul className={s.notes}>
            {notes.map((n) => (
              <li key={n.key}>
                <strong>{n.name}.</strong> {n.text}
                {n.source && <Cite id={n.source} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={s.block} aria-labelledby="say-k">
        <h2 id="say-k" className={s.blockK}>
          What doctors say about obesity
        </h2>
        <ul className={s.says}>
          {DOCTORS_SAY.map((x) => (
            <li key={x.source}>
              {x.verbatim ? (
                <blockquote cite={SOURCES[x.source].href}>
                  <p>&ldquo;{x.text}&rdquo;</p>
                </blockquote>
              ) : (
                <p className={s.sayPlain}>{x.text}</p>
              )}
              <p className={s.by}>{x.by}</p>
              <Cite id={x.source} />
            </li>
          ))}
        </ul>
        <p className={s.doctors}>
          Your doctor is an endocrinologist or an internal medicine physician, registered in India.{" "}
          <a href="/doctors">
            Meet the doctors
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        </p>
      </section>
    </>
  );

  return (
    <main className={s.page} data-step={cur.key}>
      <div className={s.band} data-dark>
        <ContourField className={s.field} density={10} lineAlpha={0.12} signalAlpha={0.35} seed={23} interactive={false} />
        <header className={s.bar}>
          <a href="/" className={s.brand} aria-label="inrange home">
            <Wordmark height={30} />
          </a>
          <ol className={s.progress} aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((x, i) => (
              <li key={x.key} data-state={i < step ? "done" : i === step ? "now" : "next"} aria-hidden="true" />
            ))}
          </ol>
          <a href="/" className={s.close}>
            <X size={16} aria-hidden="true" />
            <span>Close</span>
          </a>
        </header>

        <div className={s.head} key={`h${step}`} style={{ "--dir": dir } as CSSProperties}>
          {step > 0 ? (
            <button type="button" className={s.back} onClick={back}>
              <ArrowLeft size={16} aria-hidden="true" />
              Back
            </button>
          ) : (
            <span className={s.back} aria-hidden="true" />
          )}
          <p className="tag tag--dark">
            <svg width="9" height="11" viewBox="0 0 9 11" shapeRendering="crispEdges" aria-hidden="true">
              <path d="M1.5 1v9M4.5 1v4.5M7.5 1v6.5" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
            {cur.chapter}
          </p>
          {cur.key === "bmi" ? (
            <>
              <h1 id="check-q" ref={headingRef} tabIndex={-1} className={s.q}>
                <span className="sr-only">Your BMI is </span>
                <span className={`${s.bmi} num`}>{bmi.toFixed(1)}</span>
                <span className={s.bmiBand} data-band={band}>
                  {band === "obesity" ? "Obesity, on the Indian scale" : band === "healthy" ? "Healthy, on the Indian scale" : "Below the healthy range"}
                </span>
              </h1>
              <div className={s.scale} aria-hidden="true">
                <div className={s.track}>
                  <span style={{ left: onScale(SCALE.min), width: `calc(${onScale(18.5)} - ${onScale(SCALE.min)})` }} data-on={band === "under"} />
                  <span style={{ left: onScale(18.5), width: `calc(${onScale(23)} - ${onScale(18.5)})` }} data-on={band === "healthy"} />
                  <span style={{ left: onScale(23), width: `calc(100% - ${onScale(23)})` }} data-on={band === "obesity"} />
                  <i className={s.pin} style={{ "--x": onScale(bmi) } as CSSProperties} />
                </div>
                <div className={s.axis}>
                  {[18.5, 23, 30, 35].map((t) => (
                    <span key={t} className="num" style={{ left: onScale(t) }}>
                      {t}
                    </span>
                  ))}
                </div>
                <p className={s.scaleKey}>Indian definition: over 23 is obesity. The global chart starts at 25 and 30.</p>
              </div>
            </>
          ) : (
            <>
              <h1 id="check-q" ref={headingRef} tabIndex={-1} className={s.q}>
                {cur.q}
              </h1>
              {cur.why && <p className={s.why}>{cur.why}</p>}
            </>
          )}
        </div>
      </div>

      <form className={s.body} onSubmit={submit} noValidate key={`b${step}`} style={{ "--dir": dir } as CSSProperties}>
        <div className={s.card}>
          {cur.key === "plan" ? plan : screen[cur.key]}

          {problem && (
            <p id="check-problem" className={s.problem} role="alert">
              {problem}
            </p>
          )}

          {cur.key !== "plan" && cur.key !== "gender" && (
            <div className={s.actions}>
              <button type="submit" className={`btn ${s.go}`} aria-disabled={!!problemOf(cur.key, d) || undefined}>
                <span>Continue</span>
                <span className="well" aria-hidden="true">
                  <ArrowRight size={18} />
                </span>
              </button>
              <p className={s.private}>
                <LockSimple size={13} aria-hidden="true" />
                Worked out on this device. Nothing is sent until you sign in.
              </p>
            </div>
          )}
        </div>

        {cur.key === "plan" && (
          <div className={s.close2} data-dark>
            {canBook ? (
              <>
                <p className={s.closeK}>Book your first step</p>
                <p className={s.closeText}>
                  Next, your mobile number and a code. Then your name and email, and your answers here are already filled in.
                </p>
                <button type="button" className="btn btn--signal" onClick={() => openLogin()}>
                  <span>Book consultation</span>
                  <span className="well" aria-hidden="true">
                    <ArrowRight size={18} />
                  </span>
                </button>
              </>
            ) : (
              <>
                <p className={s.closeK}>Weight care is not for you right now</p>
                <p className={s.closeText}>
                  Your BMI is below the healthy range, so losing weight is not advised. Please speak to your own doctor. Our
                  free tools and guides are open to everyone.
                </p>
                <a href="/tools" className="btn btn--signal">
                  <span>See the free tools</span>
                  <span className="well" aria-hidden="true">
                    <ArrowRight size={18} />
                  </span>
                </a>
              </>
            )}
            <p className={s.closeFine}>
              {kept ? (
                <span className={s.kept}>
                  <Check size={13} weight="bold" aria-hidden="true" />
                  Your answers stay in this browser tab until you sign in.
                </span>
              ) : (
                "This browser did not keep your answers, so you will be asked them again after signing in."
              )}{" "}
              <button type="button" className={s.change} onClick={() => go(0)}>
                Change my answers
              </button>
            </p>
          </div>
        )}

        <p className={`fineprint ${s.fine}`}>
          This check gives general information and does not replace a consultation or diagnosis. Results vary between
          individuals. For adults aged 18 and over, and not for emergencies: call 112. Care is provided by registered
          medical practitioners, and video consultations follow the Telemedicine Practice Guidelines, 2020.
        </p>
      </form>
    </main>
  );
}
