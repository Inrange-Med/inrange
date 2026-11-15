"use client";

import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { ASSESSMENT_URL, Art, Cta, Mask, Tag } from "./ui";
import { includedIn, PLANS } from "./plans";
import s from "./Pricing.module.css";

/* One package, four prepaid lengths, from plans.ts. A doctor review about every 30 days (one a
   month), check-ins weekly. No prices (client call, 12 Nov 2026): the plan is priced after the
   doctor's review, itemised before anything is paid. */
const LENGTHS = PLANS;
const MAX_WEEKS = 52;
// the week each monthly review lands on, the same for every length (4, 9, 13, 17, 22, 26 ... 52),
// so marks keep their identity as the plan changes
const REVIEW_LIST = Array.from({ length: 12 }, (_, k) => Math.round(((k + 1) * 52) / 12));
const REVIEW_WEEKS = new Set(REVIEW_LIST);


// The ruler draws the plan the way the Maintenance chart does: a dot for each weekly
// check-in, a ring around the dot for each monthly review. Marks size to their spacing.
const X0 = 12;
const X1 = 588;

function Ruler({ weeks, months }: { weeks: number; months: number }) {
  const step = (X1 - X0) / weeks;
  const dense = weeks > 26; // a year of weekly dots reads as a barcode: show reviews only
  const ring = Math.max(4.5, Math.min(11, step * 4.33 * 0.3));
  const dot = Math.max(2.2, Math.min(5, ring * 0.45));
  // each month tick sits on the check-in its review rings; a year shows reviews only, so they space evenly
  const monthX = (i: number) => X0 + (i === 0 ? 0 : dense ? (i * weeks) / months : REVIEW_LIST[i - 1]) * step;
  return (
    <>
      <svg className={s.ruler} viewBox="0 0 600 48" aria-hidden="true">
        <line x1={X0} x2={X1} y1="24" y2="24" className={s.base} />
        {Array.from({ length: months + 1 }, (_, i) => (
          <line key={`m${i}`} x1={monthX(i)} x2={monthX(i)} y1="4" y2="10" className={s.month} />
        ))}
        {Array.from({ length: MAX_WEEKS }, (_, i) => {
          const w = i + 1;
          const review = REVIEW_WEEKS.has(w);
          const on = w <= weeks && (review || !dense);
          // marks beyond the plan keep their spacing and slide out past the end, so none ever pile up
          const x = X0 + (dense && review ? ((REVIEW_LIST.indexOf(w) + 1) * weeks) / months : w) * step;
          return (
            <g key={w} className={s.mark} data-on={on} style={{ transform: `translateX(${x}px)`, "--k": i } as React.CSSProperties}>
              {review && <circle cx="0" cy="24" r={ring} className={s.review} />}
              <circle cx="0" cy="24" r={dot} className={s.checkin} />
            </g>
          );
        })}
        <circle cx={X0} cy="24" r={dot} className={s.checkin} />
      </svg>
      <div className={s.months} aria-hidden="true">
        {Array.from({ length: months + 1 }, (_, i) => (
          <span key={i} style={{ left: `${(monthX(i) / 600) * 100}%` }} data-odd={months >= 6 && i % 2 === 1} data-crowd={months > 6 && i % 2 === 1}>
            {i === 0 ? "Start" : i === months && months <= 4 ? `Month ${i}` : i}
          </span>
        ))}
      </div>
    </>
  );
}

/** The plan picker: lengths, the care it buys drawn as a ruler, and the itemised package. Shared by the
    homepage section and /pricing. */
export function Planner() {
  const [at, setAt] = useState(1);
  // after the first choice, the ruler answers quickly instead of replaying its entrance stagger
  const [touched, setTouched] = useState(false);
  const choose = (i: number) => {
    setTouched(true);
    setAt(i);
  };
  const plan = LENGTHS[at];
  const reviews = plan.months;
  const dense = plan.weeks > 26;

  const label = (l: (typeof LENGTHS)[number]) => (
    <>
      <span className={s.segNum}>{l.months}</span>
      <span className={s.segUnit}>months</span>
    </>
  );

  return (
    <article className={s.planner} suppressHydrationWarning data-reveal="rise" data-touched={touched} data-dock-hide>
      <div className={s.tool}>
        <div
          className={s.seg}
          role="radiogroup"
          aria-label="Plan length"
          style={{ "--at": at } as React.CSSProperties}
          onKeyDown={(e) => {
            const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
            if (!d) return;
            e.preventDefault();
            const next = (at + d + LENGTHS.length) % LENGTHS.length;
            choose(next);
            (e.currentTarget.querySelectorAll("button")[next] as HTMLButtonElement | undefined)?.focus();
          }}
        >
          <span className={s.thumb} aria-hidden="true" />
          {LENGTHS.map((l, i) => (
            <button
              key={l.months}
              type="button"
              role="radio"
              aria-checked={at === i}
              tabIndex={at === i ? 0 : -1}
              onClick={() => choose(i)}
              className={s.segBtn}
            >
              {label(l)}
            </button>
          ))}
          {/* dark ink clipped to the thumb, so labels invert exactly where it passes */}
          <span className={s.ink} aria-hidden="true">
            {LENGTHS.map((l) => (
              <span key={l.months}>{label(l)}</span>
            ))}
          </span>
        </div>

        {/* how the chosen length is priced, said once, beside the choice */}
        <p className={s.totalNote}>
          Your doctor suggests the length that suits you. You see the itemised price after your consultation, and pay
          nothing for a plan until then.
        </p>
        <Cta href={`${ASSESSMENT_URL}?plan=${plan.months}`} variant="light" className={s.cta}>
          Book consultation
        </Cta>
        <div className={s.figures}>
          <dl className={s.readout} aria-live="polite">
            <div>
              <dt>Care</dt>
              <dd>
                <span key={plan.weeks} className={s.num}>
                  {plan.weeks}
                </span>
                <span className={s.unit}>weeks</span>
              </dd>
            </div>
            <div>
              <dt>Doctor reviews, every month</dt>
              <dd>
                <span key={reviews} className={s.num}>
                  {reviews}
                </span>
                <span className={s.unit}>reviews</span>
              </dd>
            </div>
          </dl>
          <p className={s.note}>Monthly in the active plan. In maintenance, your doctor may space them further apart.</p>
        </div>

        <div className={s.rulerWrap}>
          <Ruler weeks={plan.weeks} months={plan.months} />
          <p className={s.key} aria-hidden="true">
            <span data-hide={dense}>
              <i className={s.kWeek} /> Weekly check-in
            </span>
            <span>
              <i className={s.kReview} /> Doctor review
            </span>
          </p>
        </div>
      </div>

      <div className={s.side}>
        <ul className={s.items}>
          {includedIn(plan).map(([a, b]) => (
            <li key={a}>
              <span className={s.itemName}>{a}</span>
              <span className={s.val} data-kind={b}>
                {b}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export default function Pricing() {
  return (
    <section id="pricing" className={`section ${s.pricing}`} aria-labelledby="pricing-title">
      <div className="wrap">
        <div className={s.head}>
          <Tag>Plans</Tag>
          <Mask id="pricing-title" className="h2" lines={["One plan.", "Four lengths."]} soft={1} join />
          <p className="lede" suppressHydrationWarning data-reveal="rise" style={{ "--d": "160ms" } as React.CSSProperties}>
            Reviews, blood tests, your nutrition plan, the app and delivery in one package. The check is free, the
            first step has its own fee, and medicine, only if prescribed, is billed separately.
          </p>
        </div>

        <Art kind="converge" className={s.flow} />

        <Planner />

        <p className={`fineprint ${s.fine}`}>
          Plans are priced after your doctor&rsquo;s review and paid upfront, with an itemised price before you pay. Whether any medicine is suitable is decided by your
          doctor, and not everyone is prescribed medication. A glucose sensor, if your doctor recommends one, is extra and
          priced before you agree. Results vary between individuals. For adults aged 18 and over, and not for emergencies.
          Care is provided by registered medical practitioners, and video consultations follow the Telemedicine Practice
          Guidelines, 2020.
        </p>
      </div>
    </section>
  );
}
