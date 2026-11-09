import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import AppWordmark from "@/components/ui/Wordmark";

/** The clinical assessment, built by the product team. Set NEXT_PUBLIC_ASSESSMENT_URL once it is live. */
export const ASSESSMENT_URL = process.env.NEXT_PUBLIC_ASSESSMENT_URL || "/assessment";

/** Heading whose phrases rise out of a mask, one after another. */
export function Mask({
  as: Tag = "h2",
  lines,
  className,
  delay = 0,
  id,
}: {
  as?: "h1" | "h2" | "h3" | "p";
  lines: ReactNode[];
  className?: string;
  delay?: number;
  id?: string;
}) {
  return (
    <Tag className={className} data-reveal="mask" id={id} style={{ "--d": `${delay}ms` } as CSSProperties}>
      {lines.map((l, i) => (
        <span className="ln" key={i} style={{ "--i": i } as CSSProperties}>
          <span>{l}</span>
        </span>
      ))}
    </Tag>
  );
}

export function Cta({
  href = ASSESSMENT_URL,
  children = "Start free check",
  variant,
  className = "",
}: {
  href?: string;
  children?: ReactNode;
  variant?: "mint";
  className?: string;
}) {
  return (
    <a href={href} className={`btn ${variant === "mint" ? "btn--mint" : ""} ${className}`}>
      <span>{children}</span>
      <span className="well" aria-hidden="true">
        <ArrowRight size={18} weight="regular" />
      </span>
    </a>
  );
}

/** The brand's small mark: the floating dot, on its own. */
export function Dot({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="5" fill="currentColor" />
    </svg>
  );
}

/**
 * The InRange wordmark (the app's Wordmark, one source). Black or white only (brand kit).
 * With `sting`, the dot starts seated on the stem like a normal i and rises into place, once.
 */
export function Wordmark({ className, height = 30, sting = false }: { className?: string; height?: number; sting?: boolean }) {
  return <AppWordmark className={className} height={height} dotClassName={sting ? "sting" : undefined} />;
}

/** Section tag: a short, plain name for what the section covers, on a tinted plate. */
export function Tag({ children, dark = false, delay = 0 }: { children: ReactNode; dark?: boolean; delay?: number }) {
  return (
    <p className={`tag${dark ? " tag--dark" : ""}`} data-reveal="rise" style={{ "--d": `${delay}ms` } as CSSProperties}>
      <svg width="9" height="11" viewBox="0 0 9 11" shapeRendering="crispEdges" aria-hidden="true">
        <path d="M1.5 1v9M4.5 1v4.5M7.5 1v6.5" stroke="currentColor" strokeWidth="1" fill="none" />
      </svg>
      {children}
    </p>
  );
}

type ArtKind = "ticks" | "converge" | "arcs";

/**
 * Line art that bleeds off a section edge: the brand's measuring language used as texture.
 * ticks: a scale's graduations. converge: many strands becoming one record. arcs: isolines from a corner.
 * The drawing opens once, in the direction it reads, when the section arrives.
 */
export function Art({ kind, className = "" }: { kind: ArtKind; className?: string }) {
  let vb = "0 0 240 120";
  let paths: string[] = [];
  if (kind === "ticks") {
    // a scale's graduations hanging from the section edge: long every sixth, medium every second
    vb = "0 0 240 48";
    paths = Array.from({ length: 24 }, (_, i) => `M${238 - i * 10} 0V${i % 6 === 0 ? 44 : i % 2 === 0 ? 26 : 14}`);
  } else if (kind === "converge") {
    vb = "0 0 480 62";
    const ys = [4, 13, 22, 31, 40, 49, 58];
    paths = ys.map((y) => `M0 ${y}H150C236 ${y} 262 31 342 31H480`);
  } else {
    vb = "0 0 240 240";
    // centred just outside the corner, so each line crosses both edges at an
    // angle, like isolines passing through, instead of dropping straight off the edge
    const cx = -34;
    const cy = 274;
    const radii = [66, 92, 120, 150, 182, 216, 252];
    const r2 = (n: number) => Math.round(n * 10) / 10;
    paths = radii.map((r) => {
      const d = Math.sqrt(r * r - 34 * 34);
      return `M0 ${r2(cy - d)}A${r} ${r} 0 0 1 ${r2(cx + d)} 240`;
    });
  }
  // the wrapper is observed; only the drawing inside it is clipped, so the reveal always fires
  return (
    <span className={`art art--${kind} ${className}`} data-reveal="draw" aria-hidden="true">
      <svg viewBox={vb} preserveAspectRatio={kind === "converge" ? "none" : "xMaxYMin meet"}>
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
    </span>
  );
}
