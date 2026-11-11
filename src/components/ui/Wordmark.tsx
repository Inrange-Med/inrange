/**
 * The inrange wordmark (brand guidelines v1.1): outlined from Jost Medium, with the drawn dot and the
 * plus (geometry in wordmarkPaths). Ink or paper only: it draws in currentColor, and the plus is never red.
 */

import {
  LOGO_BODY_PATH,
  LOGO_DOT_PATH,
  LOGO_H,
  LOGO_PLUS_PATH,
  LOGO_VIEWBOX,
  LOGO_W,
} from "./wordmarkPaths";

export default function Wordmark({
  className,
  height = 30,
  dotClassName,
}: {
  className?: string;
  height?: number;
  /** a class on the dot alone, for a rising-dot animation */
  dotClassName?: string;
}) {
  return (
    <svg
      className={className}
      height={height}
      width={(height * LOGO_W) / LOGO_H}
      viewBox={LOGO_VIEWBOX}
      role="img"
      aria-label="inrange"
      style={{ display: "block", overflow: "visible" }}
    >
      <path d={LOGO_BODY_PATH} fill="currentColor" />
      <path d={LOGO_DOT_PATH} fill="currentColor" className={dotClassName} />
      <path d={LOGO_PLUS_PATH} fill="currentColor" />
    </svg>
  );
}
