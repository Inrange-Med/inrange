"use client";

/*
  The hero's film (v3, 21 Nov 2026): one continuous shot, a father and his daughter flying a green kite on a Delhi
  rooftop at golden hour. Lightness, energy and joy with family, never a body, a number or a product; holding the string
  reads as being in control, in range. Chosen after reading Ro, Hims, Noom, Found, Elevate Now, Tata 1mg and Sugar.fit:
  their craft, made unmistakably Indian (docs: scripts/media/README.md). Higgsfield: still with Nano Banana Pro, motion
  with Kling 4.0, the clip ending on its opening frame so the loop is seamless with no crossfade
  (scripts/media/hero-v3-*.{py,sh}; masters in art/, gitignored).

  It never costs the first screen: the poster paints first (preloaded by Hero), the film is muted and inline, phones get
  the 720 file (0.6 MB), laptops the 1080 file (1.5 MB), and it stays a still for anyone who asks for less motion or for
  data saving. It pauses while off screen, so it never runs behind the page.
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
          // fifth (about 3 s: Safari usually starts it by then) offer the tap that a browser always allows
          if (retry++ < 8) timer = window.setTimeout(sync, 600);
          if (retry >= 5) setRefused(true);
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
        poster="/img/hero-v3-poster.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
        disablePictureInPicture
      >
        <source src="/video/hero-v3-720.mp4" type="video/mp4" media="(max-width: 1023px)" />
        <source src="/video/hero-v3-1080.mp4" type="video/mp4" />
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
