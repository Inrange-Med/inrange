/*
  The guides inside the patient app (Arhaan account/guide-content.ts): practical, calm, specific to
  Indian homes and meals. Static content, shown the same to every patient. Arhaan's pen-specific
  versions depend on a prescription record the backend does not expose yet, so every guide here is
  the generic version, which defers to the leaflet in the box. Clinical review of every guide is
  pending (CONFIRM with the medical lead).
*/

type GuideSection = { h: string; p?: string[]; list?: string[] };

/** The two people who present the videos. The poster names them, so a patient knows who is talking. */
export const PRESENTERS = {
  menon: { name: "Dr. Arvind Menon", role: "Endocrinologist" },
  ritika: { name: "Ritika Sharma", role: "Registered dietitian" },
} as const;

/**
 * A short video with the guide as its written version. There is no footage yet (CONFIRM the
 * shoot); the player says so and points to the text, which covers the same ground.
 */
export type Video = {
  /** the few words drawn on the thumbnail */
  label: string;
  /** "m:ss" */
  length: string;
  by: keyof typeof PRESENTERS;
  /** one or two lines under the title in the list */
  summary: string;
};

export type Guide = {
  slug: string;
  title: string;
  line: string;
  /** only for someone prescribed a weekly pen */
  pen?: boolean;
  minutes: number;
  /** three short lines, read first; the sections below open on demand */
  short: string[];
  sections: GuideSection[];
  /** when to stop reading and get help */
  help?: { urgent?: string[]; today?: string[] };
  video?: Video;
};

export const URGENT = [
  "Severe tummy pain that does not settle, sometimes spreading to the back",
  "Vomiting or loose motions and you cannot keep water down, or pass little urine",
  "Upper right tummy pain with fever, or yellow eyes or skin",
  "Swelling of the face, lips or throat, or trouble breathing",
  "Sudden loss or blurring of vision",
];

const TODAY = [
  "Nausea or vomiting that stops you eating for more than a day",
  "Constipation for more than three days",
  "Shakiness, sweating or confusion, if you also take insulin or a tablet that lowers sugar",
  "A lump or swelling in the neck, hoarseness or trouble swallowing",
  "Redness, warmth or a lump where you injected that is growing after two days",
];

export const GUIDES: Guide[] = [
  {
    slug: "how-inrange-works",
    title: "How inrange works",
    line: "The counsellor's call, your first consultation, the plan and your reviews.",
    minutes: 2,
    video: {
      label: "Meet inrange",
      length: "2:40",
      by: "menon",
      summary:
        "Your first consultation, how a plan is decided and who looks after you.",
    },
    short: [
      "A counsellor calls you first to check the programme suits you and to pass your details to your doctor. If you have no blood tests from the last 90 days, we book a home test before your consultation. Then your first consultation: 30 minutes by video with a doctor, with your results. The fee is shown before you book.",
      "If a plan suits you, your doctor suggests one. You see the itemised price before you pay anything.",
      "Medicine is prescribed only if your doctor judges it right for you. Not everyone is prescribed medication.",
    ],
    sections: [
      {
        h: "Before your first consultation",
        list: [
          "A counsellor calls you for a short chat to check the programme suits you, and passes your details to your doctor",
          "Blood tests from the last 90 days count; send a photo in Chat. If you have none, a partner lab comes home",
          "Then your first consultation: 30 minutes by video with your doctor, who reads your results with you. Ask anything; there is no plan to sign up to on the call",
        ],
      },
      {
        h: "After your first consultation",
        p: [
          "Your doctor may suggest a plan. A plan runs for 1, 4, 6 or 12 months, paid in advance, and the price is itemised before you pay. Medicine, if prescribed, comes from inrange's own licensed pharmacy, or any licensed pharmacy you prefer.",
        ],
      },
      {
        h: "Who looks after you",
        list: [
          "Your doctor reviews how you are doing every month",
          "Ritika, your dietitian, sets a meal plan around the food you already cook",
          "Your care team answers in Chat, and anything medical goes to your doctor",
        ],
      },
    ],
  },
  {
    slug: "how-your-medicine-works",
    title: "How your medicine works",
    line: "What the weekly injection does, and why the dose rises slowly.",
    minutes: 3,
    video: {
      label: "Your medicine",
      length: "3:20",
      by: "menon",
      summary:
        "What it does to appetite and sugar, and why the dose starts low.",
    },
    short: [
      "These medicines copy hormones your gut releases after a meal.",
      "You feel full sooner and for longer, and your body handles sugar better.",
      "The dose starts low and rises in steps, only when your doctor agrees, so your stomach can adjust.",
    ],
    sections: [
      {
        h: "What it does in the body",
        p: [
          "After you eat, your gut sends signals that tell your brain you have had enough and help your body release insulin. These medicines copy those signals and last a whole week, which is why there is one injection a week. Food also leaves the stomach more slowly, so a smaller meal keeps you full for longer.",
        ],
      },
      {
        h: "Why the dose rises slowly",
        p: [
          "Most stomach effects come in the first weeks and after each step up. Starting low and holding each dose for about four weeks gives your body time to adjust. Your doctor decides every step with you, and can hold or lower a dose if it does not suit you. Nothing changes without your doctor telling you.",
        ],
      },
      {
        h: "Living with it",
        list: [
          "One injection on the same day each week, at any time, with or without food",
          "It works best alongside the meal plan and regular movement your care team sets with you",
          "If you stop, appetite usually comes back, so any change is planned with your doctor",
        ],
      },
    ],
  },
  {
    slug: "first-injection",
    title: "Your first injection, step by step",
    line: "Six short steps with pictures and a timer. Pause whenever you like.",
    pen: true,
    minutes: 5,
    video: {
      label: "First injection",
      length: "4:30",
      by: "menon",
      summary: "Every step with the pen in hand, from the needle to the hold.",
    },
    short: [],
    sections: [],
  },
  {
    slug: "first-weeks",
    title: "Side effects and what helps",
    line: "What is common in the first weeks, what helps at an Indian table, and when it eases.",
    pen: true,
    minutes: 4,
    video: {
      label: "Side effects",
      length: "3:05",
      by: "menon",
      summary:
        "The common stomach effects, and the small changes that ease them.",
    },
    short: [
      "Feeling full sooner is expected. It is how the medicine works.",
      "Nausea, acidity or bowel changes are common early and after a step up.",
      "Smaller plates, slower meals and stopping when full help most.",
    ],
    sections: [
      {
        h: "What is common",
        p: [
          "In the large studies, the most common effects were in the stomach: nausea, loose motions, vomiting, constipation, acidity and burping. For most people they are mild to moderate and settle as the body adjusts, which is why the dose starts low and rises slowly.",
        ],
        list: [
          "Feeling full after a few bites",
          "Mild nausea, often the day after the injection",
          "Acidity or burping after rich food",
          "Constipation or loose motions for a few days",
          "Feeling more tired than usual in the first week",
        ],
      },
      {
        h: "What helps, at an Indian table",
        list: [
          "Serve yourself on a smaller thali, and start with dal, paneer, egg or chicken before the roti or rice",
          "Eat slowly and stop at the first sign of fullness, even with food left on the plate",
          "Go easy on fried and rich food: pakoras, puris, malai, buttery gravies and mithai",
          "Sip through the day: water, chaas, nimbu paani with a pinch of salt, or coconut water",
          "Adrak (ginger) tea can settle nausea",
          "Stay upright for an hour after meals, and keep dinner early and light",
          "For constipation, add fibre slowly with dal, sabzi and fruit, and ask your care team before taking isabgol",
        ],
      },
      {
        h: "When it usually eases",
        p: [
          "Stomach effects are most common in the first weeks and for a few days after each dose increase, then tend to ease. If they do not, your doctor can slow the increases. Tell your care team so they can help.",
        ],
      },
    ],
    help: { urgent: URGENT, today: TODAY },
  },
  {
    slug: "eating-with-less-appetite",
    title: "Eating well with a smaller appetite",
    line: "Protein first, so you keep your muscle. Indian portions, with numbers.",
    minutes: 4,
    video: {
      label: "Eating well",
      length: "3:40",
      by: "ritika",
      summary: "Protein first, smaller plates, and a day of Indian meals.",
    },
    short: [
      "With less appetite, what you eat matters more. Protein goes on the plate first.",
      "Your plan sets a daily protein target. Have some at every meal.",
      "Strength work twice a week, with enough protein, helps you keep muscle while you lose weight.",
    ],
    sections: [
      {
        h: "Protein in everyday portions",
        p: [
          "Approximate values for common home portions. Your dietitian can adjust them to your kitchen.",
        ],
        list: [
          "Paneer, 100 g: about 18 g",
          "Soya chunks, 30 g dry: about 15 g",
          "Chicken, 100 g cooked: about 20 to 25 g",
          "Two eggs: about 12 g",
          "Dal or rajma, 1 katori: about 7 to 8 g",
          "Curd, 1 katori: about 5 g",
          "Roasted chana, a handful: about 6 g",
          "Besan or moong chilla, 1: about 6 g",
        ],
      },
      {
        h: "A day that works",
        list: [
          "Breakfast: two moong chillas with curd, or eggs with a phulka",
          "Lunch: dal and a paneer or chicken sabzi first, then one phulka",
          "Evening: roasted chana with chaas",
          "Dinner, early: a protein dish with vegetables, and rice or roti only if still hungry",
        ],
      },
      {
        h: "Keeping your muscle",
        p: [
          "Losing weight without enough protein or activity can take muscle with it. Two short strength sessions a week help: squats to a chair, wall push-ups, stair climbs. Your walking target stays on top of that.",
        ],
      },
      {
        h: "Water through the day",
        p: [
          "A smaller appetite often means less water from food. Keep a bottle in sight and sip; chaas, nimbu paani and coconut water all count.",
        ],
      },
    ],
  },
  {
    slug: "when-to-call",
    title: "When to call us or go to hospital",
    line: "Most of what you feel is expected. These are the exceptions.",
    minutes: 2,
    short: [
      "Most early effects are mild and expected. Log them in the app so your doctor sees them.",
      "Some signs need help the same day; a few need a hospital now.",
      "In an emergency, call 112. inrange is not an emergency service.",
    ],
    sections: [
      {
        h: "Normal, and worth logging",
        list: [
          "Feeling full quickly, or not hungry",
          "Mild nausea or acidity after meals",
          "A small bruise or a drop of blood where you injected",
          "Constipation or loose motions for a day or two",
        ],
      },
      {
        h: "Before any surgery, scan or pregnancy",
        list: [
          "Before any operation, endoscopy or sedation, tell the surgeon and anaesthetist every medicine you take, including a weekly injection. Do not stop anything on your own; they will tell you what to do.",
          "If you are planning a pregnancy, tell your doctor first. Some of these medicines need stopping weeks ahead.",
          "If you become pregnant, tell your doctor straight away.",
        ],
      },
    ],
    help: { urgent: URGENT, today: TODAY },
  },
  {
    slug: "storing-your-pen",
    title: "Storing your pen in Indian heat",
    line: "Fridge before first use, never the freezer, never a hot car, and how to travel with it.",
    pen: true,
    minutes: 3,
    video: {
      label: "Pen storage",
      length: "2:15",
      by: "menon",
      summary: "The fridge, power cuts, summer heat and travelling with it.",
    },
    short: [
      "Before first use, keep it in the fridge at 2 to 8°C, never the freezer.",
      "Once started, the fridge is still safest in an Indian summer.",
      "A pen that froze or got too hot should not be used. Ask your care team for a new one.",
    ],
    sections: [
      {
        h: "At home",
        list: [
          "On a middle fridge shelf in its box, away from the door and the back wall",
          "Never in the freezer, even for a minute",
          "Cap on, away from sunlight, the stove and windowsills",
          "If the power is out for long, keep it in the closed fridge or a cool pouch, never on ice directly",
          "Never store it with a needle attached",
        ],
      },
      {
        h: "How long a pen keeps once started",
        p: [
          "This differs between pens. Some keep for 30 days after first use and some for six weeks, below 30°C. Check the leaflet in your box and note the date you started it on the pen's label.",
        ],
      },
      {
        h: "Travelling",
        list: [
          "Carry it in your hand luggage, never in checked bags, where it can freeze",
          "Use an insulated pouch, and keep a copy of your prescription with it",
          "Never leave it in a parked car, even for a short stop",
          "Changing time zones: keep to your usual day, and message your care team if a trip makes that hard",
        ],
      },
      {
        h: "Needles and used pens",
        p: [
          "Used needles go into a hard plastic bottle with a screw lid, such as an empty shampoo or detergent bottle. Keep it away from children and never put loose needles in the household bin. When it is full, close it tightly and ask your care team where to hand it in.",
        ],
      },
    ],
  },
  {
    slug: "missed-injection",
    title: "If you miss an injection",
    line: "What to do, by how many days have passed.",
    pen: true,
    minutes: 1,
    short: [
      "Four days or less since your usual day: take it now, then carry on as normal next week.",
      "More than four days: skip it, and take the next one on your usual day.",
      "Never take two within three days. Missed two weeks or more: message us before restarting, as the dose may need to start lower.",
    ],
    sections: [
      {
        h: "Changing your injection day",
        p: [
          "You can move your weekly day if life needs it, as long as two injections are at least three days apart. Tell your care team so reminders move with it.",
        ],
      },
    ],
  },
  {
    slug: "festive-season",
    title: "Festivals, fasts and weddings",
    line: "Navratri, Karva Chauth, Diwali and wedding season: fasts, sweets and late dinners.",
    minutes: 3,
    short: [
      "Navratri runs 11 to 19 October this year, Karva Chauth is on 29 October and Diwali on 8 November.",
      "Ask your doctor before any fast, and never keep a nirjala fast in your first weeks or after a dose increase.",
      "Enjoy the festival. One sweet, slowly, is part of the plan.",
    ],
    sections: [
      {
        h: "Fasting",
        list: [
          "Tell your doctor which days you plan to fast at your next review, or in Chat",
          "Avoid a no-water fast while on this treatment unless your doctor agrees; dehydration is a real risk",
          "If you take insulin or a tablet that lowers sugar, your doctor may change the dose for fasting days",
          "Break the fast gently: water and fruit first, then a light meal",
        ],
      },
      {
        h: "Sweets and big meals",
        list: [
          "Fill half the plate with protein and vegetables first",
          "Choose one sweet you really want, and eat it slowly",
          "Rich, fried food is the most likely to bring on nausea and acidity, so keep portions small",
        ],
      },
      {
        h: "Alcohol at weddings",
        p: [
          "Alcohol can make nausea and acidity worse. If you take insulin or a sugar tablet, it can also drop your sugar hours later. Never drink on an empty stomach, alternate each drink with water, and eat a proper meal.",
        ],
      },
    ],
  },
  {
    slug: "blood-tests",
    title: "Home blood tests: before and after",
    line: "How to prepare, and how to read your results with your doctor's note.",
    minutes: 2,
    short: [
      "Nothing but water for 10 to 12 hours before. Take your usual medicines unless told otherwise.",
      "Results arrive in the app first, then your doctor adds a note.",
      "Open any result for what it measures and why it matters for you.",
    ],
    sections: [
      {
        h: "The night before",
        list: [
          "A normal, light dinner, no alcohol and nothing fried",
          "Then only plain water until the sample is taken",
          "If you take insulin or a tablet that lowers sugar, ask your doctor what to do that morning",
        ],
      },
      {
        h: "Reading your report",
        p: [
          "Each result is placed on the scale doctors use for that test, so you see more than just high or low. Your doctor's note at the top is the reading that counts; the ranges are there to help you follow it.",
        ],
      },
    ],
  },
];

/** The first injection, one step per screen. */
export type Step = {
  title: string;
  art: "start" | "sites" | "needle" | "dial" | "inject" | "after";
  lines: string[];
  note?: string;
  timer?: number;
};

export const INJECTION_STEPS: Step[] = [
  {
    title: "Before you start",
    art: "start",
    lines: [
      "Wash your hands with soap and water.",
      "Check the name and strength on the pen match your prescription, and that it is in date.",
      "Look through the window: the liquid should be clear and colourless.",
      "Keep a new needle and a hard plastic bottle for the used one beside you.",
    ],
    note: "Videos online often show a pen sold in other countries, which works differently. Follow the leaflet in your box and these steps.",
  },
  {
    title: "Choose a spot",
    art: "sites",
    lines: [
      "Your tummy, at least 5 cm (three fingers) from your navel, or the front of your thigh. The back of the upper arm works if someone else injects.",
      "Use a different spot each week, a finger's width or more from the last one.",
      "Avoid scars, bruises, stretch marks and hard skin. Inject on bare skin, never through clothes.",
    ],
    note: "Soap and water is enough for your skin. If you use an alcohol swab, let it dry first.",
  },
  {
    title: "Fit a new needle and check the flow",
    art: "needle",
    lines: [
      "Peel the tab off a new needle and screw it straight onto the pen. Pull off the outer cap and keep it. Remove the inner cap.",
      "Do the flow check exactly as your pen's leaflet says. Some pens need it only the first time with each new pen; others before every injection.",
      "Hold the pen with the needle pointing up and look for a drop at the tip. No drop: repeat as the leaflet says, then change the needle.",
    ],
  },
  {
    title: "Set your dose",
    art: "dial",
    lines: [
      "Turn the dial to the dose on your prescription. If your pen has fixed doses, turn it until it stops at the full-dose mark.",
      "Check the window before you go on. If it is wrong, turn it back and set it again.",
    ],
  },
  {
    title: "Inject and hold",
    art: "inject",
    lines: [
      "Hold the pen straight against your skin and push the needle all the way in.",
      "Press the button down and keep it pressed. Keep holding while you count slowly to 10, then lift the pen away.",
      "Check the window shows the end mark. A drop on the tip afterwards is normal and does not mean you lost the dose.",
    ],
    note: "Do not rub. A spot of blood or a small bruise is common; press gently with cotton.",
    timer: 10,
  },
  {
    title: "Put it away safely",
    art: "after",
    lines: [
      "Put the outer cap back on the needle, unscrew it and drop it in your hard plastic bottle. Close the lid.",
      "Put the pen cap back on and store the pen as your leaflet says, without a needle on it.",
      "Never share your pen, even with a new needle.",
    ],
  },
];
