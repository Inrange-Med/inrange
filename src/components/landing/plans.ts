/* One package, four prepaid lengths, from the client's programme pricing (Nov 2026). `mrp` shows struck
   through and `price` (the floor, the lowest price offered) is the price. Labelled indicative wherever
   it shows until inrange and counsel confirm it. Medicine is never in these figures: it is billed
   separately, only if a doctor prescribes it, and its prices never appear on the public site.
   bloodTests: rounds of home blood tests the plan includes. */
export const PLANS = [
  { months: 3, weeks: 13, mrp: 20000, price: 16999, bloodTests: 0 },
  { months: 6, weeks: 26, mrp: 36000, price: 31999, bloodTests: 1 },
  { months: 9, weeks: 39, mrp: 48000, price: 41999, bloodTests: 2 },
  { months: 12, weeks: 52, mrp: 55000, price: 48999, bloodTests: 3 },
] as const;
export type Plan = (typeof PLANS)[number];

/** The first step, as the app sells it (its care packages, Nov 2026): home blood tests with the first doctor
    consultation, or the consultation alone for someone who uploads a report from the last three months.
    Keep in step with the app's packages. */
export const FIRST_STEP = { withTests: 1499, withReport: 999 } as const;

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const planOf = (months: number) => PLANS.find((p) => p.months === months) ?? PLANS[2];

const FIRST: [string, string] = [
  `Your first step, paid once: blood tests at home and your doctor consultation (${inr(FIRST_STEP.withReport)} with a recent report)`,
  inr(FIRST_STEP.withTests),
];
const CARE: [string, string][] = [
  ["A doctor consultation every month", "Included"],
  ["A call with your coach every week", "Included"],
  ["A call with your fitness coach every week", "Included"],
];
const REST: [string, string][] = [
  ["Your nutrition and strength plan", "Included"],
  ["The inrange app: weekly check-ins and WhatsApp support", "Included"],
  ["Medicine, only if prescribed: sealed, from our licensed pharmacy", "Billed separately"],
];
const ROUNDS = ["", "one round", "two rounds", "three rounds"];

/** What one plan holds, in order, with how each line is charged. Read by the pricing section. */
export const includedIn = (p: Plan): [string, string][] => [
  FIRST,
  ...CARE,
  p.bloodTests > 0 ? [`Blood tests at home, ${ROUNDS[p.bloodTests]} in the plan`, "Included"] : ["Blood tests at home, from the 6-month plan", "Not included"],
  ...REST,
];

/** What the package holds across its lengths, for pages that show no single plan (the programme pages). */
export const INCLUDED: [string, string][] = [FIRST, ...CARE, ["Blood tests at home: one round in 6 months, two in 9, three in 12", "Included"], ...REST];

