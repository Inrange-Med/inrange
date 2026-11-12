import type { Metadata } from "next";
import WaistCalculator from "@/components/landing/tools/WaistCalculator";
import ToolPage from "@/components/landing/tools/ToolPage";
import { WaistPlate } from "@/components/landing/MeasurePlates";
import s from "@/components/landing/tools/ToolPage.module.css";
import m from "@/components/landing/tools/More.module.css";

const TITLE = "Waist size calculator";
const DESC =
  "Is your waist a risk? Check it against the Indian thresholds (80 cm for women, 90 cm for men) and half your height, in inches or cm, and learn how to measure it properly.";

export const metadata: Metadata = {
  title: "Waist size calculator: waist-to-height ratio for Indians | inrange",
  description: DESC,
  alternates: { canonical: "/tools/waist-size-calculator" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/tools/waist-size-calculator",
    locale: "en_IN",
    type: "website",
  },
};

export default function Page() {
  return (
    <ToolPage
      slug="waist-size-calculator"
      name={TITLE}
      description={DESC}
      title={["Your waist,", "and what it says."]}
      tool={<WaistCalculator />}
      related={[
        "/tools/diabetes-risk-score",
        "/tools/bmi-calculator",
        "/guides/fatty-liver-grades",
        "/tools/ideal-weight-calculator",
      ]}
      answer={
        <>
          For Indian adults, a waist of{" "}
          <strong>
            80 cm (31.5 in) or more in women, or 90 cm (35.4 in) or more in men
          </strong>
          , marks extra fat around the middle. A simpler rule works for
          everyone: <strong>keep your waist under half your height</strong>.
          Measure midway between your lowest rib and the top of your hip bone,
          after breathing out.
        </>
      }
      sections={[
        {
          q: "How to measure your waist",
          body: (
            <>
              <ol>
                <li>
                  Stand straight with your feet together, and move clothing away
                  from your waist.
                </li>
                <li>
                  Find your lowest rib and the top of your hip bone at your
                  side. The tape goes midway between them, which for most people
                  is close to the navel.
                </li>
                <li>
                  Wrap the tape level all the way round, snug against the skin
                  without pressing in.
                </li>
                <li>
                  Breathe out normally, and read the tape at the end of the
                  breath.
                </li>
                <li>Measure twice and use the average.</li>
              </ol>
              <figure
                className={m.plateWrap}
                suppressHydrationWarning
                data-reveal="draw"
              >
                <WaistPlate />
              </figure>
              <p>
                Your jeans size is not your waist. Most jeans sit lower, on the
                hips, so the tape usually reads more than the label.
              </p>
            </>
          ),
        },
        {
          q: "Waist size chart for Indian adults",
          body: (
            <div className={s.tableScroll}>
              <table>
                <caption>
                  Waist thresholds for Indian adults. Sources: revised
                  definition of obesity in Asian Indians (Misra et al., 2025)
                  and NICE NG246, 2025.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Measure</th>
                    <th scope="col">Women</th>
                    <th scope="col">Men</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Indian threshold</th>
                    <td>Under 80 cm (31.5 in)</td>
                    <td>Under 90 cm (35.4 in)</td>
                  </tr>
                  <tr>
                    <th scope="row">Waist to height</th>
                    <td>Under 0.5</td>
                    <td>Under 0.5</td>
                  </tr>
                  <tr>
                    <th scope="row">In plain words</th>
                    <td>Under half your height</td>
                    <td>Under half your height</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ),
        },
        {
          q: "Why does waist matter so much for Indians?",
          body: (
            <p>
              Many Indians store fat deep inside the abdomen, around the liver
              and other organs, even at a normal weight. Doctors call this
              visceral fat, and it is closely linked to type 2 diabetes, fatty
              liver and heart disease. Weight and BMI cannot see where fat sits,
              and a waist measure can. That is why the 2025 Indian definition of
              obesity uses the waist to decide how serious excess weight is.
            </p>
          ),
        },
        {
          q: "What is the waist-to-height ratio?",
          body: (
            <p>
              Your waist divided by your height, in the same units. Under 0.5 is
              healthy, 0.5 to 0.59 means raised risk and 0.6 or more means high
              risk, in the bands used by NICE in the UK. It adjusts for height,
              so it works for shorter and taller adults alike.
            </p>
          ),
        },
      ]}
      faq={[
        {
          q: "What is a normal waist size for Indian women?",
          a: "Under 80 cm, or 31.5 inches, by the Indian threshold, and under half your height by the waist-to-height rule.",
        },
        {
          q: "What is a normal waist size for Indian men?",
          a: "Under 90 cm, or 35.4 inches, by the Indian threshold, and under half your height by the waist-to-height rule.",
        },
        {
          q: "Kamar kitni honi chahiye?",
          a: "Indian thresholds ke hisaab se mahilaon ki kamar 80 cm (31.5 inch) se kam aur purushon ki 90 cm (35.4 inch) se kam honi chahiye. Aasaan niyam: kamar aapki height ke aadhe se kam ho.",
        },
        {
          q: "Can I have a healthy BMI and an unhealthy waist?",
          a: "Yes, and it is common in India. Fat around the middle can carry risk even when weight is in the healthy range, which is why doctors measure both.",
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
            "National Institute for Health and Care Excellence. Overweight and obesity management (NG246), 2025.",
        },
        {
          label:
            "World Health Organization. WHO STEPS surveillance manual: waist circumference measurement.",
        },
        {
          label:
            "Yajnik CS, Yudkin JS. The Y-Y paradox. Lancet. 2004;363(9403):163.",
        },
      ]}
    />
  );
}
