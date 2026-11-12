"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import type { Doctor } from "./doctor-data";
import s from "./Doctors.module.css";

/** Initials on carbon, for a doctor whose photo has not arrived yet. */
function Monogram({ name }: { name: string }) {
  const initials = name
    .replace(/^Dr\.?\s+/, "")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return (
    <span className={s.monogram} aria-hidden="true">
      {initials}
    </span>
  );
}

/*
  The doctors as one row that grows sideways. Four sit in view on a laptop; more scroll in behind
  the arrows, so ten doctors look as calm as four. Phones swipe, with the hairline showing how far.
*/
/** `plain`: the page section already has a heading, so the bench shows only its note and arrows. */
/** `grid`: the full directory, every doctor in rows, no rail (the /doctors page). */
export default function DoctorBench({ doctors, plain = false, grid = false }: { doctors: Doctor[]; plain?: boolean; grid?: boolean }) {
  const row = useRef<HTMLUListElement>(null);
  const fill = useRef<HTMLElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false, scrolls: false });

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = el.scrollWidth - el.clientWidth;
      const p = max > 0 ? el.scrollLeft / max : 1;
      // the bar shows the share of the row in view, sliding along as it scrolls
      const seen = el.clientWidth / el.scrollWidth;
      if (fill.current) fill.current.style.transform = `translateX(${p * (1 / seen - 1) * 100}%)`;
      if (fill.current) fill.current.style.width = `${Math.min(100, seen * 100)}%`;
      setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft > max - 4, scrolls: max > 4 });
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    el.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      el.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, []);

  const page = (dir: 1 | -1) => {
    // at an end the button stays focusable (aria-disabled), so keyboard focus is never dropped
    if ((dir < 0 && edge.start) || (dir > 0 && edge.end)) return;
    const el = row.current;
    const card = el?.querySelector("li");
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const step = card.getBoundingClientRect().width + gap;
    // a full view at a time, landing on a card edge
    const n = Math.max(1, Math.floor((el.clientWidth + gap) / step));
    el.scrollBy({ left: dir * n * step, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };


  return (
    <div className={s.bench} data-count={Math.min(doctors.length, 4)} data-grid={grid || undefined}>
      <div className={s.benchHead}>
        <div className={s.benchTitle}>
          <h3 id="bench-title" className={plain ? "vh" : "h3"}>
            Doctors on the care team
          </h3>
          {!plain && <p className={s.benchNote}>Each one is registered with the National Medical Commission or a State Medical Council.</p>}
        </div>
        {edge.scrolls && !grid && (
          <div className={s.arrows}>
            <button type="button" className={s.arrow} onClick={() => page(-1)} aria-disabled={edge.start} aria-label="Previous doctors" aria-controls="bench-row">
              <ArrowLeft size={18} weight="regular" />
            </button>
            <button type="button" className={s.arrow} onClick={() => page(1)} aria-disabled={edge.end} aria-label="More doctors" aria-controls="bench-row">
              <ArrowRight size={18} weight="regular" />
            </button>
          </div>
        )}
      </div>

      <div className={s.benchRail}>
        <ul id="bench-row" ref={row} className={s.cards} aria-labelledby="bench-title">
          {doctors.map((d, i) => (
            <li key={d.name}>
              <article className={s.card}>
                <figure className={s.portrait} suppressHydrationWarning data-reveal="wipe" style={{ "--d": `${Math.min(i, 3) * 80}ms` } as React.CSSProperties}>
                  {d.photo ? <Image src={d.photo} alt={`Portrait of ${d.name}`} fill sizes="(max-width: 599px) 46vw, (max-width: 1023px) 260px, 300px" /> : <Monogram name={d.name} />}
                  {/* years in practice sit on the portrait, just above the name, so the card never grows for them */}
                  {d.years && (
                    <span className={s.years}>
                      {d.years} years<span className="vh"> in practice</span>
                    </span>
                  )}
                </figure>
                <div className={s.cardBody}>
                  <h4 className={s.dname}>{d.name}</h4>
                  <p className={s.degrees}>{d.degrees}</p>
                  {d.specialty && <p className={s.spec}>{d.specialty}</p>}
                  {(d.reg || d.languages) && (
                    <dl className={s.meta}>
                      {d.reg && (
                        <div>
                          <dt>Registration</dt>
                          <dd>
                            {d.council}, No. {d.reg}
                          </dd>
                        </div>
                      )}
                      {d.languages && (
                        <div>
                          <dt>Consults in</dt>
                          <dd>{d.languages}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
        {edge.scrolls && !grid && (
          <div className={s.progress} aria-hidden="true">
            <i ref={fill} />
          </div>
        )}
      </div>
    </div>
  );
}
