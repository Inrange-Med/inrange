/* One package, four prepaid lengths, from the client's programme sheet (Nov 2026). No prices on the
   public site (client call, 12 Nov 2026: no weight-loss site shows its fees, and a visible price gives
   the first step and the plan away before the doctor has seen anyone). Plans are priced after the
   doctor's review, itemised before anything is paid; the figures live with the backend and the checkout.
   Medicine is never part of a plan: it is billed separately, only if a doctor prescribes it.
   bloodTests: rounds of home blood tests the plan includes. */
export const PLANS = [
  { months: 3, weeks: 13, bloodTests: 0 },
  { months: 6, weeks: 26, bloodTests: 1 },
  { months: 9, weeks: 39, bloodTests: 2 },
  { months: 12, weeks: 52, bloodTests: 3 },
] as const;
export type Plan = (typeof PLANS)[number];

export const planOf = (months: number) => PLANS.find((p) => p.months === months) ?? PLANS[2];

/** How each line of a plan is charged, in words. The first step's fee is shown in the booking, before payment. */
export type Charge = "Paid once" | "Included" | "Not included" | "Billed separately";

const FIRST: [string, Charge] = ["Your first step: blood tests at home and your doctor consultation", "Paid once"];
const CARE: [string, Charge][] = [
  ["A doctor consultation every month", "Included"],
  ["A call with your coach every week", "Included"],
  ["A call with your fitness coach every week", "Included"],
];
const REST: [string, Charge][] = [
  ["Your nutrition and strength plan", "Included"],
  ["The inrange app: weekly check-ins and WhatsApp support", "Included"],
  ["Medicine, only if prescribed: sealed, from our licensed pharmacy", "Billed separately"],
];
const ROUNDS = ["", "one round", "two rounds", "three rounds"];

/** What one plan holds, in order, with how each line is charged. Read by the plans section. */
export const includedIn = (p: Plan): [string, Charge][] => [
  FIRST,
  ...CARE,
  p.bloodTests > 0 ? [`Blood tests at home, ${ROUNDS[p.bloodTests]} in the plan`, "Included"] : ["Blood tests at home, from the 6-month plan", "Not included"],
  ...REST,
];

/** What the package holds across its lengths, for pages that show no single plan (the programme pages). */
export const INCLUDED: [string, Charge][] = [FIRST, ...CARE, ["Blood tests at home: one round in 6 months, two in 9, three in 12", "Included"], ...REST];
