import type { ReactNode } from "react";
import type { ProgrammeKey } from "../programme-data";

/*
  The programme pages' words, one block per programme. Rules (CLAUDE.md, compliance):
  - a consultation and care service, never a remedy: no drug or treatment words, no "dose"
  - no outcomes, guarantees, success rates, testimonials or "reverse/cure"
  - PCOS: never promise cycles, ovulation, fertility or pregnancy
  - sexual health: clinical words only, never performance, stamina, pleasure or "better sex"
  - every figure has a source in `sources`
  Research, 16 Oct 2026: ICMR 2018 type 2 diabetes guideline, ADA Standards of Care 2026, the 2023
  international PCOS guideline (Teede), ICMR PCOS study (Ganie 2024), ICMR-INDIAB-17 (Anjana 2023),
  Misra 2025, Telemedicine Practice Guidelines 2020. CONFIRM the exact lines with counsel before launch.
*/

export type Row = { measure: string; why: string; when: string };
export type ProgrammePage = {
  key: ProgrammeKey;
  /** the search title, under 60 characters */
  seo: string;
  description: string;
  title: [string, string];
  /** this programme's own section headings, so no two programme pages read as one template */
  heads: { who: [string, string]; checks: [string, string]; life: [string, string]; faq: [string, string] };
  /** answer first: two or three sentences, key facts in bold */
  answer: ReactNode;
  /** the condition, for structured data */
  condition: string;
  explain: { q: string; body: ReactNode; caption?: string };
  suits: string[];
  first: string[];
  tool?: { href: string; label: string };
  checks: Row[];
  checksCaption: string;
  life: { name: string; text: string }[];
  /** the photo beside "Built for Indian life": an everyday scene, labelled as AI */
  lifeImg: { src: string; alt: string; focus: string };
  faq: { q: string; a: string }[];
  sources: { label: string; href?: string }[];
  related: string[];
};

const MISRA = {
  label: "Misra A, et al. Revised definition of obesity in Asian Indians living in India. Diabetes Metab Syndr 2025;19:102989.",
  href: "https://doi.org/10.1016/j.dsx.2024.102989",
};
const INDIAB = {
  label: "Anjana RM, et al. Metabolic non-communicable disease health report of India: the ICMR-INDIAB national cross-sectional study (ICMR-INDIAB-17). Lancet Diabetes Endocrinol 2023;11:474-89.",
  href: "https://pubmed.ncbi.nlm.nih.gov/37301218/",
};
const ICMR_T2D = {
  label: "Indian Council of Medical Research. ICMR Guidelines for Management of Type 2 Diabetes, 2018.",
  href: "https://www.icmr.gov.in/icmrobject/custom_data/pdf/resource-guidelines/ICMR_GuidelinesType2diabetes2018_0.pdf",
};
const ADA = { label: "American Diabetes Association. Standards of Care in Diabetes, 2026. Diabetes Care 2026;49(Suppl 1)." };
const TPG = {
  label: "Board of Governors in supersession of the Medical Council of India. Telemedicine Practice Guidelines, 2020.",
  href: "https://esanjeevani.mohfw.gov.in/assets/guidelines/Telemedicine_Practice_Guidelines.pdf",
};

export const PAGES: Record<ProgrammeKey, ProgrammePage> = {
  weight: {
    key: "weight",
    seo: "Doctor-led weight care in India | inrange",
    description:
      "Doctor-led weight care in India by video: a 30‑minute consultation, blood tests at home, a monthly doctor review and a plan built on Indian food. Medication only if your doctor judges it clinically appropriate.",
    title: ["Weight care,", "led by a doctor."],
    heads: { who: ["Who weight care", "is for."], checks: ["What your doctor", "measures first."], life: ["Planned around", "your kitchen."], faq: ["Weight care,", "your questions."] },
    answer: (
      <>
        Doctor-led care for adults with a <strong>BMI over 23</strong>, India&rsquo;s line for obesity since 2025. A{" "}
        <strong>30‑minute video consultation</strong>, home blood tests, then a doctor review <strong>every month</strong>.
        Medication only if your doctor judges it clinically appropriate.
      </>
    ),
    condition: "Obesity",
    explain: {
      q: "What counts as obesity in India?",
      body: (
        <>
          <p>
            Since 2025, a <strong>BMI over 23</strong> counts as obesity for Asian Indians, against 30 globally. South Asians
            carry more fat around the organs at a lower weight.
          </p>
          <p>
            Waist matters as much as weight: <strong>90 cm or more for men, 80 cm or more for women</strong>, or over half your
            height. With prediabetes, high blood pressure, fatty liver or joint pain, a doctor would call it stage 2.
          </p>
        </>
      ),
      caption: "Misra A, et al. Diabetes Metab Syndr 2025.",
    },
    suits: [
      "Your BMI is over 23, the Indian line for obesity",
      "Your waist is 90 cm or more (men) or 80 cm or more (women)",
      "You also have prediabetes, high blood pressure, fatty liver or joint pain",
      "You want a doctor and tests before anything starts",
    ],
    first: [
      "You are under 18",
      "You are pregnant or breastfeeding",
      "You have, or have had, an eating disorder",
      "You have type 1 diabetes",
    ],
    tool: { href: "/tools/bmi-calculator", label: "Check your BMI on the Indian scale" },
    checks: [
      { measure: "Weight, as a seven-day average", why: "Daily readings swing with water and salt", when: "Every week" },
      { measure: "Waist and waist-to-height ratio", why: "Fat around the organs carries most of the risk", when: "At reviews" },
      { measure: "Blood pressure", why: "It often rises with weight", when: "At reviews" },
      { measure: "HbA1c and fasting sugar", why: "Extra weight raises diabetes risk", when: "At the start, then as your doctor advises" },
      { measure: "Lipid profile", why: "Cholesterol and triglycerides add to heart risk", when: "At the start, then as your doctor advises" },
      { measure: "Liver tests", why: "Fatty liver is common and often silent", when: "At the start" },
      { measure: "Thyroid (TSH)", why: "A slow thyroid adds weight, and is simple to rule out", when: "At the start" },
    ],
    checksCaption: "What your doctor looks at. Your doctor sets the schedule. Thresholds: Misra A, et al., 2025.",
    life: [
      { name: "Vegetarian protein, planned", text: "A daily protein target from dal, paneer, curd, chana and soya, and eggs if you eat them." },
      { name: "The family's food", text: "Your plan starts from what is cooked at home, so nobody eats a separate meal." },
      { name: "Strength, twice a week", text: "A short routine at home or in the gym. Muscle matters as your weight changes." },
    ],
    lifeImg: { src: "/img/life-mealprep-c.jpg", alt: "A man in his forties chopping vegetables in his kitchen on a Sunday morning, a bowl of chana beside him", focus: "50% 30%" },
    faq: [
      {
        q: "Is a BMI of 23 overweight for Indians?",
        a: "Under the 2025 Indian definition, a BMI over 23 counts as obesity for Asian Indians, against 30 globally. Your waist and any related conditions decide the stage.",
      },
      {
        q: "What is a healthy waist size for Indians?",
        a: "Under 90 cm for men, under 80 cm for women, and under half your height. Measure at your navel, breathing out normally.",
      },
      {
        q: "Will I be prescribed medication?",
        a: "Only if your doctor judges it clinically appropriate, after your blood tests and consultation. Not everyone is prescribed medication. If you are, it is billed separately.",
      },
      {
        q: "Motapa kam karne ke liye doctor kya karta hai?",
        a: "Your doctor checks your weight, waist, blood pressure and blood tests, then plans food, strength and sleep with your coach and reviews it every month. Medication only if your doctor judges it clinically appropriate.",
      },
      {
        q: "How much weight could I lose?",
        a: "It varies, and your doctor sets your target with you. Our weight loss calculator shows what published studies report for someone your weight, with sources.",
      },
      {
        q: "Is everything done by video?",
        a: "Yes. Consultations are by video, and a lab collects blood samples at home.",
      },
    ],
    sources: [MISRA, INDIAB, ADA],
    related: ["/tools/bmi-calculator", "/tools/waist-size-calculator", "/tools/weight-loss-calculator", "/tools/protein-calculator"],
  },

  diabetes: {
    key: "diabetes",
    seo: "Type 2 diabetes care with a doctor in India | inrange",
    description:
      "Doctor-led care for type 2 diabetes and prediabetes in India: HbA1c and blood tests at home, your sugar readings read by a doctor, and a monthly review. Keep your own diabetologist.",
    title: ["Diabetes care,", "reviewed every month."],
    heads: { who: ["Who diabetes care", "is for."], checks: ["What your doctor", "tracks, and when."], life: ["Built around", "fasts and festivals."], faq: ["Diabetes care,", "your questions."] },
    answer: (
      <>
        Doctor-led care for adults with <strong>type 2 diabetes or prediabetes</strong>. Your doctor reads your HbA1c, sugar
        readings, and kidney and lipid tests, all done at home, and <strong>reviews your plan every month</strong>. Medication
        only if your doctor judges it clinically appropriate. Keep your own diabetologist if you have one.
      </>
    ),
    condition: "Type 2 diabetes",
    explain: {
      q: "What do the numbers mean?",
      body: (
        <>
          <p>
            Diabetes is diagnosed on two results above these lines, or one with symptoms. <strong>Prediabetes</strong> is the range
            just below. It is common, and worth acting on early. In India, about 1 in 9 adults has diabetes and about 1 in 7 has
            prediabetes.
          </p>
        </>
      ),
      caption: "ICMR 2018; American Diabetes Association 2026. Prevalence: ICMR-INDIAB-17, 2023.",
    },
    suits: [
      "You have type 2 diabetes, on medicines or not",
      "Your HbA1c is 5.7 to 6.4%, the prediabetes range",
      "Your fasting sugar is 100 mg/dl or more",
      "You want a doctor reading your numbers between appointments",
    ],
    first: [
      "You have type 1 diabetes or diabetes in pregnancy, best led by your own specialist",
      "You are under 18",
      "Your sugar is very high with vomiting, confusion or breathlessness: go to hospital or call 112",
    ],
    tool: { href: "/tools/diabetes-risk-score", label: "Take the Indian Diabetes Risk Score" },
    checks: [
      { measure: "HbA1c", why: "Your average sugar over three months", when: "Every 3 months, then every 6 once on target" },
      { measure: "Home sugar readings", why: "Show what moves your sugar", when: "As your doctor advises" },
      { measure: "Kidney: creatinine, eGFR and urine albumin", why: "Kidney changes start long before symptoms", when: "Every year" },
      { measure: "Lipid profile", why: "Heart risk rises with diabetes", when: "Every year" },
      { measure: "Blood pressure", why: "Protects the heart, kidneys and eyes", when: "At reviews" },
      { measure: "Eyes", why: "The retina can change before your vision does", when: "Every 1 to 2 years, by referral" },
      { measure: "Feet", why: "Nerve and circulation changes show first in the feet", when: "A daily self-check, and a yearly exam by referral" },
    ],
    checksCaption: "What your doctor looks at. Your doctor sets the schedule. ICMR 2018; American Diabetes Association 2026.",
    life: [
      { name: "Fasting days, planned ahead", text: "Navratri, Ekadashi, Ramzan or Karva Chauth: your doctor checks your readings first and tells you what changes." },
      { name: "Festivals and sweets", text: "Your coach plans Diwali and festival weeks ahead, so one big evening stays one evening." },
      { name: "Your diabetologist stays", text: "With your permission we share your plan and results with them." },
    ],
    lifeImg: { src: "/img/life-walk-c.jpg", alt: "A woman in her sixties on a morning walk in a Delhi park with her son, both smiling", focus: "50% 32%" },
    faq: [
      {
        q: "Can type 2 diabetes go into remission?",
        a: "Some people do. Doctors call it remission when HbA1c stays below 6.5% for at least three months without diabetes medicines. Nobody can promise it, and it can return. Your doctor tells you plainly where you stand.",
      },
      {
        q: "What is a normal HbA1c level?",
        a: "Below 5.7%. From 5.7 to 6.4% is prediabetes, and 6.5% or more on two tests means diabetes.",
      },
      {
        q: "How often should HbA1c be tested?",
        a: "Every 3 months while your sugar is above target or your treatment changes, and at least every 6 months once on target (ICMR 2018; American Diabetes Association 2026).",
      },
      {
        q: "Sugar control kaise karein?",
        a: "With a plan your doctor reviews: food built on your family's meals, activity, sleep and home readings, and medicine only if your doctor judges it clinically appropriate. HbA1c every three months shows how it is going.",
      },
      {
        q: "Can I fast during Navratri or Ramzan with diabetes?",
        a: "Many people can, with a plan made before the fast. Your doctor tells you when to test and when to break it. A low reading goes straight to a doctor.",
      },
      {
        q: "I already see a diabetologist. Can I keep them?",
        a: "Yes. With your permission we share your plan and results with them, so you all work from the same record.",
      },
    ],
    sources: [ICMR_T2D, ADA, INDIAB, { label: "RSSDI Clinical Practice Recommendations for the Management of Type 2 Diabetes Mellitus, 2022. Int J Diabetes Dev Ctries 2022;42(Suppl 1)." }],
    related: ["/tools/diabetes-risk-score", "/tools/hba1c-calculator", "/guides/hba1c-chart", "/guides/prediabetes", "/guides/navratri-fasting-with-diabetes"],
  },

  pcos: {
    key: "pcos",
    seo: "PCOS doctor online in India | inrange",
    description:
      "Doctor-led PCOS care in India, opening soon: video consultations, hormone and metabolic blood tests at home, and care for insulin resistance, weight and blood sugar. Join the waitlist.",
    title: ["PCOS care,", "with the full picture."],
    heads: { who: ["Who PCOS care", "is for."], checks: ["The tests that", "explain PCOS."], life: ["Care that fits", "your life."], faq: ["PCOS,", "your questions."] },
    answer: (
      <>
        Doctor-led care for adult women with polycystic ovary syndrome, <strong>opening soon</strong>. Your doctor looks at{" "}
        <strong>insulin resistance, weight, blood sugar and cholesterol</strong> alongside your hormone tests, by video, with
        blood tests at home.
      </>
    ),
    condition: "Polycystic ovary syndrome",
    explain: {
      q: "What is PCOS?",
      body: (
        <>
          <p>
            Polycystic ovary syndrome is a common hormonal condition, usually lifelong. It is diagnosed when <strong>two of three</strong>{" "}
            features are present: irregular or absent ovulation, signs of raised male hormones such as acne or extra hair, and many
            small follicles on an ultrasound or a raised AMH blood test.
          </p>
          <p>
            In an ICMR study of almost 9,000 Indian women, about <strong>1 in 5</strong> met these criteria. PCOS raises the risk of
            type 2 diabetes at any weight, so the metabolic tests matter as much as the hormone ones.
          </p>
        </>
      ),
      caption: "Teede HJ, et al., international PCOS guideline, 2023. Ganie MA, et al., JAMA Netw Open 2024.",
    },
    suits: [
      "You have been told you have PCOS or PCOD",
      "You have irregular periods, acne or extra hair and want to know why",
      "You want your weight, sugar and cholesterol looked at too",
    ],
    first: [
      "You are under 18",
      "You are pregnant or trying to conceive now: your gynaecologist leads that care",
      "You have pelvic pain or heavy bleeding: your doctor will refer you for a physical examination",
    ],
    checks: [
      { measure: "Testosterone and free androgen index", why: "Confirms raised male hormones", when: "At diagnosis" },
      { measure: "TSH, prolactin and 17-OH progesterone", why: "Rules out lookalike conditions", when: "At diagnosis" },
      { measure: "Blood sugar: glucose tolerance, fasting sugar or HbA1c", why: "PCOS raises diabetes risk at any weight", when: "At diagnosis, then every 1 to 3 years" },
      { measure: "Lipid profile", why: "Cholesterol changes are common with PCOS", when: "At diagnosis" },
      { measure: "Blood pressure", why: "Part of your long-term heart health", when: "Every year" },
      { measure: "AMH, in adults", why: "Can replace an ultrasound", when: "If your doctor advises" },
      { measure: "Mood and sleep", why: "Anxiety and low mood are more common with PCOS", when: "At consultations" },
    ],
    checksCaption: "Tests named in the 2023 international PCOS guideline. Your doctor decides which you need.",
    life: [
      { name: "No internal scan by default", text: "In adults, an AMH blood test can replace the ultrasound. Your doctor explains the options first." },
      { name: "Food without a 'PCOS diet'", text: "The guideline names no single diet. Your coach starts from what you already eat, with enough protein." },
      { name: "PCOD or PCOS", text: "PCOD is the name most used in India. It is the same condition, with the same care." },
    ],
    lifeImg: { src: "/img/life-pcos-c.jpg", alt: "A woman in her late twenties doing a squat on a yoga mat in her living room in the morning", focus: "50% 30%" },
    faq: [
      {
        q: "PCOS kya hota hai?",
        a: "PCOS (polycystic ovary syndrome) is a common hormonal condition. It is diagnosed when two of three are present: irregular or absent ovulation, signs of raised male hormones such as acne or extra hair, and many small follicles on an ultrasound or a raised AMH test.",
      },
      {
        q: "Is PCOD the same as PCOS?",
        a: "Yes. PCOD is a name used mostly in India for the same condition. International guidelines use PCOS.",
      },
      {
        q: "Does PCOS go away?",
        a: "PCOS usually lasts for years, and it can be managed. Care looks after your symptoms and your long-term health, especially blood sugar, cholesterol and weight.",
      },
      {
        q: "Can PCOS lead to diabetes?",
        a: "Women with PCOS have a higher risk of type 2 diabetes at any age or weight. The guideline advises a blood sugar test at diagnosis, then every 1 to 3 years.",
      },
      {
        q: "Do I need an internal ultrasound?",
        a: "Not always. In adults, an AMH blood test can replace the ultrasound. Your doctor explains the options before anything is booked.",
      },
      {
        q: "When does the programme open?",
        a: "Soon. Join the waitlist with your name, mobile and city, and we will tell you when it opens. We use your details for nothing else.",
      },
    ],
    sources: [
      { label: "Teede HJ, et al. Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome. J Clin Endocrinol Metab 2023;108:2447-69.", href: "https://doi.org/10.1210/clinem/dgad463" },
      { label: "Ganie MA, et al. ICMR multicentre study of polycystic ovary syndrome in India. JAMA Netw Open 2024;7(10):e2440583.", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11581580/" },
      MISRA,
    ],
    related: ["/tools/bmi-calculator", "/tools/diabetes-risk-score", "/guides/prediabetes", "/guides/hba1c-chart"],
  },

  sexual: {
    key: "sexual",
    seo: "Sexual health doctor online in India | inrange",
    description:
      "Private sexual health consultations with a doctor in India, opening soon, for men and women: a confidential video consultation and home blood tests for the health causes behind many concerns. Join the waitlist.",
    title: ["Sexual health,", "in confidence."],
    heads: { who: ["Who this care", "is for."], checks: ["What a doctor", "checks first."], life: ["Private,", "start to finish."], faq: ["Sexual health,", "your questions."] },
    answer: (
      <>
        A <strong>private video consultation with a doctor</strong> for adult men and women, <strong>opening soon</strong>. Your
        doctor listens in confidence and checks common causes such as <strong>blood sugar, blood pressure, cholesterol and
        hormones</strong>, with blood tests at home.
      </>
    ),
    condition: "Sexual dysfunction",
    explain: {
      q: "Why does a doctor look at the whole body?",
      body: (
        <>
          <p>
            Many sexual health concerns have a physical cause. Indian studies find erectile dysfunction in about{" "}
            <strong>6 in 10</strong> men with type 2 diabetes. It shares causes with heart and blood vessel disease, and can come
            first, so your doctor checks blood sugar, blood pressure and cholesterol.
          </p>
          <p>
            For women, low desire, difficulty with arousal and pain are common and rarely talked about. Hormones, thyroid, some
            medicines, sleep, stress and mood can all play a part. A doctor goes through each with you.
          </p>
        </>
      ),
      caption: "Rana RK, et al., Expert Rev Endocrinol Metab 2025. Dong JY, et al., J Am Coll Cardiol 2011.",
    },
    suits: [
      "You have a concern about erections, desire or arousal",
      "You have diabetes, high blood pressure or heart disease and notice changes",
      "You want to talk to a doctor privately, from home",
    ],
    first: [
      "You are under 18",
      "You have pain during sex, or a change you can see or feel: your doctor will refer you for a physical examination",
      "You have chest pain or breathlessness: go to hospital or call 112",
    ],
    checks: [
      { measure: "Blood sugar: HbA1c or fasting sugar", why: "One of the most common physical causes", when: "At the start" },
      { measure: "Lipid profile", why: "Blood vessel health affects sexual health", when: "At the start" },
      { measure: "Blood pressure", why: "Shares causes, and some of its medicines play a part", when: "At the start" },
      { measure: "Morning testosterone, where indicated", why: "Low levels can affect desire and energy", when: "If your doctor advises" },
      { measure: "Thyroid (TSH)", why: "An under- or overactive thyroid can affect desire", when: "If your doctor advises" },
      { measure: "Medicines, mood, sleep, alcohol and smoking", why: "Each can play a part", when: "At the start" },
    ],
    checksCaption: "What your doctor looks at. Your doctor decides which tests you need.",
    life: [
      { name: "By video, from home", text: "Your consultation and blood tests happen at home." },
      { name: "Seen only by your care team", text: "Your record is encrypted. We never share health information with advertisers." },
      { name: "Plain words, your language", text: "Ask in English, Hindi or Hinglish and get a straight answer, without judgement." },
    ],
    lifeImg: { src: "/img/life-private-c.jpg", alt: "A woman in her late thirties on a video call at her desk at home in the evening, wearing earphones", focus: "50% 36%" },
    faq: [
      {
        q: "Is erectile dysfunction related to heart disease?",
        a: "It can be. Large studies link it with a higher risk of heart problems later, so a doctor checks blood sugar, blood pressure and cholesterol too.",
      },
      {
        q: "Can diabetes cause erectile dysfunction?",
        a: "Yes. It is common in men with diabetes, which affects blood vessels and nerves. Looking after blood sugar is part of the plan.",
      },
      {
        q: "What can cause low desire in women?",
        a: "Hormones, thyroid, some medicines, stress, sleep, mood and relationship factors can all play a part. A doctor goes through each with you.",
      },
      {
        q: "Is an online sexual health consultation private?",
        a: "Yes. It is a secure video call, your record is encrypted and only your care team sees it. We never share health information with advertisers.",
      },
      {
        q: "Will I need to be examined?",
        a: "Many concerns can be assessed by video, with blood tests at home. For pain, or a change you can see or feel, your doctor will refer you for a physical examination, as the Telemedicine Practice Guidelines require.",
      },
      {
        q: "When does the programme open?",
        a: "Soon. Join the waitlist with your name, mobile and city, and we will tell you when it opens. We use your details for nothing else.",
      },
    ],
    sources: [
      { label: "Rana RK, et al. Erectile dysfunction in men with type 2 diabetes in India, a pooled analysis. Expert Rev Endocrinol Metab 2025.", href: "https://doi.org/10.1080/17446651.2025.2469635" },
      { label: "Dong JY, et al. Erectile dysfunction and risk of cardiovascular disease: meta-analysis of prospective cohort studies. J Am Coll Cardiol 2011;58:1378-85.", href: "https://doi.org/10.1016/j.jacc.2011.06.024" },
      { label: "Singh JC, et al. Female sexual dysfunction among women in south India. J Postgrad Med 2009;55:113.", href: "https://doi.org/10.4103/0022-3859.52842" },
      TPG,
    ],
    related: ["/tools/diabetes-risk-score", "/guides/blood-sugar-level-chart", "/tools/bmi-calculator"],
  },
};

/** Thresholds for the diabetes page's table (ICMR 2018, American Diabetes Association 2026). */
export const SUGAR_LINES = [
  { test: "Fasting blood sugar", normal: "Under 100 mg/dl", pre: "100 to 125 mg/dl", dm: "126 mg/dl or more" },
  { test: "2 hours after 75 g glucose", normal: "Under 140 mg/dl", pre: "140 to 199 mg/dl", dm: "200 mg/dl or more" },
  { test: "HbA1c", normal: "Under 5.7%", pre: "5.7 to 6.4%", dm: "6.5% or more" },
];
