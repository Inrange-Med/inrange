/*
  The free check's words (/assessment). Rules (CLAUDE.md, compliance): process and published facts
  only, every figure sourced, no outcome for the visitor, no drug or treatment words, no testimonials,
  no named or quoted doctor. Kept short (16 Nov 2026: copy cut for conversion): only the
  sources the BMI screen cites, Misra 2025, WHO 2000 (the global chart) and ADA 2026. CONFIRM the exact lines with counsel.
*/

export type Source = { id: string; short: string; label: string; href?: string };

export const SOURCES: Record<string, Source> = {
  misra: {
    id: "misra",
    short: "Misra et al., 2025",
    label: "Misra A, et al. Revised definition of obesity in Asian Indians living in India. Diabetes Metab Syndr 2025;19:102989.",
    href: "https://doi.org/10.1016/j.dsx.2024.102989",
  },
  who: {
    id: "who",
    short: "WHO, 2000",
    label: "World Health Organization. Obesity: preventing and managing the global epidemic. WHO Technical Report Series 894, 2000.",
    href: "https://iris.who.int/handle/10665/42330",
  },
  ada: {
    id: "ada",
    short: "ADA Standards of Care, 2026",
    label: "American Diabetes Association. Standards of Care in Diabetes 2026, section 8. Diabetes Care 2026;49(Suppl 1):S166.",
  },
};
