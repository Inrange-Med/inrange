import type { Metadata } from "next";
import { notFound } from "next/navigation";
import IdealWeight from "@/components/landing/tools/IdealWeight";
import ToolPage from "@/components/landing/tools/ToolPage";
import {
  HEIGHT_INCHES,
  healthyRange,
  heightParts,
  heightShort,
  heightSlug,
  heightWords,
  inchesFromSlug,
} from "@/components/landing/tools/data";
import s from "@/components/landing/tools/ToolPage.module.css";

/*
  One page per height, for the way people actually search ("ideal weight for 5 feet 4 inches female").
  Every figure on the page is worked out from the same formula as the calculator, so the pages can
  never disagree with the tool.
*/

export const dynamicParams = false;

export function generateStaticParams() {
  return HEIGHT_INCHES.map((i) => ({ height: heightSlug(i) }));
}

function facts(inches: number) {
  const cm = inches * 2.54;
  return {
    cm: Math.round(cm),
    kg: healthyRange(cm, "kg"),
    lb: healthyRange(cm, "lb"),
    words: heightWords(inches),
    short: heightShort(inches),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ height: string }>;
}): Promise<Metadata> {
  const { height } = await params;
  const inches = inchesFromSlug(height);
  if (inches === undefined) return {};
  const f = facts(inches);
  const title = `Ideal weight for ${f.words} (${f.cm} cm)`;
  const description = `A healthy weight for ${f.words} (${f.cm} cm) is ${f.kg.lo} to ${f.kg.hi} kg (${f.lb.lo} to ${f.lb.hi} lb) by the 2025 Indian definition, for women and men. With nearby heights and a waist guide.`;
  return {
    title: `${title}: healthy range for Indians | inrange`,
    description,
    alternates: { canonical: `/tools/ideal-weight/${height}` },
    openGraph: {
      title,
      description,
      url: `/tools/ideal-weight/${height}`,
      locale: "en_IN",
      type: "website",
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ height: string }>;
}) {
  const { height } = await params;
  const inches = inchesFromSlug(height);
  if (inches === undefined) notFound();
  const f = facts(inches);
  const { ft, inch } = heightParts(inches);
  const around = HEIGHT_INCHES.filter((i) => Math.abs(i - inches) <= 3);
  const half = inches / 2;

  return (
    <ToolPage
      slug={`ideal-weight/${height}`}
      name={`Ideal weight for ${f.words}`}
      description={`A healthy weight for ${f.words} (${f.cm} cm) is ${f.kg.lo} to ${f.kg.hi} kg by the 2025 Indian definition.`}
      title={["Ideal weight", `for ${f.short}.`]}
      tool={<IdealWeight initialCm={inches * 2.54} />}
      related={[
        "/tools/ideal-weight-calculator",
        "/tools/bmi-calculator",
        "/tools/waist-size-calculator",
        "/tools/weight-loss-calculator",
      ]}
      answer={
        <>
          For a height of {f.words} ({f.cm} cm), a healthy weight for Indian
          adults is{" "}
          <strong>
            {f.kg.lo} to {f.kg.hi} kg
          </strong>{" "}
          ({f.lb.lo} to {f.lb.hi} lb), a BMI of 18.5 to 23 under the 2025 Indian
          definition. The same range applies to women and men.
        </>
      }
      sections={[
        {
          q: `Healthy weight for ${f.short} and nearby heights`,
          body: (
            <div className={s.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Height</th>
                    <th scope="col">Healthy weight, kg</th>
                    <th scope="col">In pounds</th>
                  </tr>
                </thead>
                <tbody>
                  {around.map((i) => {
                    const kg = healthyRange(i * 2.54, "kg");
                    const lb = healthyRange(i * 2.54, "lb");
                    const label = `${heightShort(i)} (${Math.round(i * 2.54)} cm)`;
                    return (
                      <tr key={i}>
                        <th scope="row">
                          {i === inches ? (
                            <strong>{label}</strong>
                          ) : (
                            <a href={`/tools/ideal-weight/${heightSlug(i)}`}>
                              {label}
                            </a>
                          )}
                        </th>
                        <td>
                          {kg.lo} to {kg.hi}
                        </td>
                        <td>
                          {lb.lo} to {lb.hi}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ),
        },
        {
          q: "What does the global chart say?",
          body: (
            <p>
              The global (WHO) chart would allow up to {f.kg.who} kg at{" "}
              {f.short}, because it only starts overweight at a BMI of 25. The
              2025 Indian definition sets the line at 23, because risk of type 2
              diabetes and heart disease rises earlier in Indians at the same
              weight.
            </p>
          ),
        },
        {
          q: `A healthy waist at ${f.short}`,
          body: (
            <p>
              A simple rule is to keep your waist under half your height: under{" "}
              {Number.isInteger(half) ? half : half.toFixed(1)} inches (
              {Math.round(f.cm / 2)} cm) at {f.short}. The Indian thresholds are
              31.5 inches (80 cm) for women and 35.4 inches (90 cm) for men. The{" "}
              <a href="/tools/waist-size-calculator">waist size calculator</a>{" "}
              shows how to measure.
            </p>
          ),
        },
      ]}
      faq={[
        {
          q: `What is the ideal weight for a ${f.words} female?`,
          a: `By the 2025 Indian definition, a healthy weight for a woman of ${f.words} (${f.cm} cm) is ${f.kg.lo} to ${f.kg.hi} kg, or ${f.lb.lo} to ${f.lb.hi} lb. The range is the same for men.`,
        },
        {
          q: `What is the ideal weight for a ${f.words} male?`,
          a: `By the 2025 Indian definition, a healthy weight for a man of ${f.words} (${f.cm} cm) is ${f.kg.lo} to ${f.kg.hi} kg, or ${f.lb.lo} to ${f.lb.hi} lb. The range is the same for women.`,
        },
        {
          q: `${ft} feet ${inch ? `${inch} inch ` : ""}height ke liye weight kitna hona chahiye?`,
          a: `${ft} feet ${inch ? `${inch} inch ` : ""}(${f.cm} cm) ke liye healthy weight lagbhag ${f.kg.lo} se ${f.kg.hi} kg hai, yaani BMI 18.5 se 23. Yeh range mahilaon aur purushon dono ke liye same hai.`,
        },
      ]}
      sources={[
        {
          label:
            "Misra A, et al. Revised definition of obesity in Asian Indians living in India. Diabetes Metab Syndr. 2025;19(1):102989.",
          href: "https://pubmed.ncbi.nlm.nih.gov/39814628/",
        },
        {
          label:
            "WHO Expert Consultation. Appropriate body-mass index for Asian populations and its implications for policy and intervention strategies. Lancet. 2004;363:157-163.",
        },
      ]}
    />
  );
}
