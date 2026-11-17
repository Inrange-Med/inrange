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
    6  Your details   name, email, mobile and consent (nothing is sent yet)
    7  Next steps     what happens next and the doctors, and the first step to choose: home blood
                      tests, or a recent report to upload
    8  Your code      the 6-digit code, sent as the screen opens; then onboarding, which saves the
                      answers and opens the chosen first step at once (the booking, or the upload)
  Screens were merged and the sign-in brought in to cut taps before payment (feedback, 14 Nov 2026)
  without dropping a question. The code comes last, right before booking (call, 16 Nov 2026: people
  drop off at the code, so it is asked once they have seen their plan and chosen). Everything up to
  the code is worked out on the device and kept in this tab only (lib/onboarding/freeCheck);
  onboarding saves it after sign-in (freeCheckPrefill.ts).
  Browser Back moves between screens. Signed-in visitors go straight to their account. A BMI below
  18.5 without diabetes or prediabetes is not asked for details: weight care is not for them.
  Rules: process and sourced facts only, never a prediction for this person (check-content.ts).
*/

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, FileArrowUp, LockSimple, Minus, Plus, X } from "@phosphor-icons/react";
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
import { bmiFrom, readFreeCheck, saveFreeCheck, type FirstStep, type FreeCheckAnswers } from "@/lib/onboarding/freeCheck";
import { isValidMobile } from "@/lib/format/phone";
import { getSessionUser, homePathFor } from "@/lib/session/authSession";
import { updateReminderSettings } from "@/services/patientProfileService";
import type { Gender } from "@/types/onboarding";
import ContourField from "../ContourField";
import { LISTED_DOCTORS } from "../doctor-data";
import { Wordmark } from "../ui";
import { MeasureField } from "../tools/kit";
import { healthyRange } from "../tools/data";
import { kgTo, useUnits } from "../tools/units";
import { SOURCES } from "./check-content";
import { CheckCode, CheckDetails, consentsOf, type Identity, type LastSend } from "./CheckSignIn";
import s from "./FreeCheck.module.css";

type Key = "about" | "measures" | "bmi" | "conditions" | "tried" | "details" | "plan" | "code";
const STEPS: { key: Key; chapter: string; q: string; why: string }[] = [
  { key: "about", chapter: "About you", q: "A little about you", why: "" },
  { key: "measures", chapter: "Measurements", q: "Your height and weight", why: "A recent reading is fine." },
  { key: "bmi", chapter: "Your BMI", q: "Your BMI", why: "" },
  { key: "conditions", chapter: "Health", q: "Do you have any of these?", why: "Choose all that apply." },
  { key: "tried", chapter: "Health", q: "Have you tried to lose weight before?", why: "Choose all that apply." },
  { key: "details", chapter: "Your details", q: "Where can we reach you?", why: "" },
  { key: "plan", chapter: "Next steps", q: "What happens next", why: "" },
  { key: "code", chapter: "Your details", q: "Confirm your number", why: "Then you book your blood test." },
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
const NO_IDENTITY: Identity = { firstName: "", lastName: "", email: "", mobile: "", consented: false, ai: false, whatsapp: false };

/** BMI bands: the revised Indian definition (Misra et al., 2025) and, for comparison, the global chart. */
const bandOf = (bmi: number) => (bmi < 18.5 ? "under" : bmi <= 23 ? "healthy" : "obesity");
/** The Indian categories as the BMI screen lists them (Misra et al., 2025). */
const BANDS: { band: ReturnType<typeof bandOf>; range: string; name: string; line: string }[] = [
  { band: "under", range: "Below 18.5", name: "Underweight", line: "Losing weight is not advised." },
  { band: "healthy", range: "18.5 to 23", name: "Healthy", line: "The healthy range for Indians." },
  {
    band: "obesity",
    range: "Over 23",
    name: "Obesity",
    line: "The risk of type 2 diabetes, high blood pressure and fatty liver rises. A doctor checks your waist and health to judge how far.",
  },
];
// the scale runs from BMI 15 to 40
const SCALE = { min: 15, max: 40 };
const onScale = (v: number) => `${((Math.min(SCALE.max, Math.max(SCALE.min, v)) - SCALE.min) / (SCALE.max - SCALE.min)) * 100}%`;

/** The answers as onboarding will save them, or null while something is missing. */
function answersOf(d: Draft, identity?: Identity, firstStep?: FirstStep): FreeCheckAnswers | null {
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
        mobile: identity.mobile,
        consents: consentsOf(identity),
        consentVersion: CONSENT_VERSION,
      },
    }),
    ...(firstStep && { firstStep }),
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
    // the short name on screen, the full reference on hover and for screen readers
    <cite className={s.cite} title={src.label}>
      Source:{" "}
      {src.href ? (
        <a href={src.href} target="_blank" rel="noopener noreferrer" aria-label={src.label}>
          {src.short}
        </a>
      ) : (
        <span aria-label={src.label}>{src.short}</span>
      )}
    </cite>
  );
}

function Fine() {
  return (
    <p className={`fineprint ${s.fine}`}>
      General information, not a diagnosis. Results vary. Adults 18 and over. Not for emergencies: call 112. Care by
      registered doctors, under the Telemedicine Practice Guidelines 2020.
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
  const [leaving, setLeaving] = useState(false);
  const [firstStep, setFirstStep] = useState<FirstStep | null>(null);
  const lastSend = useRef<LastSend | null>(null);
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
        setIdentity({
          firstName: saved.identity.firstName,
          lastName: saved.identity.lastName,
          email: saved.identity.email,
          mobile: saved.identity.mobile ?? "",
          // a tick counts only for the wording it was given to; a changed wording is asked again
          consented: saved.identity.consentVersion === CONSENT_VERSION && saved.identity.consents.length > 0,
          ai: saved.identity.consentVersion === CONSENT_VERSION && saved.identity.consents.includes("AI"),
          whatsapp: saved.identity.consentVersion === CONSENT_VERSION && saved.identity.consents.includes("WHATSAPP"),
        });
      setFirstStep(saved.firstStep ?? null);
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
    // the code screen focuses its own input (the keyboard and the code suggestion come up)
    if (STEPS[step].key === "code") return;
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
  const diabetes = d.conditions.includes("T2D") || d.conditions.includes("PREDIABETES");
  // weight care is not for a BMI below the healthy range; diabetes care still can be
  const canBook = band !== "under" || diabetes;

  // Back and Forward can reach any screen: someone the programme is not for never sees the details or
  // the code (their plan says why), and the code screen needs a number to send to (a stale Forward
  // after a reload has none), so it goes back to the details
  useEffect(() => {
    if (!ready) return;
    const key = STEPS[step].key;
    if ((key === "details" || key === "code") && !canBook) go(at("plan"), true);
    else if (key === "code" && !isValidMobile(identity.mobile)) go(at("details"), true);
  }, [ready, step, identity.mobile, go, canBook]);

  const next = () => {
    const why = problemOf(cur.key, d);
    if (why) {
      setProblem(why);
      return;
    }
    if (cur.key === "tried") {
      const answers = answersOf(d);
      if (answers) saveFreeCheck(answers);
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

  const screen: Record<Exclude<Key, "details" | "plan" | "code">, ReactNode> = {
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
            ? "For Indians, a BMI over 23 is above the healthy range. It is common, and a doctor can help."
            : band === "healthy"
              ? "You are in the healthy range for Indians, 18.5 to 23."
              : "You are below the healthy range for Indians, 18.5 to 23."}
          {band === "obesity" && <Cite id="misra" />}
        </p>

        {/* the categories at a glance (call, 16 Nov 2026: "show the BMI categories, what happens in which") */}
        <div className={s.block}>
          <h2 className={s.blockK}>BMI on the Indian scale</h2>
          <ul className={s.bands}>
            {BANDS.map((x) => (
              <li key={x.band} data-band={x.band} aria-current={x.band === band || undefined}>
                <i className={s.swatch} aria-hidden="true" />
                <span className={`${s.bandRange} num`}>{x.range}</span>
                <span className={s.bandText}>
                  <strong>
                    {x.name}
                    {x.band === band && <span className={s.you}>You</span>}
                  </strong>
                  <span>{x.line}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className={s.small}>
            The global chart starts overweight at 25 and obesity at 30. Indians face these risks at a lower BMI.
            <Cite id="who" />
          </p>
        </div>

        {band === "obesity" ? (
          <div className={s.block}>
            <h2 className={s.blockK}>Your first goal</h2>
            <dl className={s.ledger}>
              <div>
                <dt>5% of your weight</dt>
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
            </dl>
            <p className={s.small}>
              Your doctor sets your target with you. <Cite id="ada" />
            </p>
          </div>
        ) : (
          <div className={s.block}>
            <p>
              {band === "healthy"
                ? "Your waist and blood sugar matter too. A doctor can check them."
                : "Losing weight is not advised at this BMI."}
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

  // the first step is chosen here, then the code is sent (the code screen), then onboarding opens it
  const choose = (first: FirstStep) => {
    const answers = answersOf(d, identity, first);
    if (answers) saveFreeCheck(answers);
    setFirstStep(first);
    go(at("code"));
  };
  const bookLab = (
    <button type="button" className="btn btn--signal" onClick={() => choose("LAB")}>
      <span>Book home blood tests</span>
      <span className="well" aria-hidden="true">
        <ArrowRight size={18} />
      </span>
    </button>
  );
  const uploadInstead = (
    <button type="button" className={s.instead} onClick={() => choose("UPLOAD")}>
      <FileArrowUp size={18} aria-hidden="true" />
      <span>
        Have a blood report from the last 3 months? <u>Upload it instead</u>
      </span>
    </button>
  );

  const plan = canBook ? (
    <>
      <div className={s.close2} data-dark>
        <p className={s.closeK}>Your first step</p>
        <p className={s.closeText}>A blood test at home. A lab collects a sample at your door.</p>
        {bookLab}
        {uploadInstead}
      </div>
      <ol className={s.steps}>
        <li data-next>
          <p className={s.here}>Your next step</p>
          <h2 className={s.stepK}>Blood tests at home</h2>
          <p>Your doctor goes through every result with you.</p>
        </li>
        <li>
          <h2 className={s.stepK}>A review by our doctors</h2>
          <p>They check the programme suits you.</p>
        </li>
        <li>
          <h2 className={s.stepK}>A video consultation with your doctor</h2>
          <p>Your doctor and health coach, on one call.</p>
        </li>
        <li>
          <h2 className={s.stepK}>A plan, only if it suits you</h2>
          <p>You see the price before you pay. Not everyone is prescribed medication.</p>
        </li>
      </ol>

      <section className={s.block} aria-labelledby="say-k">
        <h2 id="say-k" className={s.blockK}>
          Your doctors
        </h2>
        {/* the doctors themselves, as on /doctors: face, name and qualifications only (NMC 2026) */}
        <ul className={s.faces} aria-label="Doctors on the care team">
          {LISTED_DOCTORS.filter((doc) => doc.photo).map((doc) => (
            <li key={doc.name}>
              <Image src={doc.photo!} alt="" width={56} height={70} className={s.face} />
              <span className={s.faceName}>{doc.name}</span>
              <span className={s.faceDeg}>{doc.degrees}</span>
            </li>
          ))}
        </ul>
        <p className={s.doctors}>
          Endocrinologists and internal medicine physicians, registered in India.{" "}
          <a href="/doctors">
            Meet the doctors
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        </p>
      </section>

      <div className={s.again}>{bookLab}</div>
    </>
  ) : (
    <div className={s.close2} data-dark>
      <p className={s.closeK}>Weight care is not for you right now</p>
      <p className={s.closeText}>Losing weight is not advised at your BMI. Our free tools are open to everyone.</p>
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
        <CheckDetails
          identity={identity}
          onChange={(patch) => setIdentity((prev) => ({ ...prev, ...patch }))}
          onDone={() => {
            const answers = answersOf(d, identity);
            if (answers) saveFreeCheck(answers);
            go(at("plan"));
          }}
        />
        <p className={s.private}>
          <LockSimple size={13} aria-hidden="true" />
          Private. Only your care team sees your details.
        </p>
      </>
    ) : cur.key === "code" ? (
      <CheckCode
        mobile={identity.mobile}
        lastSend={lastSend.current}
        onSent={(sent) => (lastSend.current = sent)}
        onChangeNumber={() => go(at("details"))}
        onVerified={({ role, nextScreen }) => {
          setLeaving(true);
          const answers = answersOf(d, identity, firstStep ?? undefined);
          if (answers) saveFreeCheck(answers);
          // an existing account: the profile is already done, so the check's answers are not used, but a
          // WhatsApp tick given here is recorded (a new account records it with the other consents)
          const existing = role !== "PATIENT" || nextScreen !== "ONBOARDING";
          // not awaited: a slow connection never holds the person on a blank screen (navigation keeps the request)
          if (existing && role === "PATIENT" && identity.whatsapp)
            void updateReminderSettings({ whatsappReminders: true }).catch(() => undefined);
          router.replace(existing ? homePathFor(role) : "/onboarding");
        }}
      />
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
            Private and free
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
              </div>
            </>
          ) : (
            <>
              <h1 id="check-q" ref={headingRef} tabIndex={-1} className={s.q}>
                {cur.key === "plan" && !canBook ? "Your result" : cur.q}
              </h1>
              {cur.key === "code" ? (
                <p className={s.why}>{firstStep === "UPLOAD" ? "Then you upload your report." : cur.why}</p>
              ) : (
                cur.why && (cur.key !== "plan" || canBook) && <p className={s.why}>{cur.why}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* the details have their own form (the code is sent from it); the other questions share this one */}
      {cur.key === "details" || cur.key === "plan" || cur.key === "code" ? (
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
