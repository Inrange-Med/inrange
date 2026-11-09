"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { Art, Mask, Tag } from "./ui";
import s from "./Faq.module.css";

const QA = [
  {
    q: "Will I be prescribed medication?",
    a: "Only if your doctor decides it is clinically appropriate, after your consultation and blood tests. Many plans begin with nutrition, activity and sleep alone, and not everyone is prescribed medication. Your doctor explains the reasons and the risks of whatever your plan includes.",
  },
  {
    q: "Who is the programme for?",
    a: "Adults aged 18 and over living with overweight, obesity or type 2 diabetes, including people with related conditions such as prediabetes, fatty liver or high blood pressure. Your doctor confirms whether the programme suits you before anything begins.",
  },
  {
    q: "How do consultations work?",
    a: "By secure video, from anywhere in India. Your first consultation takes 15 minutes and is free. After that your doctor reviews your plan every 14 days, and between reviews your care team is in the app and on WhatsApp.",
  },
  {
    q: "How much does it cost?",
    a: "Your check and your first consultation are free. If your doctor recommends a plan, you choose 1, 4, 6 or 12 months, paid upfront, and you see the full price, itemised, before you pay. The plan covers consultations, reviews, blood tests at home, your nutrition plan, the app and delivery.",
  },
  {
    q: "Am I talking to a person or to AI?",
    a: "Both, and you always know which. An AI assistant answers everyday questions, like logging a meal, moving an appointment or eating well at a wedding. It does not diagnose, prescribe or change your treatment. Anything about symptoms or medicines, and anything complex or risky, is passed straight to a doctor on your care team.",
  },
  {
    q: "Is medicine part of the plan?",
    a: "Only if your doctor prescribes it after your consultation, and not everyone is prescribed medication. If you are, it is included in your plan's price and delivered to your door, sealed and verifiable. You can also fill a prescription at any licensed pharmacy you prefer.",
  },
  {
    q: "I already see a diabetologist. Can I keep them?",
    a: "Yes. With your permission we share your plan and results with them, so everyone works from the same record and nothing is changed without them knowing.",
  },
  {
    q: "What happens if I want to stop?",
    a: "Plans are paid upfront for 1, 4, 6 or 12 months, so you choose the length with your doctor at the start. Whenever you stop, your doctor helps you plan the change safely, and your records stay available to you.",
  },
  {
    q: "How is my health information protected?",
    a: "Your records are encrypted, access is limited to your care team, and we never share health information with advertisers. You decide who else can see it, and you can ask for it to be deleted, subject to the rules on keeping medical records.",
  },
  {
    q: "Is this suitable in an emergency?",
    a: "No. InRange is planned, ongoing care. If you have chest pain, severe breathlessness, fainting or any other emergency, go to the nearest hospital or call 112.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="questions" className={`section ${s.faq}`} aria-labelledby="faq-title">
      <Art kind="arcs" className={s.art} />
      <div className={`wrap ${s.grid}`}>
        <div className={s.intro}>
          <Tag>Before you start</Tag>
          <Mask id="faq-title" className="h2" lines={["Questions people", "ask us first."]} />
          <p className="body" data-reveal="rise" style={{ "--d": "140ms" } as React.CSSProperties}>
            For anything else, write to{" "}
            <a href="mailto:care@inrange.in" className={s.mail}>
              care@inrange.in
            </a>{" "}
            and a member of the care team will reply.
          </p>
        </div>

        <div className={s.list}>
          {QA.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className={s.item} data-open={isOpen}>
                <h3>
                  <button
                    id={`faq-q-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className={s.q}
                  >
                    <span>{item.q}</span>
                    <span className={s.icon} aria-hidden="true">
                      <Plus size={16} />
                    </span>
                  </button>
                </h3>
                <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} className={s.a} inert={!isOpen}>
                  <div>
                    <p>{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
