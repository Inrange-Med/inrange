import type { Metadata } from "next";
import ToolPage from "@/components/landing/tools/ToolPage";
import s from "@/components/landing/tools/ToolPage.module.css";

const TITLE = "Prediabetes";
const DESC =
  "Prediabetes in India: the fasting sugar, HbA1c and after-food ranges, the signs of insulin resistance, who should test, and what lowers the chance of diabetes.";

export const metadata: Metadata = {
  title: "Prediabetes: the numbers, the signs and what helps | inrange",
  description: DESC,
  alternates: { canonical: "/guides/prediabetes" },
  openGraph: {
    title: "Prediabetes, explained plainly",
    description: DESC,
    url: "/guides/prediabetes",
    locale: "en_IN",
    type: "article",
  },
};

const EVERYTHING: [string, string, string][] = [
  [
    "/tools/diabetes-risk-score",
    "Diabetes risk score",
    "Should you get tested?",
  ],
  [
    "/guides/blood-sugar-level-chart",
    "Blood sugar level chart",
    "Read a fasting or after-food result",
  ],
  ["/guides/hba1c-chart", "HbA1c chart", "Read an HbA1c result"],
  [
    "/tools/waist-size-calculator",
    "Waist size calculator",
    "Measure the fat that drives insulin resistance",
  ],
  [
    "/tools/weight-loss-calculator",
    "Weight loss calculator",
    "Your first milestones in kilograms",
  ],
  [
    "/tools/protein-calculator",
    "Protein calculator",
    "Build meals that keep you full",
  ],
  [
    "/guides/fatty-liver-grades",
    "Fatty liver grades",
    "Often found alongside prediabetes",
  ],
];

export default function Page() {
  return (
    <ToolPage
      kind="guide"
      slug="prediabetes"
      name={TITLE}
      description={DESC}
      about="Prediabetes"
      title={["Prediabetes,", "explained plainly."]}
      related={[
        "/tools/diabetes-risk-score",
        "/guides/hba1c-chart",
        "/guides/blood-sugar-level-chart",
        "/tools/waist-size-calculator",
      ]}
      answer={
        <>
          Prediabetes means blood sugar is higher than normal but below the
          diabetes range: a <strong>fasting sugar of 100 to 125 mg/dL</strong>,
          an <strong>HbA1c of 5.7 to 6.4%</strong>, or 140 to 199 two hours
          after a glucose drink. About 15 in every 100 Indian adults have it,
          and it usually causes no symptoms.
        </>
      }
      points={[
        <>
          A blood test is the only way to know, because prediabetes rarely
          causes symptoms.
        </>,
        <>
          In the Indian Diabetes Prevention Programme, adults who changed their
          food and activity were{" "}
          <strong>less likely to develop diabetes</strong> over three years.
        </>,
        <>Guidelines suggest testing again at least once a year.</>,
      ]}
      sections={[
        {
          q: "The numbers that define prediabetes",
          body: (
            <div className={s.tableScroll}>
              <table>
                <caption>
                  Prediabetes ranges. Source: American Diabetes Association,
                  Standards of Care 2025, section 2.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Test</th>
                    <th scope="col">Normal</th>
                    <th scope="col">Prediabetes</th>
                    <th scope="col">Diabetes range</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Fasting sugar, mg/dL</th>
                    <td>Under 100</td>
                    <td>100 to 125</td>
                    <td>126 or more</td>
                  </tr>
                  <tr>
                    <th scope="row">HbA1c</th>
                    <td>Under 5.7%</td>
                    <td>5.7 to 6.4%</td>
                    <td>6.5% or more</td>
                  </tr>
                  <tr>
                    <th scope="row">2 hours after a glucose drink, mg/dL</th>
                    <td>Under 140</td>
                    <td>140 to 199</td>
                    <td>200 or more</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ),
        },
        {
          q: "What is insulin resistance?",
          body: (
            <>
              <p>
                Insulin is the hormone that moves sugar from the blood into the
                body&rsquo;s cells. In insulin resistance, the cells respond
                less, so the pancreas makes more to keep sugar normal. For years
                the numbers can look fine. When the pancreas can no longer keep
                up, sugar starts to rise, first into prediabetes.
              </p>
              <p>Signs that often travel with it:</p>
              <ul>
                <li>
                  Dark, velvety skin at the back of the neck or in the armpits
                </li>
                <li>
                  A waist above 80 cm (31.5 in) in women or 90 cm (35.4 in) in
                  men
                </li>
                <li>PCOS in women</li>
                <li>
                  High triglycerides, low HDL cholesterol or fatty liver on a
                  report
                </li>
              </ul>
            </>
          ),
        },
        {
          q: "Who should get tested?",
          body: (
            <>
              <p>
                A fasting sugar or HbA1c test makes sense if any of these apply:
              </p>
              <ul>
                <li>You are 35 or older</li>
                <li>
                  Your BMI is 23 or more, the line guidelines use for people of
                  Asian ancestry, with any other risk factor
                </li>
                <li>A parent, brother or sister has diabetes</li>
                <li>You had diabetes in pregnancy, or have PCOS</li>
                <li>You have high blood pressure, or are inactive most days</li>
                <li>
                  Your{" "}
                  <a href="/tools/diabetes-risk-score">
                    Indian Diabetes Risk Score
                  </a>{" "}
                  is 60 or more
                </li>
              </ul>
            </>
          ),
        },
        {
          q: "What lowers the chance of diabetes?",
          body: (
            <>
              <p>
                The strongest evidence is for lifestyle change. In India&rsquo;s
                own prevention study, adults with prediabetes who changed their
                diet and activity were less likely to develop diabetes than
                those who did not.
              </p>
              <ul>
                <li>
                  For people with extra weight, guidelines suggest losing at
                  least 7% of body weight. Our{" "}
                  <a href="/tools/weight-loss-calculator">
                    weight loss calculator
                  </a>{" "}
                  shows what about 20% of your weight comes to, in kilograms.
                </li>
                <li>
                  At least 150 minutes a week of brisk activity, such as
                  walking, spread across most days.
                </li>
                <li>
                  Fewer sugary drinks and refined carbohydrates, with more
                  pulses, vegetables and fibre.
                </li>
                <li>A short walk after meals, and enough sleep.</li>
              </ul>
            </>
          ),
        },
        {
          q: "Can prediabetes go back to normal?",
          body: (
            <p>
              The numbers can move in either direction over time. Lifestyle
              change lowers the chance of them moving up, and for some people
              results return to the normal range. Regular testing shows which
              way yours are heading, which is why guidelines suggest a test at
              least once a year.
            </p>
          ),
        },
        {
          q: "Everything on prediabetes",
          body: (
            <ul>
              {EVERYTHING.map(([href, name, why]) => (
                <li key={href}>
                  <a href={href}>{name}</a>:{" "}
                  {why.charAt(0).toLowerCase() + why.slice(1)}
                </li>
              ))}
            </ul>
          ),
        },
      ]}
      faq={[
        {
          q: "Prediabetes kya hota hai?",
          a: "Prediabetes ka matlab hai sugar normal se zyada hai lekin diabetes range se kam: khali pet sugar 100 se 125 mg/dL, ya HbA1c 5.7 se 6.4%. Iske aksar koi lakshan nahi hote, isliye blood test hi pata lagane ka tarika hai.",
        },
        {
          q: "Is an HbA1c of 6.0 prediabetes?",
          a: "Yes. An HbA1c of 5.7 to 6.4% is the prediabetes range, so 6.0% falls inside it.",
        },
        {
          q: "Does prediabetes always turn into diabetes?",
          a: "No. Not everyone with prediabetes develops diabetes. The risk is higher than normal, and lifestyle change lowers it.",
        },
        {
          q: "How often should I test with prediabetes?",
          a: "At least once a year, or as your doctor advises. A fasting sugar or HbA1c test is usual.",
        },
      ]}
      sources={[
        {
          label:
            "American Diabetes Association. Standards of Care in Diabetes, 2025. Sections 2 and 3.",
          href: "https://diabetesjournals.org/care/issue/48/Supplement_1",
        },
        {
          label:
            "Anjana RM, et al. Metabolic non-communicable disease health report of India: ICMR-INDIAB-17. Lancet Diabetes Endocrinol. 2023;11:474-489.",
          href: "https://pubmed.ncbi.nlm.nih.gov/37301218/",
        },
        {
          label:
            "Ramachandran A, et al. The Indian Diabetes Prevention Programme (IDPP-1). Diabetologia. 2006;49:289-297.",
          href: "https://pubmed.ncbi.nlm.nih.gov/16391903/",
        },
        {
          label:
            "Misra A, et al. Revised definition of obesity in Asian Indians living in India. Diabetes Metab Syndr. 2025;19(1):102989.",
          href: "https://pubmed.ncbi.nlm.nih.gov/39814628/",
        },
      ]}
    />
  );
}
