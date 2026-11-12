"use client";

/**
 * The isoline "scan" field drawn on dark plates (one WebGL2 fragment shader, contourFieldShaders).
 * Decoration only: it starts after first paint, only on real graphics hardware, pauses off-screen
 * and renders one still frame under reduced motion. The landing page keeps its own copy.
 */

import { useEffect, useRef } from "react";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./contourFieldShaders";

type Props = {
  className?: string;
  /** rgb 0-1 */
  line?: [number, number, number];
  signal?: [number, number, number];
  lineAlpha?: number;
  signalAlpha?: number;
  density?: number;
  scan?: boolean;
  interactive?: boolean;
  seed?: number;
};

export default function ContourField({
  className,
  line = [0.78, 0.79, 0.81],
  signal = [0.97, 0.97, 0.98],
  lineAlpha = 0.16,
  signalAlpha = 0.72,
  density = 11,
  scan = true,
  interactive = true,
  seed = 0,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // The field is decoration: it starts once the page has painted, and only on real graphics
    // hardware. Software GL (low-end phones, lab machines) would block the first paint for seconds,
    // so there the band keeps its own carbon colour.
    const init = (): (() => void) | undefined => {
      const gl = canvas.getContext("webgl2", {
        premultipliedAlpha: true,
        antialias: false,
        alpha: true,
        failIfMajorPerformanceCaveat: true,
      });
      if (!gl || gl.isContextLost()) return;

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const coarse = window.matchMedia("(pointer: coarse)").matches;

      const compileShader = (type: number, source: string) => {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
      };
      const program = gl.createProgram()!;
      gl.attachShader(program, compileShader(gl.VERTEX_SHADER, VERTEX_SHADER));
      gl.attachShader(
        program,
        compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER),
      );
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
      gl.useProgram(program);

      // one triangle that covers the whole canvas
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "p");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const uniform = (name: string) => gl.getUniformLocation(program, name);
      const uRes = uniform("uRes");
      const uT = uniform("uT");
      const uPtr = uniform("uPtr");
      const uPtrAmt = uniform("uPtrAmt");
      const uDpr = uniform("uDpr");
      // the palette colours the field through custom properties (--field-line, --field-signal,
      // optional --field-line-a), as in the design repository; the props are the fallback
      const css = getComputedStyle(canvas);
      const rgb = (name: string, fallback: number[]) => {
        const value = css
          .getPropertyValue(name)
          .trim()
          .split(/\s+/)
          .map(Number);
        return value.length === 3 && value.every((x) => Number.isFinite(x))
          ? value
          : fallback;
      };
      const lineA = Number(css.getPropertyValue("--field-line-a")) || lineAlpha;
      gl.uniform3fv(uniform("uLine"), rgb("--field-line", line));
      gl.uniform3fv(uniform("uSig"), rgb("--field-signal", signal));
      gl.uniform1f(uniform("uLineA"), lineA);
      gl.uniform1f(uniform("uSigA"), signalAlpha);
      gl.uniform1f(uniform("uDensity"), density);
      gl.uniform1f(uniform("uScan"), scan ? 1 : 0);
      gl.uniform1f(uniform("uSeed"), seed);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      let dpr = 1;
      const resize = () => {
        dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uDpr, 1);
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);

      // pointer eased toward target so the field follows with mass
      const pointer = {
        x: 0.5,
        y: 0.5,
        targetX: 0.5,
        targetY: 0.5,
        amount: 0,
        targetAmount: 0,
      };
      const onMove = (event: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        pointer.targetX = (event.clientX - rect.left) / rect.width;
        pointer.targetY = 1 - (event.clientY - rect.top) / rect.height;
        pointer.targetAmount =
          pointer.targetX > 0 &&
          pointer.targetX < 1 &&
          pointer.targetY > 0 &&
          pointer.targetY < 1
            ? 1
            : 0;
      };
      if (interactive && !coarse && !reducedMotion)
        window.addEventListener("pointermove", onMove, { passive: true });

      let raf = 0;
      let visible = true;
      let last = performance.now();
      let time = 12 + seed * 7;
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const elapsed = Math.min(0.05, (now - last) / 1000);
        // cap at ~30fps on touch devices to save battery
        if (coarse && now - last < 32) return;
        last = now;
        time += elapsed;
        pointer.x += (pointer.targetX - pointer.x) * 0.06;
        pointer.y += (pointer.targetY - pointer.y) * 0.06;
        pointer.amount += (pointer.targetAmount - pointer.amount) * 0.04;
        gl.uniform1f(uT, time);
        gl.uniform2f(uPtr, pointer.x, pointer.y);
        gl.uniform1f(uPtrAmt, pointer.amount);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      const drawStill = () => {
        gl.uniform1f(uT, time);
        gl.uniform2f(uPtr, 0.5, 0.5);
        gl.uniform1f(uPtrAmt, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      const visibilityObserver = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        cancelAnimationFrame(raf);
        if (visible && !reducedMotion) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      });
      if (reducedMotion) drawStill();
      else visibilityObserver.observe(canvas);

      const onVis = () => {
        cancelAnimationFrame(raf);
        if (!document.hidden && visible && !reducedMotion) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      };
      document.addEventListener("visibilitychange", onVis);
      // if the GPU drops the context, hide the canvas so the plate's own colour shows, never a blank box
      const onLost = (event: Event) => {
        event.preventDefault();
        cancelAnimationFrame(raf);
        canvas.style.visibility = "hidden";
      };
      canvas.addEventListener("webglcontextlost", onLost);

      canvas.dataset.ready = "1";

      return () => {
        cancelAnimationFrame(raf);
        visibilityObserver.disconnect();
        resizeObserver.disconnect();
        window.removeEventListener("pointermove", onMove);
        document.removeEventListener("visibilitychange", onVis);
        canvas.removeEventListener("webglcontextlost", onLost);
        // Free GPU objects but keep the context: React may remount this same canvas.
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
      };
    };

    let stop: (() => void) | undefined;
    let unmounted = false;
    const start = () => {
      if (!unmounted) stop = init();
    };
    // some Safari versions have no requestIdleCallback
    const hasIdle = typeof window.requestIdleCallback === "function";
    const handle = hasIdle
      ? window.requestIdleCallback(start, { timeout: 1200 })
      : window.setTimeout(start, 250);
    return () => {
      unmounted = true;
      if (hasIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
