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

import { useEffect, useRef, useState } from "react";
import { Play } from "@phosphor-icons/react";

type SaveData = Navigator & { connection?: { saveData?: boolean } };

export default function HeroVideo({
  className,
  playClassName,
}: {
  className?: string;
  /** the "Play the film" button, shown only when the browser refused to start it by itself */
  playClassName?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  // Low Power Mode (Safari on a Mac or an iPhone) refuses every autoplay: then one tap plays it
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const saveData = Boolean((navigator as SaveData).connection?.saveData);
    let onScreen = true;
    let retry = 0;
    let timer = 0;
    const allowed = () => !calm.matches && !saveData;
    const sync = () => {
      window.clearTimeout(timer);
      // the browser's own autoplay starts the film the moment it counts as visible (Safari refuses a play()
      // while the reveal still covers it); reduced motion and data saving switch it off and keep the poster
      video.autoplay = allowed();
      if (!allowed() || !onScreen || document.hidden) {
        video.pause();
        return;
      }
      if (!video.paused) return;
      video.play().then(
        () => (retry = 0),
        () => {
          // refused (Safari before the reveal ends, Low Power Mode): ask again shortly, a few times, and from the
          // second refusal offer the tap that a browser always allows
          if (retry++ < 8) timer = window.setTimeout(sync, 600);
          if (retry >= 2) setRefused(true);
        },
      );
    };
    const seen = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      retry = 0;
      sync();
    });
    seen.observe(video);
    calm.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    const playing = () => setRefused(false);
    video.addEventListener("canplay", sync);
    video.addEventListener("playing", playing);
    sync();
    return () => {
      window.clearTimeout(timer);
      seen.disconnect();
      calm.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      video.removeEventListener("canplay", sync);
      video.removeEventListener("playing", playing);
    };
  }, []);

  return (
    <>
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
      {refused && (
        <button
          type="button"
          className={playClassName}
          onClick={() => void ref.current?.play().catch(() => {})}
        >
          <Play size={14} weight="fill" aria-hidden="true" />
          Play the film
        </button>
      )}
    </>
  );
}
