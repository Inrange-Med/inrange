"use client";

import { useEffect, useRef } from "react";

/** A hairline under a horizontal swipe row that fills as the row is scrolled. */
export default function SwipeProgress({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = ref.current;
    // the rail is a sibling of the bar, or of one of its wrappers
    let scope = bar?.parentElement ?? null;
    while (scope && !scope.querySelector("[data-swipe]")) scope = scope.parentElement;
    const row = scope?.querySelector<HTMLElement>("[data-swipe]");
    const fill = bar?.firstElementChild as HTMLElement | null;
    if (!bar || !row || !fill) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = row.scrollWidth - row.clientWidth;
      // the first card counts as a sixth of the way, so the bar is never empty
      const cards = row.children.length || 1;
      const p = max > 0 ? row.scrollLeft / max : 1;
      fill.style.transform = `scaleX(${(1 + p * (cards - 1)) / cards})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    row.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      row.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} className={className} aria-hidden="true">
      <i />
    </div>
  );
}
