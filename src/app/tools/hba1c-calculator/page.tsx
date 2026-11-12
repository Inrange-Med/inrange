import type { Metadata } from "next";
import Hba1cCalculator from "@/components/landing/tools/Hba1cCalculator";
import ToolPage from "@/components/landing/tools/ToolPage";
import s from "@/components/landing/tools/ToolPage.module.css";

const TITLE = "HbA1c calculator";
const DESC =
  "Convert HbA1c to average blood sugar in mg/dL and see what your result means: normal, prediabetes or diabetes range, or your goal if you have diabetes. Free and private.";

export const metadata: Metadata = {
  title: `${TITLE}: HbA1c to average sugar | inrange`,
  description: DESC,
  alternates: { canonical: "/tools/hba1c-calculator" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/tools/hba1c-calculator",
    locale: "en_IN",
    type: "website",
  },
};

const ROWS: [number, number, number][] = [
  [5.0, 97, 5.4],
  [5.5, 111, 6.2],
  [5.7, 117, 6.5],
  [6.0, 125, 7.0],
  [6.5, 140, 7.8],
  [7.0, 154, 8.6],
  [7.5, 169, 9.4],
  [8.0, 183, 10.2],
  [9.0, 212, 11.8],
  [10.0, 240, 13.4],
  [11.0, 269, 14.9],
  [12.0, 298, 16.5],
];

export default function Page() {
  return (
    <ToolPage
      slug="hba1c-calculator"
      name={TITLE}
      description={DESC}
      title={["What your HbA1c", "means in sugar."]}
      tool={<Hba1cCalculator />}
      answer={
        <>
          HbA1c shows your average blood sugar over about the last three months.{" "}
          <strong>Below 5.7% is normal</strong>, 5.7 to 6.4% is the prediabetes
          range and <strong>6.5% or more is the diabetes range</strong>. An
          HbA1c of 7% equals an average blood sugar of about 154 mg/dL.
        </>
      }
      sections={[
        {
          q: "HbA1c to average blood sugar chart",
          body: (
            <div className={s.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">HbA1c</th>
                    <th scope="col">Average sugar, mg/dL</th>
                    <th scope="col">mmol/L</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(([a, mg, mmol]) => (
                    <tr key={a}>
                      <th scope="row">{a.toFixed(1)}%</th>
                      <td>{mg}</td>
                      <td>{mmol.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
        {
          q: "How is average sugar worked out from HbA1c?",
          body: (
            <p>
              With the formula from the international ADAG study:{" "}
              <strong>average sugar (mg/dL) = 28.7 × HbA1c − 46.7</strong>. It
              is an estimate; your day-to-day readings will still move above and
              below it.
            </p>
          ),
        },
        {
          q: "What HbA1c should I aim for with diabetes?",
          body: (
            <p>
              Many doctors aim for below 7% for adults with diabetes, but the
              right goal is personal. Your doctor may set a higher goal if you
              are older or have frequent lows, or a lower one if it can be
              reached safely.
            </p>
          ),
        },
        {
          q: "How often should HbA1c be tested?",
          body: (
            <p>
              Because it reflects about three months, HbA1c is usually tested
              every three months while treatment is being adjusted, and about
              twice a year once it is stable. Anaemia, recent blood loss and
              pregnancy can make it less reliable.
            </p>
          ),
        },
      ]}
      faq={[
        {
          q: "Is an HbA1c of 6 good?",
          a: "An HbA1c of 6.0% is in the prediabetes range for someone without diabetes. For someone with diabetes it is below the common goal of 7%.",
        },
        {
          q: "HbA1c kitna hona chahiye?",
          a: "Bina diabetes ke HbA1c 5.7% se kam normal hai. 5.7 se 6.4% prediabetes range hai, aur 6.5% ya usse zyada diabetes range. Diabetes mein aksar 7% se kam ka target rakha jata hai.",
        },
        {
          q: "Do I need to fast for an HbA1c test?",
          a: "No. HbA1c does not need fasting, because it reflects your average over months, not the last meal.",
        },
      ]}
      sources={[
        {
          label:
            "Nathan DM, et al. Translating the A1C assay into estimated average glucose values. Diabetes Care. 2008;31(8):1473-1478.",
        },
        {
          label:
            "American Diabetes Association. Standards of Care in Diabetes, 2025. Sections 2 and 6.",
        },
        {
          label:
            "Indian Council of Medical Research. ICMR Guidelines for Management of Type 2 Diabetes, 2018.",
        },
      ]}
    />
  );
}
