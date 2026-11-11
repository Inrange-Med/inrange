import type { Metadata } from "next";
import SugarChecker from "@/components/landing/tools/SugarChecker";
import ToolPage from "@/components/landing/tools/ToolPage";
import s from "@/components/landing/tools/ToolPage.module.css";

const TITLE = "Blood sugar level checker";
const DESC =
  "Is your sugar level normal? Check a fasting, after-food or random reading in mg/dL against the ranges doctors use in India, with or without diabetes. Free and private.";

export const metadata: Metadata = {
  title: `${TITLE}: normal sugar level chart | inrange`,
  description: DESC,
  alternates: { canonical: "/tools/blood-sugar-checker" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/tools/blood-sugar-checker",
    locale: "en_IN",
    type: "website",
  },
};

export default function Page() {
  return (
    <ToolPage
      slug="blood-sugar-checker"
      name={TITLE}
      description={DESC}
      title={["Is my sugar level", "normal?"]}
      tool={<SugarChecker />}
      answer={
        <>
          For adults without diabetes, a normal blood sugar is{" "}
          <strong>below 100 mg/dL fasting</strong> and{" "}
          <strong>below 140 mg/dL two hours after eating</strong>. From 100 to
          125 fasting, or 140 to 199 after food, is the prediabetes range; 126
          or more fasting, or 200 or more after food, is the diabetes range. One
          reading alone never diagnoses diabetes.
        </>
      }
      sections={[
        {
          q: "Normal sugar level chart",
          body: (
            <div className={s.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Reading</th>
                    <th scope="col">Normal</th>
                    <th scope="col">Prediabetes range</th>
                    <th scope="col">Diabetes range</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Fasting</th>
                    <td>Below 100 mg/dL</td>
                    <td>100 to 125</td>
                    <td>126 or more</td>
                  </tr>
                  <tr>
                    <th scope="row">2 hours after food</th>
                    <td>Below 140 mg/dL</td>
                    <td>140 to 199</td>
                    <td>200 or more</td>
                  </tr>
                  <tr>
                    <th scope="row">HbA1c</th>
                    <td>Below 5.7%</td>
                    <td>5.7 to 6.4%</td>
                    <td>6.5% or more</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ),
        },
        {
          q: "What should my sugar be if I have diabetes?",
          body: (
            <>
              <p>
                Common targets are <strong>80 to 130 mg/dL before meals</strong>{" "}
                and{" "}
                <strong>below 180 mg/dL one to two hours after meals</strong>,
                with an HbA1c below 7%. Your doctor may set different targets
                for you, for example if you are older or have frequent lows.
              </p>
            </>
          ),
        },
        {
          q: "When is a sugar reading dangerous?",
          body: (
            <>
              <p>
                <strong>Below 70 mg/dL is low.</strong> Take 15 grams of fast
                sugar, such as three teaspoons of sugar in water or half a glass
                of fruit juice, and check again after 15 minutes. If you feel
                confused, very drowsy or faint, call 112.
              </p>
              <p>
                A reading{" "}
                <strong>
                  above 250 mg/dL, or above 300 with thirst, drowsiness or
                  vomiting
                </strong>
                , needs a doctor the same day.
              </p>
            </>
          ),
        },
        {
          q: "Is 180 after food normal?",
          body: (
            <p>
              Two hours after a meal, 180 mg/dL is above the normal 140 for
              someone without diabetes and falls in the prediabetes range; a
              repeat test or an HbA1c helps confirm. For someone with diabetes,
              below 180 after meals is a common target.
            </p>
          ),
        },
      ]}
      faq={[
        {
          q: "Kya 180 sugar level normal hai?",
          a: "Khana khane ke 2 ghante baad 180 mg/dL, bina diabetes wale vyakti ke liye normal (140 se kam) se zyada hai aur prediabetes range mein aata hai. Diabetes wale logon ke liye khane ke baad 180 se kam ek aam target hai. Pakka jaanne ke liye HbA1c test karayein.",
        },
        {
          q: "Khali pet sugar kitni honi chahiye?",
          a: "Bina diabetes ke, khali pet (fasting) sugar 100 mg/dL se kam normal hai. 100 se 125 prediabetes range hai, aur 126 ya usse zyada diabetes range. Ek reading se diagnosis nahi hota.",
        },
        {
          q: "How long after eating should I check my sugar?",
          a: "For the after-food range, check two hours after you start eating. Readings taken sooner are naturally higher.",
        },
        {
          q: "Are home glucometer readings accurate?",
          a: "Home meters are useful for tracking, but the accuracy standard allows them to differ from a lab test by up to 15%. Wash and dry your hands first, and use a lab test to confirm a diagnosis.",
        },
      ]}
      sources={[
        {
          label:
            "American Diabetes Association. Standards of Care in Diabetes, 2025. Sections 2 and 6.",
        },
        {
          label:
            "Indian Council of Medical Research. ICMR Guidelines for Management of Type 2 Diabetes, 2018.",
        },
        {
          label:
            "American Diabetes Association. Hypoglycemia (low blood glucose): the 15-15 rule.",
        },
      ]}
    />
  );
}
