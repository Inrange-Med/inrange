"use client";

/*
  The hero's film: three everyday moments in one seamless loop (a morning walk in the garden, a grandfather
  and granddaughter, a couple dancing in their kitchen), about how it feels to have energy and ease, never
  about a body. Made with Higgsfield (stills: Nano Banana Pro; motion: Kling 4.0), joined by
  scripts/media/hero-loop.sh (scripts/media/README.md; masters in art/, gitignored).

  It never costs the first screen: the poster paints first (preloaded by Hero), the film is muted and
  inline, phones get the 720 file, and it stays a still for anyone who asks for less motion or for data
  saving. It pauses while off screen, so it never runs behind the page.
*/

import { useEffect, useRef } from "react";

type SaveData = Navigator & { connection?: { saveData?: boolean } };

export default function HeroVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const saveData = Boolean((navigator as SaveData).connection?.saveData);
    let onScreen = true;
    const sync = () => {
      if (calm.matches || saveData || !onScreen || document.hidden) video.pause();
      // a refused play (an iPhone in Low Power Mode) leaves the poster showing: nothing to handle
      else void video.play().catch(() => {});
    };
    const seen = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    seen.observe(video);
    calm.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      seen.disconnect();
      calm.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      poster="/img/hero-v2-poster.jpg"
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
      disablePictureInPicture
    >
      <source src="/video/hero-v2-720.mp4" type="video/mp4" media="(max-width: 1023px)" />
      <source src="/video/hero-v2-1080.mp4" type="video/mp4" />
    </video>
  );
}
