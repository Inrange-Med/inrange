import type { Metadata } from "next";
import IdealWeight from "@/components/landing/tools/IdealWeight";
import ToolPage from "@/components/landing/tools/ToolPage";
import {
  HEIGHT_INCHES,
  healthyRange,
  heightShort,
  heightSlug,
} from "@/components/landing/tools/data";
import s from "@/components/landing/tools/ToolPage.module.css";

const TITLE = "Ideal weight calculator";
const DESC =
  "Find the healthy weight range for your height in kg or pounds, by the 2025 Indian definition, with a chart for every height from 4 ft 8 in to 6 ft 4 in. Free and private.";

export const metadata: Metadata = {
  title: "Ideal weight calculator for Indians, by height | inrange",
  description: DESC,
  alternates: { canonical: "/tools/ideal-weight-calculator" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/tools/ideal-weight-calculator",
    locale: "en_IN",
    type: "website",
  },
};

export default function Page() {
  return (
    <ToolPage
      slug="ideal-weight-calculator"
      name={TITLE}
      description={DESC}
      title={["Ideal weight", "for your height."]}
      tool={<IdealWeight />}
      related={[
        "/tools/bmi-calculator",
        "/tools/waist-size-calculator",
        "/tools/weight-loss-calculator",
        "/tools/protein-calculator",
      ]}
      answer={
        <>
          For Indian adults, a healthy weight is the range that gives a{" "}
          <strong>BMI of 18.5 to 23</strong>, the revised 2025 Indian
          definition. For a height of 5 ft 3 in (160 cm) that is{" "}
          <strong>48 to 58 kg</strong>, and for 5 ft 8 in (173 cm) it is 56 to
          68 kg. The range is the same for women and men.
        </>
      }
      sections={[
        {
          q: "Ideal weight chart for Indian adults",
          body: (
            <>
              <div className={s.tableScroll}>
                <table>
                  <caption>
                    Healthy weight by height for Indian adults, BMI 18.5 to 23.
                    Source: Misra et al., 2025.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Height</th>
                      <th scope="col">Healthy weight, kg</th>
                      <th scope="col">In pounds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HEIGHT_INCHES.map((inches) => {
                      const kg = healthyRange(inches * 2.54, "kg");
                      const lb = healthyRange(inches * 2.54, "lb");
                      return (
                        <tr key={inches}>
                          <th scope="row">
                            <a
                              href={`/tools/ideal-weight/${heightSlug(inches)}`}
                            >
                              {heightShort(inches)} ({Math.round(inches * 2.54)}{" "}
                              cm)
                            </a>
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
              <p>
                Each height links to its own page, with nearby heights and a
                waist guide for that height.
              </p>
            </>
          ),
        },
        {
          q: "Is the ideal weight different for men and women?",
          body: (
            <p>
              The healthy range is the same, because BMI is the same formula for
              everyone. What differs is where the body stores fat, which is why
              the waist thresholds differ: 80 cm (31.5 in) for women and 90 cm
              (35.4 in) for men.
            </p>
          ),
        },
        {
          q: "Why is the Indian range lower than the global one?",
          body: (
            <p>
              At the same BMI, Indians tend to carry more body fat, and more of
              it around the organs, than people of European descent. Risk of
              type 2 diabetes and heart disease rises earlier, so the 2025
              Indian definition treats a BMI over 23 as obesity, where the
              global chart waits until 25 to call it overweight.
            </p>
          ),
        },
        {
          q: "Is there one ideal weight?",
          body: (
            <p>
              No. Any weight in the range can be healthy, and muscle, frame, age
              and health all shift where you sit best in it. The middle of the
              range is a reasonable reference, and your doctor may suggest a
              different goal.
            </p>
          ),
        },
      ]}
      faq={[
        {
          q: "What is the ideal weight for a 5 feet 3 inch woman?",
          a: "By the 2025 Indian definition, a healthy weight for 5 feet 3 inches (160 cm) is 48 to 58 kg, a BMI of 18.5 to 23. The same range applies to men.",
        },
        {
          q: "What is the ideal weight for a 5 feet 8 inch man?",
          a: "By the 2025 Indian definition, a healthy weight for 5 feet 8 inches (173 cm) is 56 to 68 kg, a BMI of 18.5 to 23. The same range applies to women.",
        },
        {
          q: "Meri height ke hisaab se weight kitna hona chahiye?",
          a: "Healthy weight woh range hai jisme BMI 18.5 se 23 ke beech ho. Jaise 5 feet 3 inch ke liye lagbhag 48 se 58 kg, aur 5 feet 8 inch ke liye 56 se 68 kg.",
        },
        {
          q: "Is BMI accurate for muscular people?",
          a: "Not always. Muscle weighs more than fat, so a very muscular person can have a high BMI with little body fat. A waist measure helps tell the two apart.",
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
