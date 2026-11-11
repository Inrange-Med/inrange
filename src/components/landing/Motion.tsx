"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Page-level motion runtime.
 * 1. Smooth wheel scrolling on fine pointers (touch keeps native momentum).
 * 2. One IntersectionObserver that plays every [data-reveal] element once.
 */
export default function Motion() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;

    let lenis: Lenis | null = null;
    const tick = (t: number) => lenis?.raf(t * 1000);
    if (fine && !reduce) {
      lenis = new Lenis({ lerp: 0.14, wheelMultiplier: 1 });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      // The top margin is effectively unbounded: anything already scrolled past
      // counts as seen. A fast flick (or a busy frame on a slow phone) can carry
      // an element from below the screen to above it between two checks, and it
      // must never be left hidden.
      { rootMargin: "100000px 0px -12% 0px", threshold: 0 },
    );
    // Drawings wait until they are well on screen, so the draw-in is actually seen.
    const drawIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            drawIo.unobserve(e.target);
          }
        }
      },
      { rootMargin: "100000px 0px -30% 0px", threshold: 0 },
    );
    document.querySelectorAll("[data-reveal]:not(.in)").forEach((el) =>
      ((el as HTMLElement).dataset.reveal === "draw" ? drawIo : io).observe(el),
    );

    // anchor links go through lenis so they share the same easing
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a[href^='#']") as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute("href")!;
      const el = id.length > 1 ? document.querySelector(id) : null;
      if (!el) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(el as HTMLElement, { offset: -8, duration: 1.4 });
      else (el as HTMLElement).scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      // move keyboard focus with the scroll, so skip links and anchors really land
      if (!(el as HTMLElement).hasAttribute("tabindex")) (el as HTMLElement).setAttribute("tabindex", "-1");
      (el as HTMLElement).focus({ preventScroll: true });
      history.replaceState(null, "", id);
    };
    document.addEventListener("click", onClick);

    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener("load", onLoad);

    return () => {
      io.disconnect();
      drawIo.disconnect();
      document.removeEventListener("click", onClick);
      window.removeEventListener("load", onLoad);
      gsap.ticker.remove(tick);
      lenis?.destroy();
    };
  }, []);

  return null;
}
