"use client";

import { useState } from "react";
import { BandTrack, MeasureField, NextStep, WeightUnitToggle } from "./kit";
import { healthyRange } from "./data";
import { fmtHeight, kgTo, useUnits, type HeightUnit } from "./units";
import b from "./BmiCalculator.module.css";
import k from "./Kit.module.css";
import m from "./More.module.css";

/*
  Healthy weight for a height, by the revised definition of obesity in Asian Indians
  (Misra et al., 2025): BMI 18.5 to 23. Rounded inward, so both ends are inside the range.
  The global (WHO) chart runs to 25. BMI does not change with sex, so neither does the range.
*/

function nearby(cm: number, u: HeightUnit) {
  if (u === "ftin") {
    const inch = Math.round(cm / 2.54);
    return [-2, -1, 0, 1, 2].map((d) => ({ cm: (inch + d) * 2.54, on: d === 0 }));
  }
  const c = Math.round(cm);
  return [-4, -2, 0, 2, 4].map((d) => ({ cm: c + d, on: d === 0 }));
}

export default function IdealWeight({ initialCm = 160.02 }: { initialCm?: number }) {
  const [height, setHeight] = useState(initialCm);
  const units = useUnits();
  const u = units.weight;
  const r = healthyRange(height, u);
  const h2 = (height / 100) ** 2;

  return (
    <div className={b.instrument} suppressHydrationWarning data-reveal="rise">
      <div className={`${b.controls} ${m.stack}`}>
        <MeasureField kind="height" label="Height" value={height} min={140} max={200} onChange={setHeight} />
        <p className={m.note}>
          The healthy range is the same for men and women, because BMI does not change with sex.
        </p>
      </div>

      <div className={b.readout}>
        <div className={m.headRow}>
          <p className={b.k}>
            Healthy weight for <span className="num">{fmtHeight(height, units.height)}</span>
          </p>
          <WeightUnitToggle />
        </div>
        <p className={m.rangeBig} aria-live="polite">
          {r.lo} to {r.hi}
          <span>{u}</span>
        </p>
        <BandTrack
          min={kgTo(16 * h2, u)}
          max={kgTo(32 * h2, u)}
          bands={[
            { to: kgTo(18.5 * h2, u), tone: 0 },
            { to: kgTo(23 * h2, u), tone: 1 },
            { to: kgTo(40 * h2, u), tone: 3 },
          ]}
          cuts={[r.lo, r.hi]}
        />
        <p className={k.explain}>
          By the 2025 Indian definition, a healthy BMI is 18.5 to 23. The middle of your range is about{" "}
          <strong className="num">
            {r.mid}&nbsp;{u}
          </strong>
          . The global chart would allow up to {r.who}&nbsp;{u}, because it only starts overweight at 25, which misses risk
          that begins earlier in Indians.
        </p>

        <table className={m.near}>
          <caption>Nearby heights</caption>
          <tbody>
            {nearby(height, units.height).map((row) => {
              const n = healthyRange(row.cm, u);
              return (
                <tr key={row.cm} data-on={row.on}>
                  <th scope="row">{fmtHeight(row.cm, units.height)}</th>
                  <td>
                    {n.lo} to {n.hi}&nbsp;{u}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <NextStep
          fine={
            <>
              A healthy range is a guide. Muscle, frame, age and health all matter, and your doctor may suggest a different
              goal. Ranges use the revised definition of obesity in Asian Indians (Misra et al., 2025). For adults aged 18
              and over.
            </>
          }
        />
      </div>
    </div>
  );
}
