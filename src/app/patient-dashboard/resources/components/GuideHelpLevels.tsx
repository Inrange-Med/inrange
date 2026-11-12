"use client";

/*
  Where to turn, at the end of a guide (Arhaan Guides.tsx HelpLevels): what needs a hospital now,
  and what needs a message to the care team today. The hospital list is folded on a phone, so the
  page stays short (its red heading says what to do), and opens by itself on a laptop.
*/

import { useLayoutEffect, useRef } from "react";
import { CaretDown, Phone, WarningCircle } from "@phosphor-icons/react";
import type { Guide } from "../content/guideContent";
import foldingStyles from "@/app/patient-dashboard/styles/FoldingSection.module.css";
import pageStyles from "../ResourcesPage.module.css";
import styles from "./GuideHelpLevels.module.css";

export default function GuideHelpLevels({
  help,
}: {
  help: NonNullable<Guide["help"]>;
}) {
  const urgent = useRef<HTMLDetailsElement>(null);
  // before the first paint, so a laptop never sees it closed
  useLayoutEffect(() => {
    if (urgent.current && window.matchMedia("(min-width: 1024px)").matches)
      urgent.current.open = true;
  }, []);

  return (
    <div className={styles.levels}>
      {help.urgent && (
        <details
          ref={urgent}
          className={`${styles.level} ${styles.urgent}`}
          data-level="urgent"
        >
          <summary>
            <h3>
              <WarningCircle size={18} weight="fill" /> Go to hospital or call
              112 if
            </h3>
            <CaretDown
              size={16}
              className={foldingStyles.caret}
              aria-hidden="true"
            />
          </summary>
          <ul className={pageStyles.dots}>
            {help.urgent.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}
      {help.today && (
        <details className={foldingStyles.section}>
          <summary>
            <span className={styles.todaySum}>
              <Phone size={18} /> Message your care team today if
            </span>
            <CaretDown
              size={16}
              className={foldingStyles.caret}
              aria-hidden="true"
            />
          </summary>
          <div className={foldingStyles.sectionBody}>
            <ul className={pageStyles.dots}>
              {help.today.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}
