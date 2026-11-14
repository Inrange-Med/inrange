"use client";

/*
  The free check (/assessment), where every "Book consultation" lands (client call, 12 Nov 2026,
  from how the industry's booking forms work): the person's basics first, then what their BMI means,
  then their health, then name and number, then what happens next. In order:
    1  About you      which describes you, and age (one screen)
    2  Measurements   height and weight (one screen)
    3  Your BMI       the number on the Indian scale, what it means, the risk, how much to lose
    4  Health         conditions
    5  Health         what they have tried
    6  Your details   name, email, mobile and consent, then the code, here (no separate sheet)
    7  Next steps     signed in: what happens next, notes on what they told us, what doctors say,
                      then the first step in onboarding, which has nothing left to ask
  Screens were merged and the sign-in brought in to cut taps before payment (feedback, 14 Nov 2026)
  without dropping a question. Everything up to the code is worked out on the device and kept in this
  tab only (lib/onboarding/freeCheck); onboarding saves it after sign-in (freeCheckPrefill.ts).
  Browser Back moves between screens. Signed-in visitors go straight to their account. A BMI below
  18.5 without diabetes or prediabetes is not asked for details: weight care is not for them.
  Rules: process and sourced facts only, never a prediction for this person (check-content.ts).
*/

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LockSimple, Minus, Plus, X } from "@phosphor-icons/react";
import {
  AGE_MAX,
  AGE_MIN,
  CONDITIONS,
  conditionsFor,
  CONSENT_VERSION,
  EXPERIENCES,
  experienceToggled,
  GENDERS,
  HEIGHT_CM,
  WEIGHT_KG,
} from "@/lib/onboarding/answerLists";
import { bmiFrom, readFreeCheck, saveFreeCheck, type FreeCheckAnswers } from "@/lib/onboarding/freeCheck";
import { getSessionUser, homePathFor } from "@/lib/session/authSession";
import type { Gender } from "@/types/onboarding";
import ContourField from "../ContourField";
import { Wordmark } from "../ui";
import { MeasureField } from "../tools/kit";
import { healthyRange } from "../tools/data";
import { kgTo, useUnits } from "../tools/units";
import { CONDITION_NOTES, DOCTORS_SAY, EXPERIENCE_NOTES, SOURCES } from "./check-content";
import CheckSignIn, { consentsOf, type Identity } from "./CheckSignIn";
import s from "./FreeCheck.module.css";

type Key = "about" | "measures" | "bmi" | "conditions" | "tried" | "details" | "plan";
const STEPS: { key: Key; chapter: string; q: string; why: string }[] = [
  { key: "about", chapter: "About you", q: "A little about you", why: "inrange is for adults 18 and over. Waist limits differ for men and women." },
  { key: "measures", chapter: "Measurements", q: "Your height and weight", why: "In feet or centimetres, kilograms or pounds. A recent reading is fine." },
  { key: "bmi", chapter: "Your BMI", q: "Your BMI", why: "" },
  { key: "conditions", chapter: "Health", q: "Do you have any of these?", why: "Choose all that apply. It tells your doctor where to look first." },
  { key: "tried", chapter: "Health", q: "Have you tried to lose weight before?", why: "Choose all that apply." },
  { key: "details", chapter: "Your details", q: "Where should your care team reach you?", why: "Your doctor uses your name on the call. Reports go to your email." },
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
const NO_IDENTITY: Identity = { firstName: "", lastName: "", email: "", mobile: "", consented: false, ai: false };

/** BMI bands: the revised Indian definition (Misra et al., 2025) and, for comparison, the global chart. */
const bandOf = (bmi: number) => (bmi < 18.5 ? "under" : bmi <= 23 ? "healthy" : "obesity");
const globalWord = (bmi: number) => (bmi < 25 ? "healthy" : bmi < 30 ? "overweight" : "obesity");
// the scale runs from BMI 15 to 40
const SCALE = { min: 15, max: 40 };
const onScale = (v: number) => `${((Math.min(SCALE.max, Math.max(SCALE.min, v)) - SCALE.min) / (SCALE.max - SCALE.min)) * 100}%`;

/** The answers as onboarding will save them, or null while something is missing. */
function answersOf(d: Draft, identity?: Identity): FreeCheckAnswers | null {
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
    ...(identity && {
      identity: {
        firstName: identity.firstName.trim(),
        lastName: identity.lastName.trim(),
        email: identity.email.trim(),
        consents: consentsOf(identity),
        consentVersion: CONSENT_VERSION,
      },
    }),
  };
}

/** What stops this screen's Continue, said plainly, or null when it can go on. */
function problemOf(key: Key, d: Draft): string | null {
  switch (key) {
    case "about": {
      if (!d.gender) return "Choose which describes you.";
      const age = Number(d.age);
      if (!d.age || !Number.isInteger(age)) return "Enter your age in years.";
      if (age < AGE_MIN) return "inrange is for adults aged 18 and over.";
      if (age > AGE_MAX) return `Enter an age from ${AGE_MIN} to ${AGE_MAX}.`;
      return null;
    }
    case "measures":
      if (!d.heightSet && !d.weightSet) return "Move each ruler or type your height and weight.";
      if (!d.heightSet) return "Move the height ruler or type your height.";
      return d.weightSet ? null : "Move the weight ruler or type your weight.";
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

function Fine() {
  return (
    <p className={`fineprint ${s.fine}`}>
      This check gives general information and does not replace a consultation or diagnosis. Results vary between
      individuals. For adults aged 18 and over, and not for emergencies: call 112. Care is provided by registered medical
      practitioners, and video consultations follow the Telemedicine Practice Guidelines, 2020.
    </p>
  );
}

export default function FreeCheck() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [d, setD] = useState<Draft>(START);
  const [identity, setIdentity] = useState<Identity>(NO_IDENTITY);
  const [problem, setProblem] = useState<string | null>(null);
  const [kept, setKept] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // how many screens this page has pushed onto the browser's history, so Back never leaves the page
  // by mistake (a check resumed on a later screen has none behind it)
  const depth = useRef(0);
  const wu = useUnits().weight;
  const cur = STEPS[step];

  const update = (patch: Partial<Draft>) => {
    setD((prev) => ({ ...prev, ...patch }));
    setProblem(null);
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one read of the session and this tab's answers on arrival */
    // someone already signed in goes to their account: a patient to onboarding (which goes on to the
    // dashboard once the profile is done), anyone else to their own home
    const user = getSessionUser();
    if (user) {
      setLeaving(true);
      router.replace(user.role === "PATIENT" ? "/onboarding" : homePathFor(user.role));
      return;
    }
    // a finished check in this tab opens at the details (back from the doctors page, or a reload)
    const saved = readFreeCheck();
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
      if (saved.identity)
        setIdentity({ ...NO_IDENTITY, firstName: saved.identity.firstName, lastName: saved.identity.lastName, email: saved.identity.email });
      setStep(at("details"));
    }
    history.replaceState({ ...history.state, checkStep: saved ? at("details") : 0 }, "");
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [router]);

  // the browser's Back and Forward move between screens
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const to = (event.state as { checkStep?: number } | null)?.checkStep;
      if (typeof to !== "number") return;
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

  const go = useCallback((to: number, replace = false) => {
    setDir(1);
    setProblem(null);
    setStep(to);
    if (replace) history.replaceState({ ...history.state, checkStep: to }, "");
    else {
      depth.current += 1;
      history.pushState({ ...history.state, checkStep: to }, "");
    }
  }, []);

  const back = () => {
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

  const bmi = bmiFrom(d.heightCm, d.weightKg);
  const band = bandOf(bmi);
  const range = useMemo(() => healthyRange(d.heightCm, wu), [d.heightCm, wu]);
  const today = Math.round(kgTo(d.weightKg, wu));
  const milestone = Math.round(today * 0.05);
  const toHealthy = Math.max(0, today - range.hi);
  const diabetes = d.conditions.includes("T2D") || d.conditions.includes("PREDIABETES");
  // weight care is not for a BMI below the healthy range; diabetes care still can be
  const canBook = band !== "under" || diabetes;

  const next = () => {
    const why = problemOf(cur.key, d);
    if (why) {
      setProblem(why);
      return;
    }
    if (cur.key === "tried") {
      const answers = answersOf(d);
      if (answers) setKept(saveFreeCheck(answers));
      // nobody is asked for their details when the programme is not for them
      go(canBook ? at("details") : at("plan"));
      return;
    }
    go(step + 1);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    next();
  };

  if (!ready || leaving) return <main className={s.page} aria-busy="true" />;

  const options = (
    items: { code: string; label: string }[],
    on: (code: string) => boolean,
    toggle: (code: string) => void,
  ) => (
    <div className={s.options} role="group" aria-labelledby="check-q">
      {items.map((item) => (
        <button
          key={item.code}
          type="button"
          role="checkbox"
          aria-checked={on(item.code)}
          className={s.option}
          data-multi
          onClick={() => toggle(item.code)}
        >
          <i className={s.mark} aria-hidden="true" />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );

  const screen: Record<Exclude<Key, "details" | "plan">, ReactNode> = {
    about: (
      <div className={s.stack}>
        <div className={s.group}>
          <p className={s.groupK} id="check-gender">
            Which describes you?
          </p>
          <div className={s.seg} role="radiogroup" aria-labelledby="check-gender">
            {GENDERS.map((g) => (
              <button
                key={g.code}
                type="button"
                role="radio"
                aria-checked={d.gender === g.code}
                className={s.segBtn}
                onClick={() =>
                  // PCOS is not asked of men: a tick left over from going back is dropped
                  update({ gender: g.code, conditions: g.code === "Male" ? d.conditions.filter((c) => c !== "PCOS") : d.conditions })
                }
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className={s.group}>
          <label className={s.groupK} htmlFor="check-age">
            Age
          </label>
          <div className={s.age}>
            <button
              type="button"
              className={s.stepBtn}
              aria-label="One year younger"
              onClick={() => update({ age: String(Math.max(AGE_MIN, (Number(d.age) || 36) - 1)) })}
            >
              <Minus size={18} />
            </button>
            <span className={s.ageBox}>
              <input
                id="check-age"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={2}
                value={d.age}
                placeholder="35"
                aria-invalid={(!!problem && !!d.gender) || undefined}
                aria-describedby={problem ? "check-problem" : undefined}
                onChange={(e) => update({ age: e.target.value.replace(/\D/g, "").slice(0, 2) })}
              />
              <span aria-hidden="true">years</span>
            </span>
            <button
              type="button"
              className={s.stepBtn}
              aria-label="One year older"
              onClick={() => update({ age: String(Math.min(AGE_MAX, (Number(d.age) || 34) + 1)) })}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>
    ),
    measures: (
      <div className={`${s.stack} ${s.measure}`}>
        <MeasureField
          kind="height"
          label="Height"
          value={d.heightCm}
          min={HEIGHT_CM.min}
          max={HEIGHT_CM.max}
          onChange={(v) => update({ heightCm: v, heightSet: true })}
        />
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
        {options(
          conditionsFor(CONDITIONS, d.gender),
          (code) => !d.noConditions && d.conditions.includes(code),
          (code) =>
            update({
              noConditions: false,
              conditions:
                d.conditions.includes(code) && !d.noConditions
                  ? d.conditions.filter((x) => x !== code)
                  : [...d.conditions.filter((x) => x !== code), code],
            }),
        )}
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
    tried: options(EXPERIENCES, (code) => d.experience.includes(code), (code) => update({ experience: experienceToggled(d.experience, code) })),
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

  const toFirstStep = (
    <button type="button" className="btn btn--signal" onClick={() => router.push("/onboarding")}>
      <span>Choose your first step</span>
      <span className="well" aria-hidden="true">
        <ArrowRight size={18} />
      </span>
    </button>
  );

  const plan = canBook ? (
    <>
      <div className={s.close2} data-dark>
        <p className={s.closeK}>You are signed in</p>
        <p className={s.closeText}>Your answers are saved. Next, your first step: blood tests at home, or a recent report.</p>
        {toFirstStep}
      </div>
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

      <div className={s.again}>{toFirstStep}</div>
    </>
  ) : (
    <div className={s.close2} data-dark>
      <p className={s.closeK}>Weight care is not for you right now</p>
      <p className={s.closeText}>
        Your BMI is below the healthy range, so losing weight is not advised. Please speak to your own doctor. Our free
        tools and guides are open to everyone.
      </p>
      <a href="/tools" className="btn btn--signal">
        <span>See the free tools</span>
        <span className="well" aria-hidden="true">
          <ArrowRight size={18} />
        </span>
      </a>
      <p className={s.closeFine}>
        <button type="button" className={s.change} onClick={() => go(0)}>
          Change my answers
        </button>
      </p>
    </div>
  );

  const card =
    cur.key === "plan" ? (
      plan
    ) : cur.key === "details" ? (
      <>
        <CheckSignIn
          identity={identity}
          onChange={(patch) => setIdentity((prev) => ({ ...prev, ...patch }))}
          onVerified={({ role, nextScreen }) => {
            if (role !== "PATIENT" || nextScreen !== "ONBOARDING") {
              // an existing account: the profile is already done, so the check's answers are not used
              setLeaving(true);
              router.replace(homePathFor(role));
              return;
            }
            const answers = answersOf(d, identity);
            if (answers) setKept(saveFreeCheck(answers));
            // replace: Back from the plan goes to the health questions, never to a used code
            go(at("plan"), true);
          }}
        />
        <p className={s.private}>
          <LockSimple size={13} aria-hidden="true" />
          {kept
            ? "Your answers stay on this device until the code is checked."
            : "This browser did not keep your answers, so you may be asked them again after the code."}
        </p>
      </>
    ) : (
      <>
        {screen[cur.key]}
        {problem && (
          <p id="check-problem" className={s.problem} role="alert">
            {problem}
          </p>
        )}
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
          {step > 0 && cur.key !== "plan" ? (
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
                {cur.key === "plan" && !canBook ? "Your result" : cur.q}
              </h1>
              {cur.why && (cur.key !== "plan" || canBook) && <p className={s.why}>{cur.why}</p>}
            </>
          )}
        </div>
      </div>

      {/* the details have their own form (the code is sent from it); the other questions share this one */}
      {cur.key === "details" || cur.key === "plan" ? (
        <div className={s.body} key={`b${step}`} style={{ "--dir": dir } as CSSProperties}>
          <div className={s.card}>{card}</div>
          <Fine />
        </div>
      ) : (
        <form className={s.body} onSubmit={submit} noValidate key={`b${step}`} style={{ "--dir": dir } as CSSProperties}>
          <div className={s.card}>{card}</div>
          <Fine />
        </form>
      )}
    </main>
  );
}
