import type { Metadata } from "next";
import ToolPage from "@/components/landing/tools/ToolPage";
import { SugarChart } from "@/components/landing/tools/Charts";
import s from "@/components/landing/tools/ToolPage.module.css";

const TITLE = "Blood sugar level chart";
const DESC =
  "Normal blood sugar levels for adults in India: fasting, after food and random, with prediabetes and diabetes ranges, targets with diabetes, and what changes with age.";

export const metadata: Metadata = {
  title: "Blood sugar level chart: normal, fasting and after food | inrange",
  description: DESC,
  alternates: { canonical: "/guides/blood-sugar-level-chart" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/guides/blood-sugar-level-chart",
    locale: "en_IN",
    type: "article",
  },
};

const MMOL: [number, string][] = [
  [54, "Low, level 2"],
  [70, "Low below this"],
  [100, "Fasting normal below this"],
  [126, "Fasting diabetes range from here"],
  [140, "After-food normal below this"],
  [180, "After-meal target with diabetes"],
  [200, "Diabetes range after food"],
];

export default function Page() {
  return (
    <ToolPage
      kind="guide"
      slug="blood-sugar-level-chart"
      name={TITLE}
      description={DESC}
      about="Blood glucose"
      title={["Blood sugar", "level chart."]}
      tool={<SugarChart />}
      related={[
        "/tools/blood-sugar-checker",
        "/guides/hba1c-chart",
        "/guides/prediabetes",
        "/tools/diabetes-risk-score",
      ]}
      answer={
        <>
          For adults without diabetes, a{" "}
          <strong>fasting blood sugar under 100 mg/dL is normal</strong>, 100 to
          125 is the prediabetes range and 126 or more is the diabetes range.{" "}
          <strong>Two hours after eating, under 140 is normal</strong>, 140 to
          199 is prediabetes and 200 or more is diabetes. One reading alone
          never diagnoses diabetes.
        </>
      }
      points={[
        <>
          Below <strong>70 mg/dL</strong> is low blood sugar at any age, and
          needs fast sugar straight away.
        </>,
        <>
          With diabetes, a common target is{" "}
          <strong>80 to 130 before meals</strong> and under 180 after meals, set
          by your doctor.
        </>,
        <>
          The normal ranges are the same for every adult age. Targets with
          diabetes can be looser for older adults.
        </>,
      ]}
      sections={[
        {
          q: "Normal blood sugar levels chart",
          body: (
            <>
              <div className={s.tableScroll}>
                <table>
                  <caption>
                    Blood sugar ranges for adults, mg/dL. Source: American
                    Diabetes Association, Standards of Care 2025, and ICMR 2018.
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
                      <th scope="row">
                        Fasting
                        <small className={s.sub}>8 hours without food</small>
                      </th>
                      <td>Under 100</td>
                      <td>100 to 125</td>
                      <td>126 or more</td>
                    </tr>
                    <tr>
                      <th scope="row">
                        2 hours after
                        <small className={s.sub}>food or a glucose drink</small>
                      </th>
                      <td>Under 140</td>
                      <td>140 to 199</td>
                      <td>200 or more</td>
                    </tr>
                    <tr>
                      <th scope="row">
                        Random<small className={s.sub}>any time</small>
                      </th>
                      <td colSpan={2}>No fixed range</td>
                      <td>200 or more, with symptoms</td>
                    </tr>
                    <tr>
                      <th scope="row">HbA1c</th>
                      <td>Under 5.7%</td>
                      <td>5.7 to 6.4%</td>
                      <td>6.5% or more</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                Values in mg/dL. Diagnosis uses a lab test, usually repeated,
                and the two-hour figures come from the glucose drink test. Labs
                in India often use the same numbers for a reading two hours
                after a normal meal.
              </p>
            </>
          ),
        },
        {
          q: "Blood sugar targets with diabetes",
          body: (
            <>
              <div className={s.tableScroll}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Common target</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Before meals, including fasting</th>
                      <td>80 to 130 mg/dL</td>
                    </tr>
                    <tr>
                      <th scope="row">1 to 2 hours after a meal starts</th>
                      <td>Under 180 mg/dL</td>
                    </tr>
                    <tr>
                      <th scope="row">HbA1c</th>
                      <td>Under 7% for many adults</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                These are the common targets in the American Diabetes
                Association standards. Your doctor sets yours.
              </p>
            </>
          ),
        },
        {
          q: "Does normal blood sugar change with age?",
          body: (
            <>
              <p>
                No. The normal, prediabetes and diabetes ranges are the same for
                every adult, at 30 or at 70. What changes is the target for
                people who already have diabetes: for older adults, doctors
                often accept a little higher to avoid dangerous lows.
              </p>
              <div className={s.tableScroll}>
                <table>
                  <caption>
                    Targets for older adults with diabetes, mg/dL. Source:
                    American Diabetes Association, Standards of Care 2025,
                    section 13.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Older adults with diabetes</th>
                      <th scope="col">HbA1c</th>
                      <th scope="col">Fasting</th>
                      <th scope="col">Bedtime</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Healthy, few other conditions</th>
                      <td>Under 7.0 to 7.5%</td>
                      <td>80 to 130</td>
                      <td>80 to 180</td>
                    </tr>
                    <tr>
                      <th scope="row">Several other conditions</th>
                      <td>Under 8.0%</td>
                      <td>90 to 150</td>
                      <td>100 to 180</td>
                    </tr>
                    <tr>
                      <th scope="row">Very unwell or frail</th>
                      <td>Not relied on</td>
                      <td>100 to 180</td>
                      <td>110 to 200</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                Pregnancy uses tighter targets: fasting under 95, and under 140
                one hour or under 120 two hours after meals. Your obstetrician
                sets these.
              </p>
            </>
          ),
        },
        {
          q: "Blood sugar in mmol/L",
          body: (
            <>
              <p>
                Some meters and reports use mmol/L. Divide mg/dL by 18 to
                convert.
              </p>
              <div className={s.tableScroll}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">mg/dL</th>
                      <th scope="col">mmol/L</th>
                      <th scope="col">Why it matters</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MMOL.map(([mg, why]) => (
                      <tr key={mg}>
                        <th scope="row">{mg}</th>
                        <td>{(mg / 18).toFixed(1)}</td>
                        <td>{why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ),
        },
        {
          q: "When is blood sugar too low or too high?",
          body: (
            <>
              <p>
                <strong>Below 70 mg/dL is low.</strong> Take 15 grams of fast
                sugar, such as three teaspoons of sugar in water or half a glass
                of fruit juice, check again after 15 minutes and repeat if it is
                still low. Below 54 is seriously low. If someone is confused,
                very drowsy or faint, call 112.
              </p>
              <p>
                <strong>Above 250 mg/dL again and again</strong>, or above 300
                with thirst, drowsiness or vomiting, needs a doctor the same
                day.
              </p>
            </>
          ),
        },
        {
          q: "How to check your sugar at home correctly",
          body: (
            <ol>
              <li>
                Wash and dry your hands first; sugar on the fingers raises the
                reading.
              </li>
              <li>
                For a fasting reading, test after at least 8 hours without food,
                before tea or breakfast.
              </li>
              <li>
                For an after-food reading, test 2 hours after the first bite of
                the meal.
              </li>
              <li>
                Write down the time and what you ate, so your doctor can see
                patterns.
              </li>
              <li>
                Home meters can read up to 15% away from a lab test and still
                meet the international standard, so confirm surprising results
                with a lab.
              </li>
            </ol>
          ),
        },
      ]}
      faq={[
        {
          q: "Sugar level kitna hona chahiye?",
          a: "Bina diabetes ke khali pet sugar 100 mg/dL se kam aur khana khane ke 2 ghante baad 140 se kam normal hai. Diabetes mein aksar khane se pehle 80 se 130 aur khane ke baad 180 se kam ka target hota hai.",
        },
        {
          q: "Khali pet sugar kitni honi chahiye?",
          a: "Khali pet (fasting) sugar 100 mg/dL se kam normal hai. 100 se 125 prediabetes range hai, aur 126 ya usse zyada diabetes range.",
        },
        {
          q: "Is 180 sugar after food normal?",
          a: "For someone without diabetes, 180 two hours after food is in the prediabetes range and worth a lab test. For someone with diabetes, it is at the upper edge of the common target.",
        },
        {
          q: "What is normal blood sugar for a 60 year old?",
          a: "The same as for any adult: under 100 mg/dL fasting and under 140 two hours after food. With diabetes, targets for older adults may be looser, set by the doctor.",
        },
      ]}
      sources={[
        {
          label:
            "American Diabetes Association. Standards of Care in Diabetes, 2025. Sections 2, 6, 13 and 15.",
          href: "https://diabetesjournals.org/care/issue/48/Supplement_1",
        },
        {
          label:
            "Indian Council of Medical Research. ICMR Guidelines for Management of Type 2 Diabetes, 2018.",
        },
        {
          label:
            "ISO 15197:2013. In vitro diagnostic test systems: requirements for blood-glucose monitoring systems for self-testing.",
        },
      ]}
    />
  );
}
