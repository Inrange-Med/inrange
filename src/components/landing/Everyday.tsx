"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { Mask, Tag } from "./ui";
import s from "./Everyday.module.css";

/*
  Life at home: the days that break routine, and what the care team does about each one.
  Pick an occasion: its photo wipes in, the day redraws on a ruler from morning to past midnight,
  and the plan for that day reads underneath. An example, never a promise (CLAUDE.md): process
  only, no outcomes, no medicine named. Photos are everyday scenes, labelled as AI.
*/

type Mark = { at?: number; kind: "meal" | "move" | "check"; time: string; what: string };
type Occasion = {
  key: string;
  tab: string;
  title: string;
  img: string;
  alt: string;
  focus: string;
  marks: Mark[];
  care: string;
  link?: { href: string; label: string };
};

const OCCASIONS: Occasion[] = [
  {
    key: "evening",
    tab: "Weekday",
    title: "An ordinary weekday",
    img: "/img/life-day-c.jpg",
    alt: "A husband and wife in their fifties on an evening walk down their neighbourhood lane, talking and smiling",
    focus: "50% 40%",
    marks: [
      { at: 8, kind: "meal", time: "8:00 am", what: "Besan chilla with curd" },
      { at: 13.5, kind: "meal", time: "1:30 pm", what: "Dal, rotis, sabzi and salad" },
      { at: 17, kind: "meal", time: "5:00 pm", what: "Chai with roasted chana" },
      { at: 20.5, kind: "meal", time: "8:30 pm", what: "Dinner with the family, a little earlier" },
      { at: 21.25, kind: "move", time: "9:15 pm", what: "A 15-minute walk after dinner" },
    ],
    care: "Your coach plans the week from what is cooked at home, so nobody eats a separate meal.",
  },
  {
    key: "fast",
    tab: "Fasting",
    title: "A fasting day",
    img: "/img/life-fast.jpg",
    alt: "A woman in her forties on a sunlit balcony with a diya and marigolds, looking at her phone",
    focus: "50% 36%",
    marks: [
      { kind: "check", time: "Before", what: "Your doctor checks your readings and anything you take, and says what changes" },
      { at: 11, kind: "meal", time: "11:00 am", what: "Fruit with curd or makhana" },
      { at: 17.5, kind: "check", time: "5:30 pm", what: "A sugar check before the fast ends, if you have diabetes" },
      { at: 19.5, kind: "meal", time: "7:30 pm", what: "Kuttu roti with paneer and sabzi" },
    ],
    care: "Add your fast days in the app, for Navratri, Ekadashi, Ramzan or Karva Chauth, and the plan changes for them. A low reading goes straight to a doctor.",
    link: { href: "/guides/navratri-fasting-with-diabetes", label: "Fasting with diabetes: the guide" },
  },
  {
    key: "late",
    tab: "Late shift",
    title: "A late shift",
    img: "/img/life-late-c.jpg",
    alt: "A man in his thirties working at a desk at home late in the evening, a tiffin and a glass of water beside his laptop",
    focus: "50% 38%",
    marks: [
      { at: 12, kind: "meal", time: "Noon", what: "Your first meal, planned as breakfast" },
      { at: 16, kind: "move", time: "4:00 pm", what: "A walk before the calls begin" },
      { at: 20, kind: "meal", time: "8:00 pm", what: "Dal, rice and curd from the tiffin" },
      { at: 24, kind: "check", time: "Midnight", what: "Your check-in reminder, set to your hours" },
    ],
    care: "Reminders, check-ins and doctor reviews fit the hours you keep.",
  },
];

// the ruler runs from 6 in the morning to 2 at night
const H0 = 6;
const H1 = 26;
const X0 = 8;
const X1 = 592;
const xAt = (h: number) => X0 + ((h - H0) / (H1 - H0)) * (X1 - X0);

function DayRuler({ marks }: { marks: Mark[] }) {
  const hours = Array.from({ length: H1 - H0 + 1 }, (_, i) => H0 + i);
  return (
    <div className={s.ruler} aria-hidden="true">
      <svg viewBox="0 0 600 44" preserveAspectRatio="none">
        <line x1={X0} x2={X1} y1="24" y2="24" className={s.base} />
        {hours.map((h) => (
          <line key={h} x1={xAt(h)} x2={xAt(h)} y1={h % 6 === 0 ? 30 : 27} y2="24" className={s.tick} />
        ))}
      </svg>
      {/* marks are HTML so they stay round at any width */}
      {marks
        .filter((m) => m.at !== undefined)
        .map((m, i) => (
          <i key={`${m.kind}${i}`} className={s.mark} data-kind={m.kind} style={{ "--x": xAt(m.at!) / 600 } as React.CSSProperties} />
        ))}
      <div className={s.hours}>
        {[6, 12, 18, 24].map((h) => (
          <span key={h} style={{ left: `${(xAt(h) / 600) * 100}%` }}>
            {h === 6 ? "6 am" : h === 12 ? "Noon" : h === 18 ? "6 pm" : "Midnight"}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Everyday() {
  // the tab moves at once; the photo follows only when its image has decoded, so it never wipes to an empty panel
  const [at, setAt] = useState(0);
  const [shown, setShown] = useState(0);
  const ready = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (ready.current.has(at)) return setShown(at);
    // a slow network still gets its photo: switch after a short wait whatever the decode state
    const t = window.setTimeout(() => setShown(at), 1200);
    return () => window.clearTimeout(t);
  }, [at]);
  return (
    <section className={s.everyday} aria-labelledby="everyday-title">
      <div className={`wrap ${s.grid}`}>
        <div className={s.head}>
          <Tag dark>Life at home</Tag>
          <Mask id="everyday-title" className={`h2 ${s.title}`} lines={["Planned around", "fasts and late shifts."]} soft={1} />
          <p className={s.lede} suppressHydrationWarning data-reveal="rise" style={{ "--d": "180ms" } as React.CSSProperties}>
            Your doctor and coach build each week from your family&rsquo;s food and the days that break routine. Pick one
            to see its plan.
          </p>
        </div>

        <div className={s.copy}>
          <div
            className={s.tabs}
            role="tablist"
            aria-label="Occasions"
            style={{ "--at": at, "--n": OCCASIONS.length } as React.CSSProperties}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const next = (at + d + OCCASIONS.length) % OCCASIONS.length;
              setAt(next);
              (e.currentTarget.querySelectorAll("button")[next] as HTMLButtonElement | undefined)?.focus();
            }}
          >
            <span className={s.thumb} aria-hidden="true" />
            {OCCASIONS.map((x, i) => (
              <button
                key={x.key}
                id={`occ-tab-${x.key}`}
                type="button"
                role="tab"
                aria-selected={at === i}
                aria-controls="occ-panel"
                tabIndex={at === i ? 0 : -1}
                className={s.tab}
                onClick={() => setAt(i)}
              >
                {x.tab}
              </button>
            ))}
          </div>

          {/* every occasion's plan sits in one grid cell, so the panel keeps the tallest one's height and
              nothing below jumps when the tab changes; only the chosen one is visible and read */}
          <div className={s.panels}>
            {OCCASIONS.map((x, i) => (
              <div
                key={x.key}
                id={i === at ? "occ-panel" : undefined}
                role={i === at ? "tabpanel" : undefined}
                aria-labelledby={i === at ? `occ-tab-${x.key}` : undefined}
                aria-hidden={i !== at}
                inert={i !== at}
                data-on={i === at}
                className={s.panel}
              >
                <h3 className={s.dayTitle}>{x.title}</h3>
                <DayRuler marks={x.marks} />
                <ol className={s.marks}>
                  {x.marks.map((m, j) => (
                    <li key={j} data-kind={m.kind} style={{ "--i": j } as React.CSSProperties}>
                      <span className={s.time}>{m.time}</span>
                      <span>{m.what}</span>
                    </li>
                  ))}
                </ol>
                <p className={s.care}>{x.care}</p>
                <div className={s.foot}>
                  <p className={s.example}>An example. Your coach plans yours.</p>
                  {x.link && (
                    <a className={s.link} href={x.link.href}>
                      {x.link.label}
                      <ArrowRight size={15} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <figure className={s.photo} suppressHydrationWarning data-reveal="wipe">
          {OCCASIONS.map((x, i) => (
            <Image
              key={x.key}
              src={x.img}
              alt={i === shown ? x.alt : ""}
              aria-hidden={i !== shown}
              fill
              loading="eager"
              sizes="(max-width: 1023px) 100vw, 46vw"
              className={s.img}
              data-on={i === shown}
              onLoad={() => {
                ready.current.add(i);
                if (i === at) setShown(i);
              }}
              style={{ objectPosition: x.focus }}
            />
          ))}
        </figure>
      </div>
    </section>
  );
}
