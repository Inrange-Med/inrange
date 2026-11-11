import type { Metadata } from "next";
import ToolPage from "@/components/landing/tools/ToolPage";
import s from "@/components/landing/tools/ToolPage.module.css";

const TITLE = "Navratri fasting with diabetes";
const DESC =
  "Keeping the Navratri fast (11 to 19 October 2026) with diabetes? Who should not fast, when to break the fast, how often to check sugar, and vrat food swaps for steadier sugar.";

export const metadata: Metadata = {
  title:
    "Navratri fasting with diabetes: safe vrat tips and food swaps | inrange",
  description: DESC,
  alternates: { canonical: "/guides/navratri-fasting-with-diabetes" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/guides/navratri-fasting-with-diabetes",
    locale: "en_IN",
    type: "article",
  },
};

const SWAPS: [string, string][] = [
  [
    "A large bowl of sabudana khichdi",
    "A small bowl with peanuts and curd, or samak rice khichdi with vegetables",
  ],
  ["Kuttu or singhara puri", "Kuttu roti or chilla, cooked with little oil"],
  ["Fried aloo", "A small portion of boiled or roasted aloo, with curd"],
  ["Sweet lassi or sweetened milk", "Chaas, or plain milk"],
  [
    "Fruit chaat with sugar or honey",
    "One portion of fresh fruit with a few nuts",
  ],
  ["Makhana fried in ghee with sugar", "Roasted makhana"],
];

export default function Page() {
  return (
    <ToolPage
      kind="guide"
      slug="navratri-fasting-with-diabetes"
      name={TITLE}
      description={DESC}
      about="Type 2 diabetes"
      title={["Navratri fasting", "with diabetes."]}
      related={[
        "/tools/blood-sugar-checker",
        "/guides/blood-sugar-level-chart",
        "/tools/protein-calculator",
        "/guides/prediabetes",
      ]}
      answer={
        <>
          Many people with type 2 diabetes can keep the Navratri fast with
          planning, but <strong>talk to your doctor first</strong>, especially
          if you take medicines that can cause low sugar. Check your sugar more
          often, and{" "}
          <strong>
            break the fast if it falls below 70 mg/dL or rises above 300 mg/dL
          </strong>
          , or if you feel unwell. In 2026, Navratri runs from 11 to 19 October.
        </>
      }
      points={[
        <>Samak rice and kuttu raise sugar more slowly than sabudana.</>,
        <>
          Pair every vrat meal with <strong>protein</strong>, such as curd,
          paneer or peanuts.
        </>,
        <>Keep drinking water through the day, and skip sweetened drinks.</>,
      ]}
      sections={[
        {
          q: "Who should not fast?",
          body: (
            <>
              <p>
                Most doctors advise against fasting, or ask for close
                supervision, if you:
              </p>
              <ul>
                <li>Have type 1 diabetes</li>
                <li>
                  Have had very low sugar, or a hospital visit for sugar, in the
                  last three months
                </li>
                <li>Often have low sugar, or do not feel the warning signs</li>
                <li>Are pregnant</li>
                <li>
                  Have kidney disease with reduced function, or serious heart
                  disease
                </li>
                <li>Are unwell, or recovering from an illness</li>
              </ul>
            </>
          ),
        },
        {
          q: "Before the fast: talk to your doctor",
          body: (
            <p>
              Some diabetes medicines need their timing or amount changed on
              fast days, because a skipped meal with the usual medicine can drop
              sugar too low. Only your doctor can make that change. Never stop
              or change a medicine on your own for a fast.
            </p>
          ),
        },
        {
          q: "When to break the fast",
          body: (
            <div className={s.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">If</th>
                    <th scope="col">Do this</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Sugar below 70 mg/dL</th>
                    <td>
                      Break the fast. Take 15 grams of fast sugar, check again
                      after 15 minutes
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Sugar 70 to 90 mg/dL</th>
                    <td>Check again within an hour</td>
                  </tr>
                  <tr>
                    <th scope="row">Sugar above 300 mg/dL</th>
                    <td>Break the fast, drink water and call your doctor</td>
                  </tr>
                  <tr>
                    <th scope="row">
                      Shaky, sweaty, confused, faint or very thirsty
                    </th>
                    <td>
                      Break the fast whatever the meter says, and check your
                      sugar
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ),
        },
        {
          q: "How often to check your sugar",
          body: (
            <ul>
              <li>Before you start the fast, and mid-morning</li>
              <li>Mid-afternoon, when lows are most common</li>
              <li>
                Just before you break the fast, and 2 hours after the main meal
              </li>
              <li>Any time you feel unwell</li>
            </ul>
          ),
        },
        {
          q: "Vrat food swaps for steadier sugar",
          body: (
            <div className={s.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Instead of</th>
                    <th scope="col">Try</th>
                  </tr>
                </thead>
                <tbody>
                  {SWAPS.map(([a, b]) => (
                    <tr key={a}>
                      <th scope="row">{a}</th>
                      <td>{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
        {
          q: "Sabudana, kuttu, samak and rajgira: which raise sugar faster?",
          body: (
            <>
              <p>
                Sabudana is almost pure starch and raises sugar quickly, and
                popped rajgira does too. Samak rice (barnyard millet) and kuttu
                (buckwheat) raise it more slowly, so they make better bases for
                a vrat meal. Singhara flour has not been well studied.
              </p>
              <p>
                Portion matters as much as the choice: a small bowl of sabudana
                with peanuts and curd is gentler than a large bowl on its own.
              </p>
            </>
          ),
        },
        {
          q: "Breaking the fast gently",
          body: (
            <p>
              Start with water, then a balanced meal with vegetables, protein
              and a modest portion of grain. A large sweet at the end of a long
              fast sends sugar up fast, so keep sweets small and after the meal.
            </p>
          ),
        },
      ]}
      faq={[
        {
          q: "Kya diabetes mein Navratri vrat rakh sakte hain?",
          a: "Type 2 diabetes wale kai log doctor se salah lekar vrat rakh sakte hain. Sugar zyada baar check karein, aur agar sugar 70 mg/dL se kam ya 300 se zyada ho, ya tabiyat kharab lage, to vrat tod dein.",
        },
        {
          q: "Vrat mein sugar low ho jaye to kya karein?",
          a: "70 mg/dL se kam ho to vrat tod dein. 15 gram jaldi asar karne wali cheeni lein, jaise teen chammach cheeni paani mein, aur 15 minute baad dobara check karein.",
        },
        {
          q: "Is sabudana good for diabetes?",
          a: "Sabudana raises blood sugar quickly, so it is best in a small portion with protein such as peanuts or curd. Samak rice or kuttu are steadier choices.",
        },
        {
          q: "When is Navratri in 2026?",
          a: "Sharad Navratri 2026 begins on Sunday 11 October and ends on 19 October, with Dussehra on 20 October. Exact timings vary by city.",
        },
      ]}
      sources={[
        {
          label:
            "International Diabetes Federation and DAR International Alliance. Diabetes and Ramadan: Practical Guidelines, 2021.",
          href: "https://pubmed.ncbi.nlm.nih.gov/35016991/",
        },
        {
          label:
            "American Diabetes Association. Standards of Care in Diabetes, 2025. Section 6.",
        },
        {
          label:
            "Ugare R, et al. Glycemic index and significance of barnyard millet (Echinochloa frumentacae) in type II diabetics. J Food Sci Technol. 2014;51(2):392-395.",
          href: "https://pubmed.ncbi.nlm.nih.gov/24493902/",
        },
        {
          label:
            "Atkinson FS, et al. International tables of glycemic index and glycemic load values 2021. Am J Clin Nutr. 2021;114(5):1625-1632.",
          href: "https://pubmed.ncbi.nlm.nih.gov/34258626/",
        },
      ]}
    />
  );
}
