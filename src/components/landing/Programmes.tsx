import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Mask, Tag } from "./ui";
import { PROGRAMMES, programmeHref } from "./programme-data";
import SwipeProgress from "./SwipeProgress";
import RailArrows from "./RailArrows";
import s from "./Programmes.module.css";

/*
  The programmes as people. Each tile is one person in an ordinary Indian morning or evening,
  never a patient in a clinic, never a body part. Every tile opens its programme page; two are open
  now, the other two take a waitlist there.
*/
/** `bare`: the tiles alone, for the /programmes page, which has its own heading. */
export default function Programmes({ bare = false }: { bare?: boolean }) {
  // on /programmes the tiles sit straight under the h1
  const Name = bare ? "h2" : "h3";
  return (
    <section id="programmes" className={`section ${s.programmes}`} aria-labelledby={bare ? undefined : "programmes-title"} aria-label={bare ? "Programmes" : undefined} data-bare={bare || undefined}>
      <div className={`wrap ${s.grid}`}>
        {!bare && <div className={s.head}>
          <Tag>Programmes</Tag>
          <Mask id="programmes-title" className="h2" lines={["One care team,", "four programmes."]} soft={1} join />
          <p className={`lede ${s.lede}`} suppressHydrationWarning data-reveal="rise" style={{ "--d": "160ms" } as React.CSSProperties}>
            A doctor, blood tests at home and a care team in every one.
          </p>
        </div>}

        <div className={s.railWrap}>
          <div id="programme-rail" className={s.rail} data-swipe>
            {PROGRAMMES.map((p, i) => (
              // the whole tile is one link: photo, name, description and the pill all go to the programme
              <a key={p.key} href={programmeHref(p)} className={s.card} data-live={p.live || undefined}>
                <div className={s.media} suppressHydrationWarning data-reveal="wipe" style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>
                  <figure className={s.photo}>
                    <Image
                      src={p.img}
                      alt={p.alt}
                      fill
                      sizes="(max-width: 767px) 80vw, (max-width: 1199px) 44vw, 300px"
                      style={{ objectPosition: p.focus }}
                    />
                  </figure>
                  {!p.live && <span className="soonchip">Coming soon</span>}
                  <Name className={s.name}>{p.name}</Name>
                </div>
                <p className={s.line}>{p.line}</p>
                <span className={s.go} aria-hidden="true">
                  <span>{p.live ? "See the programme" : "Preview the programme"}</span>
                  <span className={s.well}>
                    <ArrowRight size={16} weight="regular" />
                  </span>
                </span>
              </a>
            ))}
          </div>
          <div className={s.foot}>
            <SwipeProgress className={s.progress} />
            <RailArrows target="programme-rail" label="programmes" className={s.arrows} buttonClassName={s.arrow} />
          </div>
        </div>

      </div>
    </section>
  );
}
