import Image from "next/image";
import { Barbell, Drop, ForkKnife, Ruler, Scales, Watch } from "@phosphor-icons/react/dist/ssr";
import { Art, Mask, Tag } from "./ui";
import SwipeProgress from "./SwipeProgress";
import { GlucosePlate, ProteinPlate, WaistPlate, WeightPlate } from "./MeasurePlates";
import s from "./Measures.module.css";

export default function Measures() {
  return (
    <section id="measures" className={`section ${s.measures}`} aria-labelledby="measures-title">
      <Art kind="arcs" className={s.art} />
      <div className="wrap">
        <div className={s.head}>
          <Tag>What we measure</Tag>
          <Mask id="measures-title" className="h2" lines={["The scale is one", "reading out of many."]} soft={1} />
          <p className="lede" suppressHydrationWarning data-reveal="rise" style={{ "--d": "180ms" } as React.CSSProperties}>
            Your care team watches how your body is changing, muscle included.
          </p>
        </div>
      </div>

      <div className={s.scroller} tabIndex={0} role="region" aria-label="What we measure" data-swipe>
        <div className={s.bento}>
          <article className={`${s.cell} ${s.food}`} suppressHydrationWarning data-reveal="draw">
            <div className={s.visual}>
              <ProteinPlate />
            </div>
            <div className={s.text}>
              <p className={s.meta}>
                <ForkKnife size={16} aria-hidden="true" />
                Logged from a photo of your plate
              </p>
              <h3 className="h3">Protein at every meal</h3>
              <p>Your coach sets a daily target from dal, paneer, curd, eggs or chicken, whichever you already eat.</p>
            </div>
          </article>

          <article className={`${s.cell} ${s.trend}`} suppressHydrationWarning data-reveal="draw">
            <div className={s.visual}>
              <WeightPlate />
            </div>
            <div className={s.text}>
              <p className={s.meta}>
                <Scales size={16} aria-hidden="true" />
                Any scale, read weekly
              </p>
              <h3 className="h3">
                Weight, as a <span style={{ whiteSpace: "nowrap" }}>seven-day</span> average
              </h3>
              <p>Daily readings swing with water and salt. We read the average, so one heavy morning changes nothing.</p>
            </div>
          </article>

          <article className={`${s.cell} ${s.glucose}`} suppressHydrationWarning data-reveal="draw">
            <div className={s.visual}>
              <GlucosePlate />
            </div>
            <div className={s.text}>
              <p className={s.meta}>
                <Drop size={16} aria-hidden="true" />
                Lab tests, meter or sensor
              </p>
              <h3 className="h3">Blood sugar, if you have diabetes</h3>
              <p>Your sugar markers are rechecked at home as often as your doctor advises. If a glucose sensor is recommended, you see its cost first.</p>
            </div>
          </article>

          <article className={`${s.cell} ${s.strength}`}>
            <figure className={s.photo} suppressHydrationWarning data-reveal="wipe">
              <Image src="/img/strength-c.jpg" alt="A woman doing a dumbbell row on a low bench at home" fill sizes="(max-width: 1023px) 82vw, 30vw" />
            </figure>
            <div className={s.text}>
              <p className={s.meta}>
                <Barbell size={16} aria-hidden="true" />
                Planned with your coach
              </p>
              <h3 className="h3">Strength, twice a week</h3>
              <p>A short routine for home or gym, with what you have. Your coach adjusts it as you get stronger.</p>
            </div>
          </article>

          <article className={`${s.cell} ${s.waist}`} suppressHydrationWarning data-reveal="draw">
            <div className={s.visual}>
              <WaistPlate />
            </div>
            <div className={s.text}>
              <p className={s.meta}>
                <Ruler size={16} aria-hidden="true" />
                A tape measure at home
              </p>
              <h3 className="h3">Waist, at the navel</h3>
              <p>
                For South Asians, fat around the organs says more about risk than weight alone. Indian guidance flags 80&nbsp;cm for
                women and 90&nbsp;cm for men.
              </p>
            </div>
          </article>

          <article className={`${s.cell} ${s.scale}`}>
            <figure className={s.photo} suppressHydrationWarning data-reveal="wipe">
              <Image src="/img/watch-c.jpg" alt="A man wearing a smartwatch tying his running shoes on a stone step at dawn" fill sizes="(max-width: 1023px) 82vw, 26vw" />
            </figure>
            <div className={s.text}>
              <p className={s.meta}>
                <Watch size={16} aria-hidden="true" />
                Apple Health or Health Connect
              </p>
              <h3 className="h3">Readings that arrive on their own</h3>
              <p>Link a watch, ring or smart scale. Steps, sleep and weight arrive without typing.</p>
            </div>
          </article>
        </div>
      </div>
      <SwipeProgress className={s.progress} />
    </section>
  );
}
