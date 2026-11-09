"use client";

import { useState } from "react";
import { ASSESSMENT_URL, Art, Cta, Mask, Tag } from "./ui";
import s from "./Pricing.module.css";

/* One package, four prepaid lengths (strategy deck). Reviews every 14 days, check-ins weekly.
   No rupee figure: the package can include prescription medicine, and its price is set after the
   doctor's review. The page itemises what is included instead, and promises the price before payment. */
const LENGTHS = [
  { months: 1, weeks: 4 },
  { months: 4, weeks: 17 },
  { months: 6, weeks: 26 },
  { months: 12, weeks: 52 },
];
const MAX_WEEKS = 52;

const INCLUDED: [string, "Free" | "Included" | "Itemised"][] = [
  ["First consultation, 15 minutes, by video", "Free"],
  ["A one-minute check-in every week", "Included"],
  ["A doctor review every 14 days", "Included"],
  ["Blood tests at home through partner labs", "Included"],
  ["Your nutrition and strength plan", "Included"],
  ["The InRange app, with WhatsApp support", "Included"],
  [
    "Medicine, only if your doctor prescribes it, sealed and verified",
    "Itemised",
  ],
];

// The ruler draws the plan the way the Maintenance chart does: a dot for each weekly
// check-in, a ring around the dot for each 14-day review. Marks size to their spacing.
const X0 = 12;
const X1 = 588;

function Ruler({ weeks, months }: { weeks: number; months: number }) {
  const step = (X1 - X0) / weeks;
  const dense = weeks > 26; // a year of weekly dots reads as a barcode: show reviews only
  const ring = Math.max(4.5, Math.min(11, step * 2 * 0.34));
  const dot = Math.max(2.2, Math.min(5, ring * 0.45));
  const monthX = (i: number) => X0 + ((i * weeks) / months) * step;
  return (
    <>
      <svg className={s.ruler} viewBox="0 0 600 48" aria-hidden="true">
        <line x1={X0} x2={X1} y1="24" y2="24" className={s.base} />
        {Array.from({ length: months + 1 }, (_, i) => (
          <line
            key={`m${i}`}
            x1={monthX(i)}
            x2={monthX(i)}
            y1="4"
            y2="10"
            className={s.month}
          />
        ))}
        {Array.from({ length: MAX_WEEKS }, (_, i) => {
          const w = i + 1;
          const review = w % 2 === 0;
          const on = w <= weeks && (review || !dense);
          // marks beyond the plan keep their spacing and slide out past the end, so none ever pile up
          const x = X0 + w * step;
          return (
            <g
              key={w}
              className={s.mark}
              data-on={on}
              style={
                {
                  transform: `translateX(${x}px)`,
                  "--k": i,
                } as React.CSSProperties
              }
            >
              {review && (
                <circle cx="0" cy="24" r={ring} className={s.review} />
              )}
              <circle cx="0" cy="24" r={dot} className={s.checkin} />
            </g>
          );
        })}
        <circle cx={X0} cy="24" r={dot} className={s.checkin} />
      </svg>
      <div className={s.months} aria-hidden="true">
        {Array.from({ length: months + 1 }, (_, i) => (
          <span
            key={i}
            style={{ left: `${(monthX(i) / 600) * 100}%` }}
            data-odd={months >= 6 && i % 2 === 1}
            data-crowd={months > 6 && i % 2 === 1}
          >
            {i === 0 ? "Start" : i === months && months <= 4 ? `Month ${i}` : i}
          </span>
        ))}
      </div>
    </>
  );
}

export default function Pricing() {
  const [at, setAt] = useState(1);
  // after the first choice, the ruler answers quickly instead of replaying its entrance stagger
  const [touched, setTouched] = useState(false);
  const choose = (i: number) => {
    setTouched(true);
    setAt(i);
  };
  const plan = LENGTHS[at];
  const reviews = Math.floor(plan.weeks / 2);
  const dense = plan.weeks > 26;

  const label = (l: (typeof LENGTHS)[number]) => (
    <>
      <span className={s.segNum}>{l.months}</span>
      <span className={s.segUnit}>{l.months === 1 ? "month" : "months"}</span>
    </>
  );

  return (
    <section
      id="pricing"
      className={`section ${s.pricing}`}
      aria-labelledby="pricing-title"
    >
      <div className="wrap">
        <div className={s.head}>
          <Tag>Plans</Tag>
          <Mask
            id="pricing-title"
            className="h2"
            lines={["One plan.", "Four lengths."]}
          />
          <p
            className="lede"
            data-reveal="rise"
            style={{ "--d": "160ms" } as React.CSSProperties}
          >
            Consultations, reviews, blood tests, your nutrition plan, the app
            and delivery come in one package. Your check and first consultation
            are free, and you pay only after your doctor&rsquo;s review.
          </p>
        </div>

        <Art kind="converge" className={s.flow} />

        <article
          className={s.planner}
          data-reveal="rise"
          data-touched={touched}
        >
          <div className={s.tool}>
            <div
              className={s.seg}
              role="radiogroup"
              aria-label="Plan length"
              style={{ "--at": at } as React.CSSProperties}
              onKeyDown={(e) => {
                const d =
                  e.key === "ArrowRight" || e.key === "ArrowDown"
                    ? 1
                    : e.key === "ArrowLeft" || e.key === "ArrowUp"
                      ? -1
                      : 0;
                if (!d) return;
                e.preventDefault();
                const next = (at + d + LENGTHS.length) % LENGTHS.length;
                choose(next);
                (
                  e.currentTarget.querySelectorAll("button")[next] as
                    | HTMLButtonElement
                    | undefined
                )?.focus();
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
                  <dt>Doctor reviews, every 14 days</dt>
                  <dd>
                    <span key={reviews} className={s.num}>
                      {reviews}
                    </span>
                    <span className={s.unit}>reviews</span>
                  </dd>
                </div>
              </dl>
              <p className={s.note}>
                Every 14 days in the active plan. In maintenance, your doctor
                may space reviews further apart.
              </p>
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
              {INCLUDED.map(([a, b]) => (
                <li key={a}>
                  <span className={s.itemName}>{a}</span>
                  <span className={s.val} data-kind={b}>
                    {b}
                  </span>
                </li>
              ))}
            </ul>
            <div className={s.total}>
              <p className={s.totalK}>Your price</p>
              <p className={s.totalV}>Before you pay</p>
            </div>
            <p className={s.totalNote}>
              Shown in full, itemised, after your free consultation. Nothing is
              paid until then.
            </p>
            <Cta variant="mint" className={s.cta}>
              Start free check
            </Cta>
          </div>
        </article>

        <p className={`fineprint ${s.fine}`}>
          Plans are paid upfront, after your doctor&rsquo;s review. Whether any
          medicine is suitable is decided by your doctor, and not everyone is
          prescribed medication. A glucose sensor, if your doctor recommends
          one, is extra and priced before you agree. Results vary between
          individuals. For adults aged 18 and over, and not for emergencies.
          Care is provided by registered medical practitioners, and video
          consultations follow the Telemedicine Practice Guidelines, 2020.
        </p>
      </div>
    </section>
  );
}
