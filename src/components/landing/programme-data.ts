/*
  The programmes, listed once: the homepage tiles, the waitlist and the footer read this.
  Copy rules (CLAUDE.md, compliance): what a doctor assesses and how care runs, never a promised result.
  No drug or treatment words anywhere here. PCOS copy never promises cycles, ovulation or fertility;
  sexual health copy never uses performance, stamina, pleasure or "better sex" language (DMR Act s.3).
*/

export type ProgrammeKey = "weight" | "diabetes" | "pcos" | "sexual";

export type Programme = {
  key: ProgrammeKey;
  /** the programme page, /programmes/<slug> */
  slug: string;
  name: string;
  /** a short name for tight indexes: the hero, the footer */
  short: string;
  line: string;
  /** what the doctor looks at, in a few plain words */
  covers: string;
  live: boolean;
  img: string;
  alt: string;
  /** object-position for the 4:5 crop */
  focus: string;
};

export const PROGRAMMES: Programme[] = [
  {
    key: "weight",
    slug: "weight-care",
    name: "Weight care",
    short: "Weight care",
    line: "For a BMI over 23 on the Indian scale, planned around your kitchen and your hours.",
    covers: "Weight, waist, blood pressure, fatty liver",
    live: true,
    img: "/img/prog-weight-v4-c.jpg",
    alt: "A man in his forties on an early morning walk through a leafy park in Gurugram",
    focus: "50% 58%",
  },
  {
    key: "diabetes",
    slug: "diabetes-care",
    name: "Diabetes care",
    short: "Diabetes care",
    line: "For type 2 diabetes and prediabetes, with HbA1c at home and a doctor review every\u00a0month.",
    covers: "HbA1c, sugar readings, kidney and lipid tests",
    live: true,
    img: "/img/prog-diabetes-v2-c.jpg",
    alt: "A woman in her fifties cooking at the stove in her Delhi kitchen",
    focus: "50% 30%",
  },
  {
    key: "pcos",
    slug: "pcos",
    name: "PCOS and hormonal health",
    short: "PCOS care",
    line: "Doctor-led care for PCOS and its metabolic side, with the tests that explain it.",
    covers: "Insulin resistance, weight, thyroid and hormone tests",
    live: false,
    img: "/img/prog-pcos-v2-c.jpg",
    alt: "A woman in her twenties with a cup of tea on a sunny window seat",
    focus: "50% 32%",
  },
  {
    key: "sexual",
    slug: "sexual-health",
    name: "Sexual health",
    short: "Sexual health",
    line: "Private consultations with a doctor about sexual health, for men and women.",
    covers: "A confidential history, tests if needed and a plan you agree",
    live: false,
    img: "/img/prog-intimacy-v2-c.jpg",
    alt: "A couple in their thirties laughing together on a sofa at home",
    focus: "50% 34%",
  },
];

export const programmeHref = (p: Programme) => `/programmes/${p.slug}`;

/** Where waitlist sign-ups go, once the product team has an endpoint. Until then the form drafts an email. */
export const WAITLIST_URL = process.env.NEXT_PUBLIC_WAITLIST_URL || "";
export const CONTACT_EMAIL = "care@inrangemed.com";
