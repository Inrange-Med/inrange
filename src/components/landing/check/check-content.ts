/*
  The free check's words (/assessment). Rules (CLAUDE.md, compliance): process and published facts
  only, every figure sourced, no outcome for the visitor, no drug or treatment words, no testimonials,
  no named or quoted doctor. "What doctors say" quotes medical bodies, never a person.
  Research, 14 Nov 2026: WHO obesity fact sheet (2024), Misra 2025 (revised Indian definition),
  ADA Standards of Care 2026 section 8, DPP (Knowler 2002), INASL 2023 and AASLD 2023 on fatty liver,
  the 2023 international PCOS guideline (Teede). CONFIRM the exact lines with counsel before launch.
*/

export type Source = { id: string; label: string; href?: string };

export const SOURCES: Record<string, Source> = {
  misra: {
    id: "misra",
    label: "Misra A, et al. Revised definition of obesity in Asian Indians living in India. Diabetes Metab Syndr 2025;19:102989.",
    href: "https://doi.org/10.1016/j.dsx.2024.102989",
  },
  who: {
    id: "who",
    label: "World Health Organization. Obesity and overweight, fact sheet, 2024.",
    href: "https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight",
  },
  ada: {
    id: "ada",
    label: "American Diabetes Association. Standards of Care in Diabetes 2026, section 8. Diabetes Care 2026;49(Suppl 1):S166.",
  },
  dpp: {
    id: "dpp",
    label: "Knowler WC, et al. Diabetes Prevention Program Research Group. N Engl J Med 2002;346:393.",
  },
  inasl: {
    id: "inasl",
    label: "Indian National Association for the Study of the Liver (INASL). Guidance on MASLD. J Clin Exp Hepatol 2023;13(2):273-302.",
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10025685/",
  },
  pcos: {
    id: "pcos",
    label: "Teede HJ, et al. Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome. J Clin Endocrinol Metab 2023.",
  },
};

/** One line per condition the visitor ticked, said as what the doctor will do. */
export const CONDITION_NOTES: Record<string, { text: string; source?: string }> = {
  T2D: { text: "Your doctor reads your sugar markers and every medicine you already take before changing anything." },
  PREDIABETES: {
    text: "In a large trial, people with prediabetes who aimed to lose 7% of their weight and moved more had 58% fewer new cases of diabetes over about three years than a group given standard advice.",
    source: "dpp",
  },
  BP: { text: "Blood pressure often rises with weight. Your doctor checks it and your heart markers before planning anything." },
  PCOS: {
    text: "PCOS often comes with insulin resistance, at any weight, so your doctor reads your sugar markers too.",
    source: "pcos",
  },
  THYROID: { text: "Your doctor checks how your thyroid is being treated, since a slow thyroid can add weight." },
  FATTY_LIVER: {
    text: "Guidelines name steady weight loss and more activity as the first treatment for fatty liver. Your doctor reads your liver markers.",
    source: "inasl",
  },
  LIPIDS: { text: "Your doctor reads your heart markers alongside your weight and blood sugar." },
  SLEEP_APNOEA: { text: "Tell your doctor how you sleep and whether you use a machine at night. It changes how your plan starts." },
  HEART: { text: "Bring your heart specialist's latest notes. Your doctor reads them before planning anything." },
  KIDNEY: { text: "Bring your kidney specialist's latest notes. Your doctor reads them before planning anything." },
  OTHER: { text: "Your doctor asks about it on the call, so it shapes your plan from the start." },
};

/** One line about what the visitor has tried, when it changes what the doctor asks. */
export const EXPERIENCE_NOTES: Record<string, string> = {
  DOCTOR_MEDS: "You have taken medicine for weight before. Have the name and how long you took it ready for your doctor.",
  SURGERY: "You have had weight-loss surgery. Your doctor asks when and what kind, and plans around it.",
  FIRST_TIME: "Starting with your blood tests means your plan starts from your own numbers.",
};

/** What medical bodies say about obesity, with the source. `verbatim` lines are quoted as written and
    shown in quotation marks; the others are our summary and never look like a quote. */
export const DOCTORS_SAY = [
  {
    text: "Obesity is a chronic complex disease defined by excessive fat deposits that can impair health.",
    by: "World Health Organization",
    source: "who",
    verbatim: true,
  },
  {
    text: "For Asian Indians, a BMI over 23 now counts as obesity, because health risks begin at a lower weight.",
    by: "The 2025 Indian definition of obesity, summarised",
    source: "misra",
    verbatim: false,
  },
] as const;
