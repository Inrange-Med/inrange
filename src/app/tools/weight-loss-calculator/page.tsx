import type { Metadata } from "next";
import LossCalculator from "@/components/landing/LossCalculator";
import ToolPage from "@/components/landing/tools/ToolPage";
import { healthyRange, heightShort } from "@/components/landing/tools/data";
import s from "@/components/landing/tools/ToolPage.module.css";

const TITLE = "Weight loss calculator for Indians";
const DESC =
  "See how much weight you could lose: about 15% of your body weight over about 16 months, the average in a large trial of doctor-led care, in kilograms for your weight. Free, private, no sign-up.";

export const metadata: Metadata = {
  title: `${TITLE} | inrange`,
  description: DESC,
  alternates: { canonical: "/tools/weight-loss-calculator" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/tools/weight-loss-calculator",
    locale: "en_IN",
    type: "website",
  },
};

// the same heights, and the same formula, as the ideal weight pages, so the site never gives two answers
const HEIGHTS: [string, number, number, number][] = [
  58, 60, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 74,
].map((inches) => {
  const r = healthyRange(inches * 2.54, "kg");
  return [heightShort(inches), Math.round(inches * 2.54), r.lo, r.hi];
});

export default function Page() {
  return (
    <ToolPage
      slug="weight-loss-calculator"
      name={TITLE}
      description={DESC}
      title={["How much weight", "could you lose?"]}
      tool={<LossCalculator bare />}
      answer={
        <>
          In a large trial of doctor-led care where medication was prescribed,
          the average loss was <strong>about 15% of body weight</strong> (14.9%)
          over about 16 months. For someone who weighs 80 kg, that is about 12
          kg. Results vary, and your doctor sets your target.
        </>
      }
      sections={[
        {
          q: "Where does about 15% come from?",
          body: (
            <>
              <p>
                In a large trial where doctors prescribed medication alongside
                diet and activity support, the average loss was 14.9% of body
                weight at 68 weeks, about 16 months. The calculator uses that
                figure. A second large trial reported 15.0% at 72 weeks in its
                study group that lost the least. Other groups in that trial lost
                more. The calculator stays with about 15%, the figure both
                trials reach.
              </p>
              <p>
                The ruler also marks 5%: the American Diabetes
                Association&rsquo;s Standards of Care 2026 treat a loss of 5% or
                more as the minimum linked with better blood sugar, blood
                pressure and blood fats.
              </p>
              <p>
                These are averages across many people and do not predict your
                own result. How far you go depends on your body, your health and
                the plan your doctor sets with you. Medication is used only if
                your doctor judges it clinically appropriate, and not everyone
                is prescribed it.
              </p>
            </>
          ),
        },
        {
          q: "What is a healthy weight for my height in India?",
          body: (
            <>
              <p>
                By the 2025 Indian definition, a healthy BMI for adults is 18.5
                to 23. This is the weight range that gives, for common heights:
              </p>
              <div className={s.tableScroll}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Height</th>
                      <th scope="col">In cm</th>
                      <th scope="col">Healthy weight, Indian definition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HEIGHTS.map(([ft, cm, lo, hi]) => (
                      <tr key={cm}>
                        <th scope="row">{ft}</th>
                        <td>{cm} cm</td>
                        <td>
                          {lo} to {hi} kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ),
        },
        {
          q: "Why are Indian weight thresholds lower?",
          body: (
            <p>
              At the same BMI, Asian Indians tend to carry more body fat,
              especially around the organs, and develop diabetes and heart
              disease earlier than Europeans. So Indian experts define obesity
              from a BMI over 23 instead of the global 30, and treat a waist of
              90 cm or more in men, or 80 cm or more in women, as a separate
              warning sign.
            </p>
          ),
        },
        {
          q: "How fast is it safe to lose weight?",
          body: (
            <p>
              Most guidance considers a steady loss of about half a kilogram to
              one kilogram a week safe for adults. Faster loss can cost muscle,
              which matters as much as the number on the scale. If you have
              diabetes, a heart or kidney condition, or take regular medicines,
              let a doctor set the pace.
            </p>
          ),
        },
      ]}
      faq={[
        {
          q: "Is BMI different for men and women?",
          a: "No. BMI uses the same formula for everyone: weight in kilograms divided by height in metres squared. The calculator uses your height only to find the healthy range for Asian Indians.",
        },
        {
          q: "Does this calculator predict how much I will lose?",
          a: "No. It shows the average losses published studies report, worked out for your weight. Results vary between people, and your doctor sets a target and a pace that are safe for you.",
        },
        {
          q: "Is my data stored?",
          a: "No. The calculation runs in your browser and nothing you enter is sent or saved.",
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
            "American Diabetes Association. Standards of Care in Diabetes 2026, section 8: Obesity and weight management for the prevention and treatment of diabetes. Diabetes Care 2026;49(Suppl 1):S166.",
        },
        {
          label:
            "Look AHEAD Research Group. Reduction in weight and cardiovascular disease risk factors in individuals with type 2 diabetes: one-year results of the Look AHEAD trial. Diabetes Care 2007;30:1374.",
        },
        {
          label:
            "Knowler WC, et al. Diabetes Prevention Program Research Group. N Engl J Med 2002;346:393.",
        },
        {
          label:
            "Wilding JPH, et al. STEP 1 trial. N Engl J Med 2021;384:989. 14.9% average loss at 68 weeks.",
        },
        {
          label:
            "Jastreboff AM, et al. SURMOUNT-1 trial. N Engl J Med 2022;387:205. 15.0 to 20.9% average loss at 72 weeks across its study groups.",
        },
      ]}
    />
  );
}
