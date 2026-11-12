"use client";

import { useState } from "react";
import { MeasureField, NextStep, Seg, Stepper } from "./kit";
import { FOODS, type Food } from "./data";
import { fmtWeight, useUnits } from "./units";
import b from "./BmiCalculator.module.css";
import k from "./Kit.module.css";
import m from "./More.module.css";

/*
  Daily protein, then a vegetarian day that reaches it.
  ICMR-NIN (2020): about 0.83 g of protein per kg of body weight a day for healthy adults, set on a
  healthy reference weight. So above the healthy range we use the top of it for this height (BMI 23),
  because stored fat needs little protein. Adults over 65: expert groups suggest 1.0 to 1.2 g/kg
  (PROT-AGE, Bauer et al., 2013). Food values are approximate, from the NIN food composition tables
  and typical home portions.
*/

type Age = "to65" | "over65";

type FoodId = Food["id"];

// a typical day that falls a little short, so the first thing to do is add a portion
const START: Record<FoodId, number> = { dal: 2, rajma: 0, paneer: 0, soya: 0, milk: 1, curd: 1, chilla: 1, peanuts: 0, roti: 4, rice: 0, egg: 0 };

export default function ProteinCalculator() {
  const [weight, setWeight] = useState(70);
  // 5 ft 3 in
  const [height, setHeight] = useState(160.02);
  const [age, setAge] = useState<Age>("to65");
  const [day, setDay] = useState(START);
  const units = useUnits();

  const h2 = (height / 100) ** 2;
  const bmi = weight / h2;
  // protein needs follow a healthy weight for this height
  const ref = bmi > 23 ? 23 * h2 : weight;
  const lo = Math.round(ref * (age === "over65" ? 1.0 : 0.83));
  const hi = age === "over65" ? Math.round(ref * 1.2) : lo;
  const total = FOODS.reduce((sum, f) => sum + f.g * day[f.id], 0);
  const scaleMax = Math.max(hi * 1.4, total * 1.05, 20);
  const left = lo - total;

  return (
    <div className={b.instrument} suppressHydrationWarning data-reveal="rise">
      <div className={`${b.controls} ${m.stack}`}>
        <MeasureField kind="weight" label="Weight" value={weight} min={30} max={250} onChange={setWeight} />
        <MeasureField kind="height" label="Height" value={height} min={140} max={200} onChange={setHeight} />
        <Seg<Age>
          label="Age"
          value={age}
          onChange={setAge}
          options={[
            { v: "to65", label: "65 or under" },
            { v: "over65", label: "Over 65" },
          ]}
        />
      </div>

      <div className={b.readout}>
        <div className={k.readingRow}>
          <div>
            <p className={b.k}>Protein a day</p>
            <p className={k.reading}>
              {lo === hi ? lo : `${lo} to ${hi}`}
              <span className={k.readingUnit}>grams</span>
            </p>
          </div>
        </div>
        <p className={m.note} aria-live="polite">
          {age === "over65" ? "1.0 to 1.2 g" : "0.83 g"} for each kilogram of {bmi > 23 ? "a healthy weight for your height" : "your weight"}
          {bmi > 23 ? (
            <>
              , which is <strong className="num">{fmtWeight(ref, units.weight)}</strong>. Protein needs follow muscle and
              organs, and stored fat needs little.
            </>
          ) : (
            "."
          )}
        </p>

        <div className={m.fill}>
          <div className={m.fillHead}>
            <span>
              Your day: <strong className="num">{total}&nbsp;g</strong>
            </span>
            <strong aria-live="polite">{left > 0 ? `${left} g to go` : "Target reached"}</strong>
          </div>
          <div className={m.fillTrack} aria-hidden="true">
            <span className={m.fillBar} style={{ "--p": Math.min(1, total / scaleMax) } as React.CSSProperties} />
            <span className={m.fillTarget} style={{ "--t": lo / scaleMax } as React.CSSProperties} />
          </div>
        </div>

        <div className={m.foods} role="group" aria-label="Build a vegetarian day">
          {FOODS.map((f) => (
            <div key={f.id} className={m.food}>
              <span className={m.foodName}>
                {f.name}
                <small>
                  {f.portion} &middot; about&nbsp;{f.g}&nbsp;g
                </small>
              </span>
              <Stepper label={f.name} value={day[f.id]} onChange={(v) => setDay({ ...day, [f.id]: v })} />
            </div>
          ))}
        </div>

        <NextStep
          fine={
            <>
              If you have kidney disease, ask your doctor before eating more protein. Protein values are approximate, from the
              Indian food composition tables of the National Institute of Nutrition and typical home portions, and soya chunks
              from typical pack labels; recipes and brands vary. General guidance for adults, and your doctor or dietitian may set a different target.
            </>
          }
        />
      </div>
    </div>
  );
}
