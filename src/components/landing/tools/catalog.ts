/*
  Every free tool and guide, in one list. The hubs, "keep reading" links, footer and sitemap all
  read from here, so a new page is added once.
*/

/*
  The address every absolute link is built on: share previews, canonical links, the sitemap and
  structured data. NEXT_PUBLIC_SITE_URL overrides it (a preview deployment, say).
*/
export const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://inrangemed.com").replace(/\/$/, "");
export const UPDATED = "2026-09-24";
export const UPDATED_LABEL = "24 September 2026";

export type Resource = {
  href: string;
  name: string;
  /** the question a person actually types or asks */
  asks: string;
  /** what the page gives them, in one line */
  what: string;
};

export const TOOLS: Resource[] = [
  {
    href: "/tools/weight-loss-calculator",
    name: "Weight loss calculator",
    asks: "How much weight would make a difference for me?",
    what: "What a large trial reports for your weight: about 20% over about 16 months.",
  },
  {
    href: "/tools/diabetes-risk-score",
    name: "Diabetes risk score",
    asks: "Am I at risk of type 2 diabetes?",
    what: "The Indian Diabetes Risk Score: four questions, scored the way Indian doctors screen.",
  },
  {
    href: "/tools/bmi-calculator",
    name: "BMI calculator for Indians",
    asks: "What is a healthy BMI for Indians?",
    what: "Your BMI and your band under the 2025 Indian definition of obesity.",
  },
  {
    href: "/tools/ideal-weight-calculator",
    name: "Ideal weight calculator",
    asks: "What should I weigh for my height?",
    what: "The healthy weight range for your height, in kilograms or pounds.",
  },
  {
    href: "/tools/waist-size-calculator",
    name: "Waist size calculator",
    asks: "Is my waist, or my belly fat, a risk?",
    what: "Your waist against the Indian thresholds and half your height, with how to measure.",
  },
  {
    href: "/tools/protein-calculator",
    name: "Protein calculator for vegetarians",
    asks: "How much protein do I need, and from which foods?",
    what: "Your daily protein target, and a vegetarian day of food that reaches it.",
  },
  {
    href: "/tools/blood-sugar-checker",
    name: "Blood sugar level checker",
    asks: "Is my sugar reading normal, fasting or after food?",
    what: "Fasting, after food or random, with or without diabetes, in mg/dL.",
  },
  {
    href: "/tools/hba1c-calculator",
    name: "HbA1c calculator",
    asks: "What does my HbA1c mean as an average sugar level?",
    what: "HbA1c turned into average blood sugar, with the range it falls in.",
  },
];

export const GUIDES: Resource[] = [
  {
    href: "/guides/blood-sugar-level-chart",
    name: "Blood sugar level chart",
    asks: "What is a normal sugar level, fasting and after food?",
    what: "Normal, prediabetes and diabetes ranges, targets with diabetes, and what changes with age.",
  },
  {
    href: "/guides/hba1c-chart",
    name: "HbA1c chart",
    asks: "What does my HbA1c number mean?",
    what: "Every HbA1c level from 5 to 12%, what it means, and what can make it read wrong.",
  },
  {
    href: "/guides/prediabetes",
    name: "Prediabetes",
    asks: "What is prediabetes, and what can I do about it?",
    what: "The numbers, the signs of insulin resistance, who should test and what helps.",
  },
  {
    href: "/guides/fatty-liver-grades",
    name: "Fatty liver grades",
    asks: "What do grade 1, 2 and 3 on my ultrasound mean?",
    what: "What each grade means, why scarring matters more than the grade, and the next tests.",
  },
  {
    href: "/guides/navratri-fasting-with-diabetes",
    name: "Navratri fasting with diabetes",
    asks: "Can I keep the Navratri fast with diabetes?",
    what: "Who should not fast, when to break the fast, and vrat food swaps that keep sugar steadier.",
  },
];

export const ALL = [...TOOLS, ...GUIDES];
export const find = (href: string) => ALL.find((r) => r.href === href);
