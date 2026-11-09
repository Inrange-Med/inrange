/** The InRange wordmark (geometry in wordmarkPaths). Black or white only: it draws in currentColor. */

import {
  LOGO_ASPECT,
  LOGO_BASELINE,
  LOGO_DOT,
  LOGO_FONT_SIZE,
  LOGO_STEM,
  LOGO_TEXT,
  LOGO_TEXT_LENGTH,
  LOGO_TEXT_X,
  LOGO_VIEWBOX,
} from "./wordmarkPaths";

export default function Wordmark({
  className,
  height = 30,
  dotClassName,
}: {
  className?: string;
  height?: number;
  /** the landing page's rising-dot sting */
  dotClassName?: string;
}) {
  return (
    <svg
      className={className}
      height={height}
      width={height * LOGO_ASPECT}
      viewBox={LOGO_VIEWBOX}
      role="img"
      aria-label="InRange"
      style={{ display: "block", overflow: "visible" }}
    >
      <rect
        x={LOGO_STEM.x}
        y={LOGO_STEM.top}
        width={LOGO_STEM.width}
        height={LOGO_BASELINE - LOGO_STEM.top}
        fill="currentColor"
      />
      <circle
        cx={LOGO_DOT.cx}
        cy={LOGO_DOT.cy}
        r={LOGO_DOT.r}
        fill="currentColor"
        className={dotClassName}
      />
      <text
        x={LOGO_TEXT_X}
        y={LOGO_BASELINE}
        fontSize={LOGO_FONT_SIZE}
        textLength={LOGO_TEXT_LENGTH}
        lengthAdjust="spacingAndGlyphs"
        fill="currentColor"
        aria-hidden="true"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 500,
          letterSpacing: "-0.02em",
        }}
      >
        {LOGO_TEXT}
      </text>
    </svg>
  );
}
