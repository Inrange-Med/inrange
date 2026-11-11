import Image from "next/image";
import ContourField from "./ContourField";
import { Mask, Tag } from "./ui";
import s from "./Maintenance.module.css";

/* Check-in rhythm, not an outcome: check-ins weekly while the plan is active, then fortnightly
   and monthly in maintenance. Doctor reviews come about every 30 days in the active plan, and
   further apart in maintenance. */
/* The strip spans the full column (0 to 600), so its edge, the labels and
   the legend share the heading's left edge. Labels start where their phase
   starts. The first and last marks sit 32 units inside the strip. */
const X0 = 20;
const X1 = 580;
const SPLIT = 252;
const active = Array.from({ length: 9 }, (_, i) => X0 + 12 + i * 26);
// spacing doubles from weekly (26) to fortnightly (48) to monthly (96)
const fortnight = Array.from({ length: 3 }, (_, i) => SPLIT + 28 + i * 48);
const monthly = Array.from({ length: 2 }, (_, i) => fortnight[2] + 96 * (i + 1));
// reviews about every four weeks while active (weeks 4 and 8), then further apart
const reviews = [active[3], active[7], fortnight[2], monthly[1]];

export default function Maintenance() {
  return (
    <section className={s.maint} aria-labelledby="maint-title">
      <figure className={s.photo} suppressHydrationWarning data-reveal="wipe">
        <Image
          src="/img/lodhi-morning-c.jpg"
          alt="Two people walking on a clear morning past a Mughal tomb in Lodhi Garden, New Delhi"
          fill
          sizes="100vw"
        />
      </figure>

      <div className={s.body}>
        <ContourField className={s.field} density={9} lineAlpha={0.07} signalAlpha={0.28} seed={7} interactive={false} />
        <div className={`wrap ${s.grid}`}>
          <div className={s.copy}>
            <Tag dark>After the first months</Tag>
            <Mask id="maint-title" className={`h2 ${s.title}`} lines={["Maintenance is", "part of the plan."]} soft={1} />
            <p className={s.lede} suppressHydrationWarning data-reveal="rise" style={{ "--d": "180ms" } as React.CSSProperties}>
              When you and your doctor agree you are ready, <span style={{ whiteSpace: "nowrap" }}>check-ins</span> get lighter
              and the same doctor stays with you.
            </p>
          </div>

          <figure className={s.chart} suppressHydrationWarning data-reveal="draw">
            <svg viewBox="0 0 600 176" aria-hidden="true">
              {/* one strip for the whole timeline; the maintenance phase is its tinted second half */}
              <defs>
                <clipPath id="mt-strip">
                  <rect x="0" y="40" width="600" height="96" rx="14" />
                </clipPath>
              </defs>
              <rect x={SPLIT} y="40" width={600 - SPLIT} height="96" clipPath="url(#mt-strip)" className={s.tint} />
              <line x1={SPLIT} x2={SPLIT} y1="40" y2="136" className={s.divide} />
              <rect x="0.5" y="40.5" width="599" height="95" rx="14" className={s.strip} />
              <text x="0" y="26" className={s.lbl}>
                Active plan
              </text>
              <text x={SPLIT} y="26" className={s.lblOn}>
                Maintenance
              </text>
              <line x1={X0} x2={X1} y1="88" y2="88" className={s.axis} />
              {[...active, ...fortnight, ...monthly].map((x, i) => (
                <circle key={x} cx={x} cy="88" r="5" className={s.tick} style={{ "--i": i } as React.CSSProperties} />
              ))}
              {reviews.map((x) => (
                <circle key={`r${x}`} cx={x} cy="88" r="11" className={s.ring} />
              ))}
              <text x="0" y="164" className={s.lbl}>
                Weekly
              </text>
              <text x={SPLIT} y="164" className={s.lbl}>
                Fortnightly, then monthly
              </text>
            </svg>
            <figcaption className={s.legend}>
              <span>
                <i className={s.kTick} /> Check-in
              </span>
              <span>
                <i className={s.kRing} /> Doctor review
              </span>
              <em>An example rhythm</em>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
