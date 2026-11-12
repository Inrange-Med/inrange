import { PROGRAMMES, programmeHref } from "@/components/landing/programme-data";
import { GUIDES, SITE, TOOLS } from "@/components/landing/tools/catalog";
import { FIRST_STEP, inr } from "@/components/landing/plans";

/*
  A plain-text summary of the site for AI tools (the llms.txt proposal). Google says it doesn't use
  it; others may. It repeats only what the pages already say, built from the same catalogue, so it
  can never drift from the site or say something the pages don't.
*/

export const dynamic = "force-static";

export function GET() {
  const list = (items: typeof TOOLS) =>
    items.map((r) => `- [${r.name}](${SITE}${r.href}): ${r.what}`).join("\n");
  const body = `# inrange

> Doctor-led care for obesity and type 2 diabetes in India, by video. A free two-minute check, then blood tests (a report from the last three months, or a home collection), a review by the medical team and a 30-minute doctor consultation (${inr(FIRST_STEP.withTests)} with home tests, ${inr(FIRST_STEP.withReport)} with a recent report), a doctor review every month, blood tests at home, and an app with WhatsApp support. Medication only if a doctor judges it clinically appropriate; not everyone is prescribed medication.

inrange's free tools and guides use the thresholds set for Asian Indians: a BMI over 23 is obesity under the revised 2025 Indian definition, and waist thresholds are 80 cm for women and 90 cm for men. Every tool runs in the visitor's browser, needs no sign-up and saves nothing. Pages list their sources and last-updated date. inrange does not promise results; the homepage calculator shows published averages with their sources. It does not name medicines or use testimonials.

## Programmes
${PROGRAMMES.map((x) => `- [${x.name}](${SITE}${programmeHref(x)})${x.live ? "" : " (opening soon)"}: ${x.line}`).join("\n")}
- [Doctors](${SITE}/doctors): the registered doctors on the care team, how they work and what the first consultation covers.
- [Pricing](${SITE}/#pricing): a free eligibility check, the first step (tests and a doctor consultation), then one plan for 3, 6, 9 or 12 months, paid after the doctor's review; indicative prices; medicine, only if prescribed, billed separately.

## Free tools

${list(TOOLS)}

## Guides

${list(GUIDES)}

## About

- [Editorial standards](${SITE}/editorial-standards): sources, what we never do, privacy, medical review, updates and corrections.
- [Home](${SITE}/): a weight loss calculator (for a given weight and height, the range studies of doctor-led programmes report, about 20% of body weight over about 16 months (19.5 to 20.9%, the averages of the two study groups that lost the most in a large trial where medication was prescribed), with its sources; an estimate, not a prediction), how the programme works, what is measured, pricing structure and questions.
- Contact: care@inrangemed.com. Not for emergencies: in India, call 112.
`;
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
