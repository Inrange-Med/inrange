"use client";

/*
  The PRD's measures (section 14), same definitions, over the last 30 or 90 days: each with its value,
  its target, and how many it is out of. Below target says so in words; colour is only for that.
*/

import { useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useApiResource } from "@/hooks/useApiResource";
import { getNumbers } from "@/services/medicineOpsService";
import type { OpsMeasure } from "@/types/medicineOps";
import adminStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

function below(m: OpsMeasure) {
  if (m.value === null || m.target === undefined) return false;
  return m.lowerIsBetter ? m.value > m.target : m.value < m.target;
}

export default function NumbersPanel() {
  const [days, setDays] = useState<"30" | "90">("30");
  const numbers = useApiResource(`medicine-numbers-${days}`, () =>
    getNumbers(Number(days)),
  );

  return (
    <section className={adminStyles.panel} aria-labelledby="numbers-h">
      <div className={`${adminStyles.panelHead} ${s.headWrap}`}>
        <h2 id="numbers-h" className={adminStyles.h2}>
          Numbers
        </h2>
        <span className={s.seg}>
          <SegmentedControl
            label="Period"
            value={days}
            options={[
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
            ]}
            onChange={setDays}
          />
        </span>
      </div>
      {numbers.error && !numbers.data ? (
        <ErrorNotice message={numbers.error} onRetry={numbers.reload} />
      ) : !numbers.data ? (
        <LoadingSkeleton />
      ) : (
        <ul className={s.measures}>
          {numbers.data.map((m) => (
            <li key={m.key} className={s.measure}>
              <p>{m.label}</p>
              <span className={`${s.value} num`}>
                {m.value === null ? "None yet" : m.value}
                {m.value !== null && m.unit && <small>{m.unit}</small>}
              </span>
              <span className={`${s.target} num`} data-below={below(m)}>
                {m.target !== undefined &&
                  `Target ${m.lowerIsBetter ? "under " : ""}${m.target}${m.unit}`}
                {below(m) && ". Below target"}
                {m.base !== undefined &&
                  m.value !== null &&
                  `. Out of ${m.base}`}
              </span>
              {m.note && <span className={s.target}>{m.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
