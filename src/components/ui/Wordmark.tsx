/**
 * The inrange wordmark (brand guidelines v1.1): outlined from Jost Medium, with the drawn dot and the
 * plus (geometry in wordmarkPaths). Ink or paper only: it draws in currentColor, and the plus is never red.
 * Keep it at least 120px wide (height 34); below that the guidelines ask for the dot icon instead.
 * With `sting`, the guidelines' animated logo plays once (keyframes in src/app/globals.css): the letters
 * fade in, the dot rises, the plus pops in.
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
  height = 34,
  dotClassName,
  sting = false,
}: {
  className?: string;
  height?: number;
  /** a class on the dot alone, for a rising-dot animation */
  dotClassName?: string;
  sting?: boolean;
}) {
  const dotClass =
    [sting ? "sting" : "", dotClassName ?? ""].filter(Boolean).join(" ") ||
    undefined;
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
      <path
        d={LOGO_BODY_PATH}
        fill="currentColor"
        className={sting ? "sting-word" : undefined}
      />
      <path d={LOGO_DOT_PATH} fill="currentColor" className={dotClass} />
      <path
        d={LOGO_PLUS_PATH}
        fill="currentColor"
        className={sting ? "sting-plus" : undefined}
      />
    </svg>
  );
}
