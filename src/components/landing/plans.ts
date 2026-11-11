/* One package, four prepaid lengths (strategy deck), shared by the website and the patient app so
   the two can never quote different plans. DUMMY prices, added at the client's request (4 Oct 2026)
   and labelled indicative wherever they show. CONFIRM real prices with inrange and counsel before
   launch. Medicine is never in these figures: it is billed separately, only if a doctor prescribes it. */
export const PLANS = [
  { months: 1, weeks: 4, price: 4999 },
  { months: 4, weeks: 17, price: 17999 },
  { months: 6, weeks: 26, price: 24999 },
  { months: 12, weeks: 52, price: 44999 },
] as const;
export type Plan = (typeof PLANS)[number];

/** The assessment (counsellor screening, blood tests if needed, the doctor's first consultation). Dummy. */
export const ASSESSMENT_PRICE = 1999;

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const planOf = (months: number) => PLANS.find((p) => p.months === months) ?? PLANS[2];

/** What the one package holds, in order, with how each line is charged. Read by the pricing section, /pricing and the programme pages. */
export const INCLUDED: [string, string][] = [
  ["Your assessment, paid once: counsellor, blood tests if needed, doctor", inr(ASSESSMENT_PRICE)],
  ["A one-minute check-in every week", "Included"],
  ["A doctor review every month", "Included"],
  ["Blood tests at home", "Included"],
  ["Your nutrition and strength plan", "Included"],
  ["The inrange app, with WhatsApp support", "Included"],
  ["Medicine, only if prescribed: sealed, from our licensed pharmacy", "Billed separately"],
];

