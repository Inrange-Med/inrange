import type { Metadata } from "next";
import BmiCalculator from "@/components/landing/tools/BmiCalculator";
import ToolPage from "@/components/landing/tools/ToolPage";
import s from "@/components/landing/tools/ToolPage.module.css";

const TITLE = "BMI calculator for Indians";
const DESC =
  "Work out your BMI from your weight and height, and see your band under the 2025 Indian definition of obesity. Built for Asian Indians. Free, private, no sign-up.";

export const metadata: Metadata = {
  title: `${TITLE} (2025 Indian definition) | inrange`,
  description: DESC,
  alternates: { canonical: "/tools/bmi-calculator" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/tools/bmi-calculator",
    locale: "en_IN",
    type: "website",
  },
};

export default function Page() {
  return (
    <ToolPage
      slug="bmi-calculator"
      name={TITLE}
      description={DESC}
      title={["BMI calculator,", "for Indian bodies."]}
      tool={<BmiCalculator />}
      answer={
        <>
          For Asian Indians, a healthy BMI is <strong>18.5 to 23</strong>, and a{" "}
          <strong>BMI over 23</strong> is obesity under the revised 2025 Indian
          definition. The global chart only starts at 25 for overweight and 30
          for obesity, so it can miss risk that begins earlier in Indians.
        </>
      }
      sections={[
        {
          q: "What is a normal BMI for Indians?",
          body: (
            <>
              <p>
                A BMI of 18.5 to 23 is healthy by the Indian definition. Here is
                how the two charts compare:
              </p>
              <div className={s.tableScroll}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">BMI</th>
                      <th scope="col">Indian definition, 2025</th>
                      <th scope="col">Global chart</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Below 18.5</th>
                      <td>Underweight</td>
                      <td>Underweight</td>
                    </tr>
                    <tr>
                      <th scope="row">18.5 to 23</th>
                      <td>Healthy</td>
                      <td>Healthy</td>
                    </tr>
                    <tr>
                      <th scope="row">Over 23 to 24.9</th>
                      <td>Obesity</td>
                      <td>Healthy</td>
                    </tr>
                    <tr>
                      <th scope="row">25 to 29.9</th>
                      <td>Obesity</td>
                      <td>Overweight</td>
                    </tr>
                    <tr>
                      <th scope="row">30 and over</th>
                      <td>Obesity</td>
                      <td>Obesity</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ),
        },
        {
          q: "Is BMI different for men and women?",
          body: (
            <p>
              No. BMI is weight in kilograms divided by height in metres
              squared, the same formula for everyone, so the Indian bands are
              the same for men and women.
            </p>
          ),
        },
        {
          q: "What are stage 1 and stage 2 obesity?",
          body: (
            <p>
              The 2025 Indian definition splits obesity into two stages.{" "}
              <strong>Stage 1</strong> is a BMI over 23 without effects on the
              body&rsquo;s organs or daily life. <strong>Stage 2</strong> adds
              effects on health, such as a related condition like diabetes, high
              blood pressure or fatty liver, or symptoms that limit daily
              activities. Only a doctor can assess stage 2.
            </p>
          ),
        },
      ]}
      faq={[
        {
          q: "Is a BMI of 24 normal for an Indian?",
          a: "No. Under the 2025 Indian definition a BMI over 23 is obesity, even though the global chart would still call 24 healthy.",
        },
        {
          q: "Is a BMI of 25 overweight or obese in India?",
          a: "By the 2025 Indian definition, 25 is obesity. The global chart calls it overweight.",
        },
      ]}
      sources={[
        {
          label:
            "Misra A, Vikram NK, Ghosh A, et al. Revised definition of obesity in Asian Indians living in India. Diabetes Metab Syndr. 2025;19(1):102989.",
          href: "https://pubmed.ncbi.nlm.nih.gov/39814628/",
        },
        {
          label:
            "World Health Organization. Body mass index cut-offs for adults.",
        },
      ]}
    />
  );
}
