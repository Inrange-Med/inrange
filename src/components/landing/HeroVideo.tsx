"use client";

/*
  The hero's film (v3, 21 Nov 2026): one continuous shot, a father and his daughter flying a green kite on a Delhi
  rooftop at golden hour. Lightness, energy and joy with family, never a body, a number or a product; holding the string
  reads as being in control, in range. Chosen after reading Ro, Hims, Noom, Found, Elevate Now, Tata 1mg and Sugar.fit:
  their craft, made unmistakably Indian (docs: scripts/media/README.md). Higgsfield: still with Nano Banana Pro, motion
  with Kling 4.0, the clip ending on its opening frame so the loop is seamless with no crossfade
  (scripts/media/hero-v3-*.{py,sh}; masters in art/, gitignored).

  It plays by itself, silently, every time (Arhaan, 21 Nov 2026: "no matter what the mode or browser"):
  1. the browser's own muted autoplay (Chrome, Firefox, Safari normally);
  2. where autoplay is refused outright (Safari in Low Power Mode on a Mac or an iPhone, which blocks every video, muted
     or not), it steps through the film itself: seeking a paused video is not playback, so nothing blocks it. Measured
     in Safari 26.1 in Low Power Mode: about 30 frames a second. The file has a keyframe every second, so each step is
     cheap.
  The one exception is a visitor who asked their device for less motion (an accessibility setting): they see the still.
  It pauses while off screen or in a background tab. The poster paints first (preloaded by Hero); phones get the 720
  file (0.95 MB), laptops the 1080 file (2.2 MB).
*/

import { useEffect, useRef } from "react";

export default function HeroVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const video: HTMLVideoElement = node;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    let onScreen = true;
    let stepping = false; // autoplay refused: the film is drawn by seeking instead
    let frame = 0;
    let clock = 0; // where the stepped film is, in seconds
    let last = 0;

    const running = () => !calm.matches && onScreen && !document.hidden;

    // the stepped film: move the playhead with the clock, one seek at a time (a seek still pending is never stacked)
    const step = (now: number) => {
      frame = 0;
      if (!stepping || !running()) return;
      if (last) clock = (clock + (now - last) / 1000) % (video.duration || 10);
      last = now;
      if (!video.seeking && video.readyState >= 1) video.currentTime = clock;
      frame = requestAnimationFrame(step);
    };
    const startStepping = () => {
      if (stepping) return;
      stepping = true;
      clock = video.currentTime;
      sync();
    };

    function sync() {
      cancelAnimationFrame(frame);
      frame = 0;
      video.autoplay = !calm.matches;
      if (!running()) {
        video.pause();
        last = 0;
        return;
      }
      if (stepping) {
        last = 0;
        frame = requestAnimationFrame(step);
        return;
      }
      if (!video.paused) return;
      video.play().then(
        () => {},
        // refused (Low Power Mode, or any browser that will not autoplay): the film steps itself at once, no waiting
        () => startStepping(),
      );
    }

    const seen = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    seen.observe(video);
    calm.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    video.addEventListener("canplay", sync);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      seen.disconnect();
      calm.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      video.removeEventListener("canplay", sync);
    };
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      poster="/img/hero-v3-poster.jpg"
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
      disablePictureInPicture
    >
      <source src="/video/hero-v3-720.mp4" type="video/mp4" media="(max-width: 1023px)" />
      <source src="/video/hero-v3-1080.mp4" type="video/mp4" />
    </video>
  );
}
