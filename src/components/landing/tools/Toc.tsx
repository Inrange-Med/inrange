"use client";

import { useEffect, useState } from "react";
import s from "./ToolPage.module.css";

/** "On this page": a numbered list on phones, a sticky rail on desktop that marks the section being read. */
export default function Toc({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => e !== null);
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.isIntersecting));
        const first = items.find((i) => seen.get(i.id));
        if (first) setActive(first.id);
      },
      // a band across the upper part of the screen: the section under the reader's eye
      { rootMargin: "-20% 0px -55% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);

  return (
    <nav className={s.toc} aria-label="On this page">
      <p className={s.tocK}>On this page</p>
      <ol>
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} aria-current={active === i.id ? "location" : undefined}>
              {i.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
