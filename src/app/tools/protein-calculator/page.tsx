import type { Metadata } from "next";
import ProteinCalculator from "@/components/landing/tools/ProteinCalculator";
import { FOODS } from "@/components/landing/tools/data";
import ToolPage from "@/components/landing/tools/ToolPage";
import s from "@/components/landing/tools/ToolPage.module.css";

const TITLE = "Protein calculator for vegetarians";
const DESC =
  "How much protein do you need a day? Work out your target from ICMR-NIN guidance, then build a vegetarian day from dal, paneer, curd, soya and more. Free and private.";

export const metadata: Metadata = {
  title: "Protein calculator for Indian vegetarians | inrange",
  description: DESC,
  alternates: { canonical: "/tools/protein-calculator" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/tools/protein-calculator",
    locale: "en_IN",
    type: "website",
  },
};

export default function Page() {
  return (
    <ToolPage
      slug="protein-calculator"
      name={TITLE}
      description={DESC}
      title={["Protein,", "the vegetarian way."]}
      tool={<ProteinCalculator />}
      related={[
        "/tools/ideal-weight-calculator",
        "/tools/weight-loss-calculator",
        "/guides/prediabetes",
        "/guides/navratri-fasting-with-diabetes",
      ]}
      answer={
        <>
          Most healthy adults need about{" "}
          <strong>0.83 g of protein for each kilogram</strong> of a healthy body
          weight a day, by ICMR-NIN guidance. For an adult of 5 ft 3 in at the
          top of the healthy range, that is about <strong>49 g a day</strong>.
          Adults over 65 may need more, about 1.0 to 1.2 g per kilogram. A
          vegetarian day of dal, curd, milk and roti comes close, and paneer,
          soya or chana closes the gap.
        </>
      }
      sections={[
        {
          q: "Protein in common vegetarian foods",
          body: (
            <>
              <div className={s.tableScroll}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Food</th>
                      <th scope="col">Portion</th>
                      <th scope="col">Protein, about</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FOODS.map((f) => (
                      <tr key={f.id}>
                        <th scope="row">{f.name}</th>
                        <td>{f.portion}</td>
                        <td>{f.g} g</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Values are rounded from the Indian Food Composition Tables 2017
                (soya chunks from typical pack labels) and typical home
                portions. Home recipes vary, so treat them as a guide.
              </p>
            </>
          ),
        },
        {
          q: "Why use a healthy weight, and not my weight?",
          body: (
            <p>
              Protein builds and repairs muscle and organs. Stored fat needs
              very little of it, so for anyone above the healthy range, the
              target is worked out on the top of the healthy range for their
              height. ICMR-NIN sets its recommendations on healthy reference
              weights in the same way.
            </p>
          ),
        },
        {
          q: "Can vegetarians get enough protein?",
          body: (
            <p>
              Yes, with a little planning. Pulses and grains complement each
              other, so dal with roti or rice gives a better balance of protein
              than either alone. Adding one richer source a day, such as paneer,
              curd, soya or chana, usually closes the gap.
            </p>
          ),
        },
        {
          q: "Does protein matter when losing weight?",
          body: (
            <p>
              It helps you feel full, and while weight comes down it helps
              protect muscle. Doctors and dietitians often aim towards the
              higher end for people losing weight, and set the number for each
              person.
            </p>
          ),
        },
        {
          q: "Who should be careful with more protein?",
          body: (
            <p>
              Anyone with kidney disease, or who has been told their kidney
              function is reduced, should ask their doctor before eating more
              protein.
            </p>
          ),
        },
      ]}
      faq={[
        {
          q: "How much protein is in 1 katori of dal?",
          a: "About 6 to 7 grams in a katori of cooked dal made from about 30 grams of dry dal. Thicker dal has more.",
        },
        {
          q: "Protein kitna khana chahiye?",
          a: "Zyadatar adults ko roz lagbhag 0.83 gram protein har kilo healthy body weight ke hisaab se chahiye. 65 saal se zyada umar mein thoda zyada, lagbhag 1.0 se 1.2 gram prati kilo.",
        },
        {
          q: "Is paneer a good source of protein?",
          a: "Yes. About 50 grams of paneer gives around 9 grams of protein. It is also high in fat, so portions matter.",
        },
        {
          q: "Do I need protein powder?",
          a: "Most people can reach their target from food. If you cannot, ask your doctor or dietitian whether a supplement makes sense for you.",
        },
      ]}
      sources={[
        {
          label:
            "ICMR-National Institute of Nutrition. Nutrient Requirements for Indians: Recommended Dietary Allowances and Estimated Average Requirements, 2020.",
        },
        {
          label:
            "ICMR-National Institute of Nutrition. Dietary Guidelines for Indians, 2024.",
        },
        {
          label:
            "Longvah T, et al. Indian Food Composition Tables 2017. National Institute of Nutrition, Hyderabad.",
        },
        {
          label:
            "Bauer J, et al. Evidence-based recommendations for optimal dietary protein intake in older people (PROT-AGE). J Am Med Dir Assoc. 2013;14(8):542-559.",
        },
      ]}
    />
  );
}
