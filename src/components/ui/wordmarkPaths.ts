// The InRange wordmark's geometry, shared by the app (Wordmark.tsx) and the landing page (landing/ui.tsx).
// Lowercase "inrange" in the brand face (Jost 500): the i is drawn (a stem and a raised dot) so the dot
// can rise on its own; the rest is live text fitted to an exact width. Units are the viewBox's.
// ponytail: live text until an outlined InRange logo is supplied; swap these for paths then.
export const LOGO_VIEWBOX = "0 0 3800 1384";
export const LOGO_ASPECT = 3800 / 1384;
export const LOGO_TEXT = "nrange";
export const LOGO_TEXT_X = 230;
export const LOGO_BASELINE = 1240;
export const LOGO_FONT_SIZE = 1150;
export const LOGO_TEXT_LENGTH = 3540;
/** the i's stem: x, top, width (it ends on the baseline) */
export const LOGO_STEM = { x: 70, top: 700, width: 110 };
/** the raised dot; seated, it would sit 460 units lower (the sting animation's travel) */
export const LOGO_DOT = { cx: 125, cy: 145, r: 82 };
