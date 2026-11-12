"use client";

import { useEffect, useRef } from "react";

/**
 * Isoline field rendered with a single WebGL2 fragment shader.
 * A few slow gaussian "masses" plus low-amplitude noise produce contour
 * lines that read like a body-composition scan. A horizontal scan band
 * travels down the field and lifts the lines it crosses into the signal
 * colour. Pauses off-screen, renders one still frame under reduced motion.
 */

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

const VERT = `#version 300 es
in vec2 p;
void main(){ gl_Position = vec4(p,0.,1.); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes;
uniform float uT;
uniform vec2 uPtr;
uniform float uPtrAmt;
uniform vec3 uLine;
uniform vec3 uSig;
uniform float uLineA;
uniform float uSigA;
uniform float uDensity;
uniform float uScan;
uniform float uSeed;
uniform float uDpr;

float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)) + uSeed) * 43758.5453); }
float n(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.-2.*f);
  return mix(mix(h(i), h(i+vec2(1,0)), u.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float a = .5, s = 0.;
  for(int i=0;i<4;i++){ s += a*n(p); p = p*2.03 + 7.1; a *= .5; }
  return s;
}
float mass(vec2 p, vec2 c, float r){ vec2 d = p-c; return exp(-dot(d,d)/(r*r)); }

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = vec2((uv.x-.5)*asp, uv.y-.5);
  float t = uT * .045;

  float f = 0.;
  f += 1.05*mass(p, vec2(-.18*asp + .06*sin(t*1.3), .10 + .05*cos(t)), .42);
  f += .80*mass(p, vec2(.22*asp + .05*cos(t*.9), -.16 + .06*sin(t*1.1)), .36);
  f += .55*mass(p, vec2(.04*asp + .08*sin(t*.7+1.), .30 + .04*sin(t*1.7)), .24);
  f += .45*mass(p, vec2(-.30*asp, -.34 + .05*cos(t*1.2)), .30);
  vec2 pp = vec2((uPtr.x-.5)*asp, uPtr.y-.5);
  f += .38*uPtrAmt*mass(p, pp, .20);
  f += .34*fbm(p*2.2 + vec2(t*.6, -t*.4));

  float k = f * uDensity;
  float w = fwidth(k);
  // crisp isolines about one device pixel wide
  float g = abs(fract(k - .5) - .5) / max(w, 1e-4);
  float line = 1. - clamp(g - .15*uDpr, 0., 1.);

  // every fifth isoline is an index contour, slightly stronger
  float idx = abs(fract(k/5. - .5) - .5) / max(w/5., 1e-4);
  float index = 1. - clamp(idx - .35*uDpr, 0., 1.);

  float scanY = 1.15 - fract(uT * .055) * 1.5;
  float band = uScan * exp(-pow((uv.y - scanY) * 9., 2.));
  float edge = smoothstep(0., .18, uv.x) * smoothstep(1., .82, uv.x);

  float a = (line * uLineA + index * uLineA * .9);
  vec3 col = uLine;
  float sig = band * max(line, index) * uSigA * (.55 + .45*edge);
  col = mix(col, uSig, clamp(sig * 2.2, 0., 1.));
  a = max(a, sig);
  o = vec4(col * a, a);
}`;

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
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
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

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const coarse = window.matchMedia("(pointer: coarse)").matches;

      const sh = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
      };
      const prog = gl.createProgram()!;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const U = (n: string) => gl.getUniformLocation(prog, n);
      const uRes = U("uRes"), uT = U("uT"), uPtr = U("uPtr"), uPtrAmt = U("uPtrAmt"), uDpr = U("uDpr");
      // palette previews (src/app/palettes.css) can recolour the field through custom properties
      const css = getComputedStyle(canvas);
      const rgb = (n: string, d: number[]) => {
        const v = css.getPropertyValue(n).trim().split(/\s+/).map(Number);
        return v.length === 3 && v.every((x) => Number.isFinite(x)) ? v : d;
      };
      const lineA = Number(css.getPropertyValue("--field-line-a")) || lineAlpha;
      gl.uniform3fv(U("uLine"), rgb("--field-line", line));
      gl.uniform3fv(U("uSig"), rgb("--field-signal", signal));
      gl.uniform1f(U("uLineA"), lineA);
      gl.uniform1f(U("uSigA"), signalAlpha);
      gl.uniform1f(U("uDensity"), density);
      gl.uniform1f(U("uScan"), scan ? 1 : 0);
      gl.uniform1f(U("uSeed"), seed);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      let dpr = 1;
      const resize = () => {
        dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
        const r = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(r.width * dpr));
        canvas.height = Math.max(1, Math.round(r.height * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uDpr, 1);
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);

      // pointer eased toward target so the field follows with mass
      const ptr = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, a: 0, ta: 0 };
      const onMove = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        ptr.tx = (e.clientX - r.left) / r.width;
        ptr.ty = 1 - (e.clientY - r.top) / r.height;
        ptr.ta = ptr.tx > 0 && ptr.tx < 1 && ptr.ty > 0 && ptr.ty < 1 ? 1 : 0;
      };
      if (interactive && !coarse && !reduce) window.addEventListener("pointermove", onMove, { passive: true });

      let raf = 0;
      let visible = true;
      let last = performance.now();
      let time = 12 + seed * 7;
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000);
        // cap at ~30fps on touch devices to save battery
        if (coarse && now - last < 32) return;
        last = now;
        time += dt;
        ptr.x += (ptr.tx - ptr.x) * 0.06;
        ptr.y += (ptr.ty - ptr.y) * 0.06;
        ptr.a += (ptr.ta - ptr.a) * 0.04;
        gl.uniform1f(uT, time);
        gl.uniform2f(uPtr, ptr.x, ptr.y);
        gl.uniform1f(uPtrAmt, ptr.a);
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

      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        cancelAnimationFrame(raf);
        if (visible && !reduce) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      });
      if (reduce) drawStill();
      else io.observe(canvas);

      const onVis = () => {
        cancelAnimationFrame(raf);
        if (!document.hidden && visible && !reduce) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      };
      document.addEventListener("visibilitychange", onVis);
      // if the GPU drops the context, hide the canvas so the plate's own colour shows, never a blank box
      const onLost = (e: Event) => {
        e.preventDefault();
        cancelAnimationFrame(raf);
        canvas.style.visibility = "hidden";
      };
      canvas.addEventListener("webglcontextlost", onLost);

      canvas.dataset.ready = "1";

      return () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        window.removeEventListener("pointermove", onMove);
        document.removeEventListener("visibilitychange", onVis);
        canvas.removeEventListener("webglcontextlost", onLost);
        // Free GPU objects but keep the context: React may remount this same canvas.
        gl.deleteBuffer(buf);
        gl.deleteProgram(prog);
      };
    };

    let stop: (() => void) | undefined;
    let dead = false;
    const start = () => {
      if (!dead) stop = init();
    };
    // some Safari versions have no requestIdleCallback
    const hasIdle = typeof window.requestIdleCallback === "function";
    const handle = hasIdle ? window.requestIdleCallback(start, { timeout: 1200 }) : window.setTimeout(start, 250);
    return () => {
      dead = true;
      if (hasIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
