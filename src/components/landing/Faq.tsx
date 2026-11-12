"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { Art, Mask, Tag } from "./ui";
import s from "./Faq.module.css";
import { QA } from "./faq-data";

/** The questions section. The homepage uses its defaults; programme and pricing pages pass their own set. */
export default function Faq({
  items = QA,
  id = "questions",
  tag = "Before you start",
  title = ["Questions people", "ask us first."],
}: {
  items?: { q: string; a: string }[];
  id?: string;
  tag?: string;
  title?: string[];
} = {}) {
  // answers open independently, so opening one never collapses another above it and throws the
  // tapped question off a phone screen
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]));
  return (
    <section id={id} className={`section ${s.faq}`} aria-labelledby={`${id}-title`}>
      <Art kind="arcs" className={s.art} />
      <div className={`wrap ${s.grid}`}>
        <div className={s.intro}>
          <Tag>{tag}</Tag>
          <Mask id={`${id}-title`} className="h2" lines={title} soft={1} />
          <p className="body" suppressHydrationWarning data-reveal="rise" style={{ "--d": "140ms" } as React.CSSProperties}>
            Plain answers to what people ask before booking. For anything else, write to{" "}
            <a href="mailto:care@inrangemed.com" className={s.mail}>
              care@inrangemed.com
            </a>{" "}
            and a member of the care team will reply.
          </p>
        </div>

        <div className={s.list}>
          {items.map((item, i) => {
            const isOpen = open.has(i);
            return (
              <div key={item.q} className={s.item} data-open={isOpen}>
                <h3>
                  <button
                    id={`${id}-q-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`${id}-a-${i}`}
                    onClick={() =>
                      setOpen((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                    className={s.q}
                  >
                    <span>{item.q}</span>
                    <span className={s.icon} aria-hidden="true">
                      <Plus size={16} />
                    </span>
                  </button>
                </h3>
                <div id={`${id}-a-${i}`} role="region" aria-labelledby={`${id}-q-${i}`} className={s.a} inert={!isOpen}>
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
