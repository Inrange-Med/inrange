import type { Metadata } from "next";
import ToolPage from "@/components/landing/tools/ToolPage";
import { Hba1cChart } from "@/components/landing/tools/Charts";
import s from "@/components/landing/tools/ToolPage.module.css";

const TITLE = "HbA1c chart";
const DESC =
  "HbA1c levels from 5 to 12% with average blood sugar and mmol/mol, what each range means, the usual goal with diabetes, and why anaemia can make HbA1c read high.";

export const metadata: Metadata = {
  title: "HbA1c chart: normal range, prediabetes and diabetes levels | inrange",
  description: DESC,
  alternates: { canonical: "/guides/hba1c-chart" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/guides/hba1c-chart",
    locale: "en_IN",
    type: "article",
  },
};

// average glucose from the ADAG formula; mmol/mol from the NGSP to IFCC master equation
const LEVELS = [5, 5.5, 5.7, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10, 11, 12].map((a) => {
  const eag = Math.round(28.7 * a - 46.7);
  return {
    a,
    ifcc: Math.round((a - 2.152) / 0.09148),
    eag,
    mmol: (eag / 18).toFixed(1),
    means:
      a < 5.7 ? "Normal" : a < 6.5 ? "Prediabetes range" : "Diabetes range",
  };
});

export default function Page() {
  return (
    <ToolPage
      kind="guide"
      slug="hba1c-chart"
      name={TITLE}
      description={DESC}
      about="Glycated haemoglobin (HbA1c)"
      title={["HbA1c chart,", "read simply."]}
      tool={<Hba1cChart />}
      related={[
        "/tools/hba1c-calculator",
        "/guides/blood-sugar-level-chart",
        "/guides/prediabetes",
        "/tools/diabetes-risk-score",
      ]}
      answer={
        <>
          HbA1c is your average blood sugar over about three months.{" "}
          <strong>Under 5.7% is normal</strong>,{" "}
          <strong>5.7 to 6.4% is the prediabetes range</strong> and{" "}
          <strong>6.5% or more is the diabetes range</strong>. With diabetes,
          many doctors aim for under 7%, which equals an average blood sugar of
          about 154 mg/dL.
        </>
      }
      points={[
        <>HbA1c needs no fasting, so it can be tested at any time of day.</>,
        <>
          <strong>Iron-deficiency anaemia</strong>, common in India, can make
          HbA1c read falsely high.
        </>,
        <>
          A result of 6.5% or more is confirmed with a repeat test before
          diabetes is diagnosed.
        </>,
      ]}
      sections={[
        {
          q: "HbA1c chart with average blood sugar",
          body: (
            <>
              <div className={s.tableScroll}>
                <table>
                  <caption>
                    HbA1c with average blood sugar. Sources: ADAG formula
                    (Nathan et al., 2008) and the NGSP to IFCC master equation.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">HbA1c</th>
                      <th scope="col">mmol/mol</th>
                      <th scope="col">Average sugar, mg/dL</th>
                      <th scope="col">Without diabetes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LEVELS.map((l) => (
                      <tr key={l.a}>
                        <th scope="row">{l.a.toFixed(1)}%</th>
                        <td>{l.ifcc}</td>
                        <td>
                          {l.eag} ({l.mmol} mmol/L)
                        </td>
                        <td>{l.means}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Average sugar uses the ADAG formula, 28.7 × HbA1c − 46.7. Some
                labs report HbA1c in mmol/mol, the international unit: 48
                mmol/mol is the same as 6.5%.
              </p>
            </>
          ),
        },
        {
          q: "What HbA1c goal is right with diabetes?",
          body: (
            <>
              <p>
                Under 7% is the goal many doctors use for adults with diabetes.
                It is set for each person: a doctor may accept under 7.0 to 7.5%
                for a healthy older adult, under 8% for someone with several
                other conditions, and a tighter goal in pregnancy, where the
                obstetrician decides.
              </p>
              <p>
                Every step toward your goal counts, even when the goal is still
                some way off.
              </p>
            </>
          ),
        },
        {
          q: "What can make HbA1c read wrong?",
          body: (
            <>
              <p>
                HbA1c measures sugar stuck to red blood cells, so anything that
                changes red blood cells changes the result:
              </p>
              <ul>
                <li>
                  <strong>Iron-deficiency anaemia</strong> can push it falsely
                  high. It is common in India, especially in women.
                </li>
                <li>
                  Recent blood loss or a blood transfusion can push it down.
                </li>
                <li>
                  Haemoglobin variants, such as thalassaemia trait, can affect
                  some lab methods.
                </li>
                <li>
                  Pregnancy and advanced kidney disease make it less reliable.
                </li>
              </ul>
              <p>
                If your HbA1c does not match your sugar readings, your doctor
                may check your haemoglobin and iron.
              </p>
            </>
          ),
        },
        {
          q: "Why HbA1c and fasting sugar can disagree",
          body: (
            <p>
              Fasting sugar is one moment in the morning. HbA1c is the average
              of every hour for three months, including the rises after meals.
              So a normal fasting sugar with a high HbA1c usually means sugar
              climbs after eating, and the opposite can happen too. Doctors look
              at both together.
            </p>
          ),
        },
        {
          q: "How often should HbA1c be tested?",
          body: (
            <p>
              With diabetes, usually every three months while treatment is being
              adjusted, and at least twice a year once it is stable. With
              prediabetes, at least once a year. Without either, how often
              depends on your risk; the{" "}
              <a href="/tools/diabetes-risk-score">diabetes risk score</a> helps
              decide.
            </p>
          ),
        },
      ]}
      faq={[
        {
          q: "What does an HbA1c of 6.5 mean?",
          a: "6.5% is the start of the diabetes range, an average blood sugar of about 140 mg/dL. Diabetes is confirmed with a repeat test or a second kind of test.",
        },
        {
          q: "Is an HbA1c of 5.9 normal?",
          a: "No. 5.9% is in the prediabetes range, which runs from 5.7 to 6.4%. It is the stage where changes in food, movement and weight have the most room to help.",
        },
        {
          q: "HbA1c 7 ka matlab kya hai?",
          a: "HbA1c 7% ka matlab hai pichhle lagbhag teen mahine ki average sugar karib 154 mg/dL. Diabetes mein aksar 7% se kam ka target rakha jata hai.",
        },
        {
          q: "Can anaemia affect HbA1c?",
          a: "Yes. Iron-deficiency anaemia can make HbA1c read falsely high, which is one reason doctors look at sugar readings and blood counts alongside it.",
        },
      ]}
      sources={[
        {
          label:
            "American Diabetes Association. Standards of Care in Diabetes, 2025. Sections 2, 6 and 13.",
          href: "https://diabetesjournals.org/care/issue/48/Supplement_1",
        },
        {
          label:
            "Nathan DM, et al. Translating the A1C assay into estimated average glucose values. Diabetes Care. 2008;31(8):1473-1478.",
        },
        {
          label:
            "English E, et al. The effect of anaemia and abnormalities of erythrocyte indices on HbA1c analysis: a systematic review. Diabetologia. 2015;58:1409-1421.",
          href: "https://pubmed.ncbi.nlm.nih.gov/25994072/",
        },
        {
          label:
            "NGSP. IFCC standardization of HbA1c: the NGSP and IFCC master equation.",
          href: "https://ngsp.org/ifccngsp.asp",
        },
      ]}
    />
  );
}
