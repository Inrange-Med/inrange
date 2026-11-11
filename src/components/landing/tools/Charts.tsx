import { BandTrack } from "./kit";
import m from "./More.module.css";

type Row = { label: string; min: number; max: number; bands: { to: number; tone: 0 | 1 | 2 | 3 }[]; cuts: number[] };

const LEGEND: Record<string, { tone: 0 | 1 | 2 | 3; label: string }[]> = {
  sugar: [
    { tone: 0, label: "Low" },
    { tone: 1, label: "Normal" },
    { tone: 2, label: "Prediabetes" },
    { tone: 3, label: "Diabetes range" },
  ],
  hba1c: [
    { tone: 1, label: "Normal, or at goal" },
    { tone: 2, label: "Prediabetes, or above goal" },
    { tone: 3, label: "Diabetes range, or well above goal" },
  ],
};

/** A chart plate for the chart guides: each test drawn as bands on its own scale, with the cut-offs marked. */
function Chart({ title, rows, legend, unit }: { title: string; rows: Row[]; legend: keyof typeof LEGEND; unit: string }) {
  return (
    <figure className={m.chart} suppressHydrationWarning data-reveal="rise">
      <figcaption className={m.chartHead}>
        <span>{title}</span>
        <span className={m.chartUnit}>{unit}</span>
      </figcaption>
      {rows.map((r) => (
        <div key={r.label} className={m.chartRow}>
          <p className={m.chartLabel}>{r.label}</p>
          <BandTrack min={r.min} max={r.max} bands={r.bands} cuts={r.cuts} />
        </div>
      ))}
      <ul className={m.legend}>
        {LEGEND[legend].map((l) => (
          <li key={l.label}>
            <i data-tone={l.tone} aria-hidden="true" />
            {l.label}
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function SugarChart() {
  return (
    <Chart
      title="Blood sugar, adults without diabetes"
      unit="mg/dL"
      legend="sugar"
      rows={[
        {
          label: "Fasting",
          min: 50,
          max: 160,
          bands: [
            { to: 70, tone: 0 },
            { to: 100, tone: 1 },
            { to: 126, tone: 2 },
            { to: 999, tone: 3 },
          ],
          cuts: [70, 100, 126],
        },
        {
          label: "2 hours after food",
          min: 50,
          max: 260,
          bands: [
            { to: 70, tone: 0 },
            { to: 140, tone: 1 },
            { to: 200, tone: 2 },
            { to: 999, tone: 3 },
          ],
          cuts: [70, 140, 200],
        },
      ]}
    />
  );
}

export function Hba1cChart() {
  return (
    <Chart
      title="HbA1c"
      unit="%"
      legend="hba1c"
      rows={[
        {
          label: "Without diabetes",
          min: 4.5,
          max: 10,
          bands: [
            { to: 5.7, tone: 1 },
            { to: 6.5, tone: 2 },
            { to: 99, tone: 3 },
          ],
          cuts: [5.7, 6.5],
        },
        {
          label: "With diabetes, common goal",
          min: 4.5,
          max: 10,
          bands: [
            { to: 7, tone: 1 },
            { to: 8, tone: 2 },
            { to: 99, tone: 3 },
          ],
          cuts: [7, 8],
        },
      ]}
    />
  );
}
