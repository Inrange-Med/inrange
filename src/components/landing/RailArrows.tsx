"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";

/*
  Previous and next for a horizontal rail, for people with a mouse and no trackpad swipe.
  Pages a full view at a time and lands on a card edge. At an end the button stays focusable
  (aria-disabled), so keyboard focus is never dropped.
*/
export default function RailArrows({
  target,
  label,
  className,
  buttonClassName,
}: {
  /** id of the scrolling element */
  target: string;
  /** what the rail holds, for the button names: "programmes", "doctors" */
  label: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [edge, setEdge] = useState({ start: true, end: false });

  useEffect(() => {
    const el = document.getElementById(target);
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = el.scrollWidth - el.clientWidth;
      setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft > max - 4 });
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
  }, [target]);

  const page = (dir: 1 | -1) => {
    if ((dir < 0 && edge.start) || (dir > 0 && edge.end)) return;
    const el = document.getElementById(target);
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const step = card.getBoundingClientRect().width + gap;
    const n = Math.max(1, Math.floor((el.clientWidth + gap) / step));
    el.scrollBy({ left: dir * n * step, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <div className={className}>
      <button type="button" className={buttonClassName} onClick={() => page(-1)} aria-disabled={edge.start} aria-label={`Previous ${label}`} aria-controls={target}>
        <ArrowLeft size={18} weight="regular" />
      </button>
      <button type="button" className={buttonClassName} onClick={() => page(1)} aria-disabled={edge.end} aria-label={`More ${label}`} aria-controls={target}>
        <ArrowRight size={18} weight="regular" />
      </button>
    </div>
  );
}
