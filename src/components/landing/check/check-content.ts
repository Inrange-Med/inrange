/*
  The free check's words (/assessment). Rules (CLAUDE.md, compliance): process and published facts
  only, every figure sourced, no outcome for the visitor, no drug or treatment words, no testimonials,
  no named or quoted doctor. Kept short (16 Nov 2026: copy cut for conversion): only the two
  sources the BMI screen cites, Misra 2025 and ADA 2026. CONFIRM the exact lines with counsel.
*/

export type Source = { id: string; label: string; href?: string };

export const SOURCES: Record<string, Source> = {
  misra: {
    id: "misra",
    label: "Misra A, et al. Revised definition of obesity in Asian Indians living in India. Diabetes Metab Syndr 2025;19:102989.",
    href: "https://doi.org/10.1016/j.dsx.2024.102989",
  },
  ada: {
    id: "ada",
    label: "American Diabetes Association. Standards of Care in Diabetes 2026, section 8. Diabetes Care 2026;49(Suppl 1):S166.",
  },
};
