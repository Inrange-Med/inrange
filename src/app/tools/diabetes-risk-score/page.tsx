import type { Metadata } from "next";
import DiabetesRisk from "@/components/landing/tools/DiabetesRisk";
import ToolPage from "@/components/landing/tools/ToolPage";
import s from "@/components/landing/tools/ToolPage.module.css";

const TITLE = "Indian Diabetes Risk Score";
const DESC =
  "Check your risk of type 2 diabetes with the Indian Diabetes Risk Score (IDRS): age, waist, activity and family history, scored out of 100. Free, private, no sign-up.";

export const metadata: Metadata = {
  title: "Indian Diabetes Risk Score (IDRS) calculator | inrange",
  description: DESC,
  alternates: { canonical: "/tools/diabetes-risk-score" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/tools/diabetes-risk-score",
    locale: "en_IN",
    type: "website",
  },
};

const SCORING: [string, string, number][] = [
  ["Age", "Under 35", 0],
  ["", "35 to 49", 20],
  ["", "50 or over", 30],
  ["Waist, women", "Under 80 cm (31.5 in)", 0],
  ["", "80 to 89 cm", 10],
  ["", "90 cm (35.4 in) or more", 20],
  ["Waist, men", "Under 90 cm (35.4 in)", 0],
  ["", "90 to 99 cm", 10],
  ["", "100 cm (39.4 in) or more", 20],
  ["Physical activity", "Vigorous exercise or heavy physical work", 0],
  ["", "Moderate exercise or activity at work or home", 10],
  ["", "Mild exercise or activity at work or home", 20],
  ["", "No exercise and a sitting day", 30],
  ["Parents with diabetes", "Neither", 0],
  ["", "One parent", 10],
  ["", "Both parents", 20],
];

export default function Page() {
  return (
    <ToolPage
      slug="diabetes-risk-score"
      name={TITLE}
      description={DESC}
      title={["Indian Diabetes", "Risk Score."]}
      tool={<DiabetesRisk />}
      related={[
        "/guides/prediabetes",
        "/tools/waist-size-calculator",
        "/guides/blood-sugar-level-chart",
        "/tools/hba1c-calculator",
      ]}
      schema={[
        {
          "@type": "MedicalRiskEstimator",
          name: "Indian Diabetes Risk Score",
          alternateName: "IDRS",
          estimatesRiskOf: {
            "@type": "MedicalCondition",
            name: "Type 2 diabetes mellitus",
          },
          includedRiskFactor: [
            "Age",
            "Waist circumference",
            "Physical activity",
            "Family history of diabetes",
          ].map((n) => ({
            "@type": "MedicalRiskFactor",
            name: n,
          })),
        },
      ]}
      answer={
        <>
          The Indian Diabetes Risk Score (IDRS) adds up four things: your age,
          your waist, how active you are and whether your parents have diabetes.
          A score of <strong>60 or more is high risk</strong> and a reason for a
          blood test, <strong>30 to 50 is moderate</strong> and under 30 is low.
          It was built and tested on Indian adults.
        </>
      }
      sections={[
        {
          q: "How is the Indian Diabetes Risk Score calculated?",
          body: (
            <>
              <p>
                Each answer carries points, and the four add up to a score out
                of 100. Age and activity carry the most, because they carry the
                most risk.
              </p>
              <div className={s.tableScroll}>
                <table>
                  <caption>
                    Indian Diabetes Risk Score. Source: Mohan et al., Journal of
                    the Association of Physicians of India, 2005.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Question</th>
                      <th scope="col">Answer</th>
                      <th scope="col">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SCORING.map(([q, a, p], i) => (
                      <tr key={i}>
                        <th scope="row">{q}</th>
                        <td>{a}</td>
                        <td>{p}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ),
        },
        {
          q: "What does my score mean?",
          body: (
            <div className={s.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Score</th>
                    <th scope="col">Risk</th>
                    <th scope="col">A sensible next step</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Under 30</th>
                    <td>Low</td>
                    <td>Check again if your waist or activity changes</td>
                  </tr>
                  <tr>
                    <th scope="row">30 to 50</th>
                    <td>Moderate</td>
                    <td>A fasting sugar or HbA1c test at your next check-up</td>
                  </tr>
                  <tr>
                    <th scope="row">60 or more</th>
                    <td>High</td>
                    <td>A fasting sugar or HbA1c test soon</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ),
        },
        {
          q: "How accurate is it?",
          body: (
            <p>
              It is a screening step, built to decide who needs a blood test. In
              the original study of Indian adults, a score of 60 or more picked
              up about 7 in 10 people who had diabetes without knowing it. That
              is why a high score leads to a test, and never to a diagnosis on
              its own.
            </p>
          ),
        },
        {
          q: "Why does it ask about my waist and not my weight?",
          body: (
            <p>
              Many Indians carry fat deep around the organs even at a normal
              weight, and that fat is closely linked to diabetes. A waist
              measure picks it up where weight alone can miss it. Our{" "}
              <a href="/tools/waist-size-calculator">waist size calculator</a>{" "}
              shows how to measure it properly.
            </p>
          ),
        },
        {
          q: "Which blood test comes next?",
          body: (
            <p>
              A fasting blood sugar or an HbA1c test. Neither needs a
              prescription from us, and both are available at most labs and
              through home collection. Our{" "}
              <a href="/guides/blood-sugar-level-chart">blood sugar chart</a>{" "}
              and <a href="/guides/hba1c-chart">HbA1c chart</a> explain the
              results.
            </p>
          ),
        },
      ]}
      faq={[
        {
          q: "What is a normal Indian Diabetes Risk Score?",
          a: "A score under 30 is low risk. From 30 to 50 is moderate, and 60 or more is high risk and a reason to have a fasting blood sugar or HbA1c test.",
        },
        {
          q: "Can a young person have a high score?",
          a: "Yes. Age gives at most 30 of the 100 points, so a large waist, little activity and both parents with diabetes can reach 60 at any age.",
        },
        {
          q: "Diabetes ka risk kaise check karein?",
          a: "Indian Diabetes Risk Score mein chaar sawal hain: umar, kamar ka naap, physical activity aur parents mein diabetes. 60 ya usse zyada score high risk hai; tab fasting sugar ya HbA1c test karwayein.",
        },
        {
          q: "I already have diabetes. Should I use this?",
          a: "No. The score is for adults who have not been told they have diabetes. If you have diabetes, the blood sugar and HbA1c tools are more useful.",
        },
      ]}
      sources={[
        {
          label:
            "Mohan V, Deepa R, Deepa M, Somannavar S, Datta M. A simplified Indian Diabetes Risk Score for screening for undiagnosed diabetic subjects. J Assoc Physicians India. 2005;53:759-763.",
          href: "https://pubmed.ncbi.nlm.nih.gov/16334618/",
        },
        {
          label:
            "Misra A, et al. Revised definition of obesity in Asian Indians living in India. Diabetes Metab Syndr. 2025;19(1):102989.",
          href: "https://pubmed.ncbi.nlm.nih.gov/39814628/",
        },
        {
          label:
            "Anjana RM, et al. Metabolic non-communicable disease health report of India: ICMR-INDIAB-17. Lancet Diabetes Endocrinol. 2023;11:474-489.",
        },
        {
          label:
            "American Diabetes Association. Standards of Care in Diabetes, 2025. Section 2.",
        },
      ]}
    />
  );
}
