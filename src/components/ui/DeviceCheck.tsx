"use client";

/**
 * A rehearsal for the video call: the person sees themselves and watches the microphone move,
 * before anyone is waiting. Nothing is recorded or sent; the camera stops when this unmounts.
 * Used in the "Test camera and mic" sheet and before joining a consultation.
 */

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  Microphone,
  VideoCamera,
  WarningCircle,
} from "@phosphor-icons/react";
import formStyles from "./styles/FormControls.module.css";
import styles from "./DeviceCheck.module.css";

type CheckState =
  | "idle"
  | "asking"
  | "live"
  | "denied"
  | "missing"
  | "unsupported";

/** Which browser settings to point at when access is blocked. */
function whereToAllow() {
  const agent = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(agent))
    return "On an iPhone, open Settings, then Safari (or Chrome), then Camera and Microphone, and choose Allow. Come back and try again.";
  if (/Android/.test(agent))
    return "Tap the icon to the left of the address bar, then Permissions, and allow Camera and Microphone. Then try again.";
  return "Click the icon to the left of the address bar, allow Camera and Microphone for this site, then try again.";
}

/**
 * `seenBy` names who is on the other end ("your doctor" for a patient, "your patient" for a doctor).
 * `quiet` makes "Start the check" a ghost pill, for a screen whose one main action comes after it
 * (Join the call).
 */
export default function DeviceCheck({
  seenBy = "your doctor",
  quiet = false,
}: {
  seenBy?: string;
  quiet?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const stream = useRef<MediaStream | null>(null);
  // only mounted in the browser, after a tap (a sheet or the pre-join screen)
  const [state, setState] = useState<CheckState>(() =>
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    "getUserMedia" in navigator.mediaDevices
      ? "idle"
      : "unsupported",
  );
  const [heard, setHeard] = useState(false);

  useEffect(() => {
    const live = stream;
    return () => live.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (state !== "live" || !stream.current) return;
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const context = new AudioContextClass();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream.current).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0;
    let loudFrames = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const value of samples) sum += ((value - 128) / 128) ** 2;
      const level = Math.min(1, Math.sqrt(sum / samples.length) * 4);
      // written straight to the element: sixty updates a second never touch React
      if (meter.current)
        meter.current.style.transform = `scaleX(${level.toFixed(3)})`;
      if (level > 0.18 && ++loudFrames > 6) setHeard(true);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      context.close();
    };
  }, [state]);

  const start = async () => {
    setState("asking");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      stream.current = media;
      setState("live");
      requestAnimationFrame(() => {
        if (video.current) video.current.srcObject = media;
      });
    } catch (caught) {
      const name = (caught as DOMException).name;
      setState(
        name === "NotFoundError" || name === "OverconstrainedError"
          ? "missing"
          : "denied",
      );
    }
  };

  return (
    <div className={styles.check}>
      <div className={styles.checkStage} data-state={state}>
        {state === "live" ? (
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            className={styles.checkVideo}
          />
        ) : (
          <span className={styles.checkGlyph} aria-hidden="true">
            <VideoCamera size={28} />
          </span>
        )}
      </div>

      {state === "live" && (
        <div className={styles.checkRows}>
          <p>
            <CheckCircle size={18} weight="fill" /> Camera works. This is what{" "}
            {seenBy} will see.
          </p>
          <div className={styles.mic}>
            <Microphone size={18} />
            <span className={styles.micTrack} aria-hidden="true">
              <span ref={meter} />
            </span>
            <span className={styles.micLabel}>
              {heard ? "Microphone works" : "Say a few words"}
            </span>
          </div>
          <p className={formStyles.hint}>
            Sit facing a window or a lamp, with your phone at eye level.
            Earphones help in a busy house.
          </p>
        </div>
      )}

      {state === "denied" && (
        <p className={styles.alert} role="alert">
          <WarningCircle size={18} weight="fill" />
          The browser has blocked the camera or microphone. {whereToAllow()}
        </p>
      )}
      {state === "missing" && (
        <p className={styles.alert} role="alert">
          <WarningCircle size={18} weight="fill" />
          No camera or microphone was found. On a laptop, check that nothing
          else is using them, such as another call.
        </p>
      )}
      {state === "unsupported" && (
        <p className={styles.alert} role="alert">
          <WarningCircle size={18} weight="fill" />
          This browser cannot open the camera. Open the app in Safari on an
          iPhone, or Chrome elsewhere.
        </p>
      )}

      {(state === "idle" || state === "asking" || state === "denied") && (
        <>
          {state !== "denied" && (
            <p className={formStyles.hint}>
              Your browser will ask to use the camera and microphone. Nothing is
              recorded, and both turn off when you close this.
            </p>
          )}
          {quiet ? (
            <button
              type="button"
              className={`btn btn--ghost ${styles.quietStart}`}
              onClick={start}
              data-busy={state === "asking"}
            >
              {state === "asking" ? (
                <i className={formStyles.spin} aria-hidden="true" />
              ) : (
                <VideoCamera size={17} aria-hidden="true" />
              )}
              <span>
                {state === "denied"
                  ? "Try again"
                  : state === "asking"
                    ? "Waiting for your browser"
                    : "Start the check"}
              </span>
            </button>
          ) : (
            <button
              type="button"
              className={`btn ${formStyles.go}`}
              onClick={start}
              data-busy={state === "asking"}
            >
              <span>
                {state === "denied"
                  ? "Try again"
                  : state === "asking"
                    ? "Waiting for your browser"
                    : "Start the check"}
              </span>
              <span className="well" aria-hidden="true">
                {state === "asking" ? (
                  <i className={formStyles.spin} />
                ) : (
                  <ArrowRight size={18} />
                )}
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
