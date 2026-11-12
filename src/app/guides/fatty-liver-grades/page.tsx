import type { Metadata } from "next";
import ToolPage from "@/components/landing/tools/ToolPage";
import Fib4Calculator from "@/components/landing/tools/Fib4Calculator";
import s from "@/components/landing/tools/ToolPage.module.css";

const TITLE = "Fatty liver grades";
const DESC =
  "What grade 1, 2 and 3 fatty liver mean on an ultrasound report, why liver scarring matters more than the grade, a FIB-4 calculator and the next tests to ask about.";

export const metadata: Metadata = {
  title: "Fatty liver grade 1, 2 and 3: what your ultrasound means | inrange",
  description: DESC,
  alternates: { canonical: "/guides/fatty-liver-grades" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/guides/fatty-liver-grades",
    locale: "en_IN",
    type: "article",
  },
};

export default function Page() {
  return (
    <ToolPage
      kind="guide"
      slug="fatty-liver-grades"
      name={TITLE}
      description={DESC}
      about="Metabolic dysfunction-associated steatotic liver disease (fatty liver)"
      title={["Fatty liver grades,", "and what matters more."]}
      tool={<Fib4Calculator />}
      related={[
        "/guides/prediabetes",
        "/tools/waist-size-calculator",
        "/tools/weight-loss-calculator",
        "/tools/diabetes-risk-score",
      ]}
      answer={
        <>
          An ultrasound grades fatty liver by how bright and blurred the liver
          looks: <strong>grade 1 is mild</strong>,{" "}
          <strong>grade 2 moderate</strong> and <strong>grade 3 severe</strong>.
          The grade measures fat alone. What matters more for long-term health
          is scarring (fibrosis), which a simple blood-test score, FIB-4, and a
          liver scan can check.
        </>
      }
      points={[
        <>
          Roughly <strong>1 in 3 Indian adults</strong> has fatty liver, by a
          review of Indian studies.
        </>,
        <>
          Its new name is <strong>MASLD</strong>: fatty liver that comes with
          extra weight, raised sugar, blood pressure or cholesterol.
        </>,
        <>
          Guidelines name steady weight loss and more activity as the first
          treatment.
        </>,
      ]}
      sections={[
        {
          q: "What do fatty liver grades mean?",
          body: (
            <>
              <div className={s.tableScroll}>
                <table>
                  <caption>
                    Ultrasound grades of fatty liver. Source: INASL guidance,
                    2023.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Grade</th>
                      <th scope="col">What the scan shows</th>
                      <th scope="col">In plain words</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Grade 1</th>
                      <td>
                        The liver looks brighter than the kidney and spleen;
                        vessels and the diaphragm are clearly seen
                      </td>
                      <td>Mild fat</td>
                    </tr>
                    <tr>
                      <th scope="row">Grade 2</th>
                      <td>The vessels inside the liver look blurred</td>
                      <td>Moderate fat</td>
                    </tr>
                    <tr>
                      <th scope="row">Grade 3</th>
                      <td>
                        The deep part of the liver is hard to see, and the
                        diaphragm is not clearly seen
                      </td>
                      <td>Severe fat</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                Ultrasound can miss small amounts of fat, and the grade can
                differ between scans and between the people doing them. It is a
                starting point, and it says nothing about scarring.
              </p>
            </>
          ),
        },
        {
          q: "Is grade 1 fatty liver serious?",
          body: (
            <p>
              Grade 1 is the mildest amount of fat, and on its own it is not an
              emergency. It is still a signal: fatty liver often travels with
              extra weight around the middle, prediabetes and raised
              cholesterol, and it is worth checking for scarring and for those
              conditions.
            </p>
          ),
        },
        {
          q: "Why scarring matters more than the grade",
          body: (
            <p>
              Over years, fat can inflame the liver and leave scar tissue.
              Scarring predicts liver problems later far better than the amount
              of fat does. A grade 1 liver can have scarring, and a grade 3
              liver can have none, which is why doctors check scarring
              separately.
            </p>
          ),
        },
        {
          q: "FIB-4: a score from blood tests you may already have",
          body: (
            <>
              <p>
                FIB-4 uses your age, two liver enzymes (AST and ALT, also called
                SGOT and SGPT) and your platelet count, all found on a routine
                liver function test and blood count. The calculator above works
                it out.
              </p>
              <div className={s.tableScroll}>
                <table>
                  <caption>
                    FIB-4 cut-offs. Sources: Sterling et al., 2006; McPherson et
                    al., 2017; AASLD practice guidance, 2023.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">FIB-4</th>
                      <th scope="col">What it suggests</th>
                      <th scope="col">Usual next step</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Under 1.3 (under 2.0 from 65)</th>
                      <td>Advanced scarring unlikely</td>
                      <td>Repeat every one to three years</td>
                    </tr>
                    <tr>
                      <th scope="row">1.3 to 2.67</th>
                      <td>Not clear from blood tests</td>
                      <td>A liver stiffness scan (elastography)</td>
                    </tr>
                    <tr>
                      <th scope="row">Over 2.67</th>
                      <td>Advanced scarring possible</td>
                      <td>See a liver specialist</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ),
        },
        {
          q: "What is MASLD?",
          body: (
            <p>
              In 2023, liver societies renamed non-alcoholic fatty liver disease
              (NAFLD) as metabolic dysfunction-associated steatotic liver
              disease, or MASLD. The new name says what drives it: fat in the
              liver together with at least one metabolic risk, such as extra
              weight, raised blood sugar, high blood pressure or abnormal
              cholesterol. If alcohol also plays a part, doctors now say so
              openly.
            </p>
          ),
        },
        {
          q: "What helps fatty liver?",
          body: (
            <ul>
              <li>
                Steady weight loss, which guidelines name as the main treatment.
              </li>
              <li>
                At least 150 minutes a week of activity, which helps even before
                the scale moves.
              </li>
              <li>
                Cutting sugary drinks and sweets, and keeping blood sugar in
                range if you have prediabetes or diabetes.
              </li>
              <li>Keeping alcohol low, or stopping, as your doctor advises.</li>
            </ul>
          ),
        },
        {
          q: "Which doctor should I see?",
          body: (
            <p>
              Your physician can check FIB-4 and the conditions that travel with
              fatty liver. A gastroenterologist or hepatologist is the right
              specialist if FIB-4 is 1.3 or more, or if a scan shows stiffness.
            </p>
          ),
        },
      ]}
      faq={[
        {
          q: "Fatty liver grade 1 kya hota hai?",
          a: "Grade 1 fatty liver ka matlab hai liver mein thodi charbi, jo ultrasound mein liver ko thoda zyada chamkila dikhati hai. Yeh sabse halki grade hai, lekin weight, sugar aur cholesterol ki jaanch karwana samajhdari hai.",
        },
        {
          q: "Can fatty liver improve?",
          a: "Yes. Liver fat can come down with steady weight loss and more activity, which is why guidelines make these the first treatment.",
        },
        {
          q: "Is fatty liver linked to diabetes?",
          a: "Closely. Fatty liver and type 2 diabetes share the same roots in insulin resistance and fat around the middle, and each makes the other more likely.",
        },
        {
          q: "Does grade 2 fatty liver mean liver damage?",
          a: "Not by itself. The grade measures fat. Whether there is damage, meaning scarring, needs a FIB-4 score or a liver scan.",
        },
      ]}
      sources={[
        {
          label:
            "Indian National Association for the Study of the Liver (INASL). Guidance on MASLD. J Clin Exp Hepatol. 2023;13(2):273-302.",
          href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10025685/",
        },
        {
          label:
            "Rinella ME, et al. A multisociety Delphi consensus statement on new fatty liver disease nomenclature. Hepatology. 2023;78(6):1966-1986.",
          href: "https://pubmed.ncbi.nlm.nih.gov/37363821/",
        },
        {
          label:
            "Shalimar, et al. Prevalence of non-alcoholic fatty liver disease in India: a systematic review and meta-analysis. J Clin Exp Hepatol. 2022;12(3):818-829.",
          href: "https://pubmed.ncbi.nlm.nih.gov/35677499/",
        },
        {
          label:
            "Sterling RK, et al. Development of a simple noninvasive index to predict significant fibrosis (FIB-4). Hepatology. 2006;43(6):1317-1325.",
          href: "https://pubmed.ncbi.nlm.nih.gov/16729309/",
        },
        {
          label:
            "McPherson S, et al. Age as a confounding factor for the accurate non-invasive diagnosis of advanced NAFLD fibrosis. Am J Gastroenterol. 2017;112:740-751.",
          href: "https://pubmed.ncbi.nlm.nih.gov/27725647/",
        },
        {
          label:
            "Rinella ME, et al. AASLD Practice Guidance on the clinical assessment and management of NAFLD. Hepatology. 2023;77(5):1797-1835.",
        },
      ]}
    />
  );
}
