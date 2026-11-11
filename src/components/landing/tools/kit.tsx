"use client";

import { useId, useState, type ReactNode } from "react";
import { ArrowRight, LockSimple, Minus, Plus, Stethoscope } from "@phosphor-icons/react";
import { ASSESSMENT_URL } from "../ui";
import { cmTo, fmtHeight, fmtLength, fmtWeight, kgTo, setUnits, toCm, toKg, useUnits } from "./units";
import b from "./BmiCalculator.module.css";
import k from "./Kit.module.css";

/** A segmented choice with a sliding thumb, any number of options, arrow keys, roving tabindex. */
export function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { v: T; label: string; sub?: string }[];
  onChange: (v: T) => void;
}) {
  const at = Math.max(0, options.findIndex((o) => o.v === value));
  return (
    <div className={k.segBlock}>
      <p className={k.segLabel}>{label}</p>
      <div
        className={k.seg}
        role="radiogroup"
        aria-label={label}
        style={{ "--n": options.length, "--at": at } as React.CSSProperties}
        onKeyDown={(e) => {
          const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          const next = (at + d + options.length) % options.length;
          onChange(options[next].v);
          (e.currentTarget.querySelectorAll("button")[next] as HTMLButtonElement | undefined)?.focus();
        }}
      >
        <span className={k.thumb} aria-hidden="true" />
        {options.map((o, i) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={i === at}
            tabIndex={i === at ? 0 : -1}
            onClick={() => onChange(o.v)}
            className={k.segBtn}
          >
            <span>{o.label}</span>
            {o.sub && (
              <span className={k.segSub} lang={/[\u0900-\u097F]/.test(o.sub) ? "hi" : undefined}>
                {o.sub}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A vertical list of choices, for options too long for a segmented control. */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { v: T; label: string; sub?: string }[];
  onChange: (v: T) => void;
}) {
  const at = Math.max(0, options.findIndex((o) => o.v === value));
  return (
    <div className={k.segBlock}>
      <p className={k.segLabel}>{label}</p>
      <div
        className={k.choice}
        role="radiogroup"
        aria-label={label}
        onKeyDown={(e) => {
          const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          const next = (at + d + options.length) % options.length;
          onChange(options[next].v);
          (e.currentTarget.querySelectorAll("button")[next] as HTMLButtonElement | undefined)?.focus();
        }}
      >
        {options.map((o, i) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={i === at}
            tabIndex={i === at ? 0 : -1}
            onClick={() => onChange(o.v)}
            className={k.choiceBtn}
          >
            <i className={k.choiceMark} aria-hidden="true" />
            <span className={k.choiceText}>
              <span>{o.label}</span>
              {o.sub && <span className={k.choiceSub}>{o.sub}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ruler graduations that read like a real edge: a minor tick every m units, a major every 5m */
function graduations(span: number) {
  const m = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50].find((c) => span / c <= 56) ?? 100;
  return { "--major": span / (m * 5), "--minor": span / m };
}

/** A typeable number that commits valid values live and clamps on blur. */
function NumberBox({
  id,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  id?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  // what the visitor is typing, kept until it is a usable number; the result follows valid values live
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  // show what the maths uses, to one decimal, so a typed 79.6 never reads as 80; the box grows to fit it
  const shown = String(Math.round(value * 10) / 10);
  const chars = (draft ?? shown).length;
  return (
    <span className={k.typeWrap}>
      <input
        id={id}
        className={k.type}
        // a tap selects the number, so typing replaces it instead of adding to it
        onFocus={(e) => e.currentTarget.select()}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft ?? shown}
        style={chars > 4 ? { width: `${chars + 0.4}ch` } : undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(v) && v >= min && v <= max) onChange(v);
        }}
        onBlur={() => {
          const v = Number(draft);
          if (draft !== null && draft !== "" && Number.isFinite(v)) onChange(clamp(v));
          setDraft(null);
        }}
      />
      {unit && <span className={k.typeUnit}>{unit}</span>}
    </span>
  );
}

/** The slider half of every ruler, with graduations and end labels. */
function Slider({
  label,
  value,
  min,
  max,
  step,
  valueText,
  ends,
  plain = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  valueText: string;
  ends: [string, string];
  /** no graduations or end labels: for a tool whose result is the one ruler on screen */
  plain?: boolean;
  onChange: (v: number) => void;
}) {
  const v = Math.min(max, Math.max(min, value));
  return (
    <>
      <div
        className={`${b.rangeWrap} ${plain ? k.plainRange : ""}`}
        style={{ "--fill": (v - min) / (max - min), ...(plain ? {} : graduations(max - min)) } as React.CSSProperties}
      >
        <input
          aria-label={`${label}, slider`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={v}
          aria-valuetext={valueText}
          onChange={(e) => onChange(Number(e.target.value))}
          className={b.range}
        />
      </div>
      {!plain && (
        <div className={b.scaleEnds} aria-hidden="true">
          <span className="num">{ends[0]}</span>
          <span className="num">{ends[1]}</span>
        </div>
      )}
    </>
  );
}

/** A ruler slider with a typeable value, for readings people copy from a report. */
export function ReadingRuler({
  label,
  unit,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className={b.field}>
      <div className={b.fieldHead}>
        <label htmlFor={`${id}-n`}>{label}</label>
        <NumberBox id={`${id}-n`} value={value} min={min} max={max} step={step} unit={unit} onChange={onChange} />
      </div>
      <Slider
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        valueText={`${value} ${unit}`}
        ends={[String(min), String(max)]}
        onChange={onChange}
      />
    </div>
  );
}

/** Two small options beside a label: which unit this measure is shown and typed in. */
function UnitSwitch<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { v: T; label: string; name: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <span
      className={k.units}
      role="radiogroup"
      aria-label={`${label} unit`}
      style={{ "--at": Math.max(0, options.findIndex((o) => o.v === value)) } as React.CSSProperties}
    >
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={o.v === value}
          aria-label={o.name}
          tabIndex={o.v === value ? 0 : -1}
          onClick={() => onChange(o.v)}
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
            e.preventDefault();
            const other = options.find((x) => x.v !== value) ?? o;
            onChange(other.v);
            (e.currentTarget.parentElement?.querySelector(`[aria-label="${other.name}"]`) as HTMLElement | null)?.focus();
          }}
          className={k.unitBtn}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

/** Feet and inches as two small boxes; the value is total inches. */
function FtInBox({
  id,
  inches,
  min,
  max,
  onChange,
}: {
  id: string;
  inches: number;
  min: number;
  max: number;
  onChange: (inches: number) => void;
}) {
  const total = Math.round(inches);
  const ft = Math.floor(total / 12);
  const inch = total % 12;
  const [dFt, setDFt] = useState<string | null>(null);
  const [dIn, setDIn] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const commit = (f: number, i: number, live: boolean) => {
    const t = f * 12 + i;
    if (!Number.isFinite(t)) return;
    if (!live) onChange(clamp(t));
    else if (t >= min && t <= max && i >= 0 && i < 12) onChange(t);
  };
  return (
    <span className={k.typeWrap}>
      <input
        id={id}
        aria-label="Feet"
        className={`${k.type} ${k.typeShort}`}
        onFocus={(e) => e.currentTarget.select()}
        type="number"
        inputMode="numeric"
        min={3}
        max={7}
        value={dFt ?? String(ft)}
        onChange={(e) => {
          setDFt(e.target.value);
          if (e.target.value !== "") commit(Number(e.target.value), inch, true);
        }}
        onBlur={() => {
          if (dFt !== null && dFt !== "") commit(Number(dFt), inch, false);
          setDFt(null);
        }}
      />
      <span className={k.typeUnit}>ft</span>
      <input
        aria-label="Inches"
        className={`${k.type} ${k.typeShort}`}
        onFocus={(e) => e.currentTarget.select()}
        type="number"
        inputMode="numeric"
        min={0}
        max={11}
        value={dIn ?? String(inch)}
        onChange={(e) => {
          setDIn(e.target.value);
          if (e.target.value !== "") commit(ft, Number(e.target.value), true);
        }}
        onBlur={() => {
          if (dIn !== null && dIn !== "") commit(ft, Math.min(11, Math.max(0, Number(dIn))), false);
          setDIn(null);
        }}
      />
      <span className={k.typeUnit}>in</span>
    </span>
  );
}

/**
 * Weight, height or waist, in whichever unit the visitor picks (mix and match, remembered on
 * this device). The value in and out is always kilograms or centimetres.
 */
export function MeasureField({
  kind,
  label,
  value,
  min,
  max,
  plain = false,
  onChange,
}: {
  kind: "weight" | "height" | "waist";
  label: string;
  /** kilograms for weight, centimetres for height and waist */
  value: number;
  min: number;
  max: number;
  /** a bare slider without graduations or end labels */
  plain?: boolean;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const units = useUnits();

  let head: ReactNode;
  let switcher: ReactNode;
  let slider: { value: number; min: number; max: number; step: number; ends: [string, string]; text: string; to: (v: number) => number };

  if (kind === "weight") {
    const u = units.weight;
    const dmin = Math.ceil(kgTo(min, u));
    const dmax = Math.floor(kgTo(max, u));
    const v = kgTo(value, u);
    slider = { value: Math.round(v), min: dmin, max: dmax, step: 1, ends: [String(dmin), String(dmax)], text: fmtWeight(value, u), to: (x) => toKg(x, u) };
    head = <NumberBox id={`${id}-n`} value={v} min={dmin} max={dmax} step={1} unit={u} onChange={(x) => onChange(toKg(x, u))} />;
    switcher = (
      <UnitSwitch
        label={label}
        value={u}
        onChange={(w) => {
          setUnits({ weight: w });
          // land on a whole number in the new unit, so the box never shows a long conversion
          onChange(toKg(Math.round(kgTo(value, w)), w));
        }}
        options={[
          { v: "kg", label: "kg", name: "Kilograms" },
          { v: "lb", label: "lb", name: "Pounds" },
        ]}
      />
    );
  } else if (kind === "height") {
    const u = units.height;
    if (u === "cm") {
      slider = { value: Math.round(value), min, max, step: 1, ends: [String(min), String(max)], text: fmtHeight(value, u), to: (x) => x };
      head = <NumberBox id={`${id}-n`} value={value} min={min} max={max} step={1} unit="cm" onChange={onChange} />;
    } else {
      const imin = Math.ceil(min / 2.54);
      const imax = Math.floor(max / 2.54);
      const now = Math.round(value / 2.54);
      slider = {
        value: now,
        min: imin,
        max: imax,
        step: 1,
        ends: [fmtHeight(imin * 2.54, "ftin"), fmtHeight(imax * 2.54, "ftin")],
        text: `${Math.floor(now / 12)} feet ${now % 12} inches`,
        to: (x) => x * 2.54,
      };
      head = <FtInBox id={`${id}-n`} inches={value / 2.54} min={imin} max={imax} onChange={(x) => onChange(x * 2.54)} />;
    }
    switcher = (
      <UnitSwitch
        label={label}
        value={u}
        onChange={(h) => {
          setUnits({ height: h });
          onChange(h === "cm" ? Math.round(value) : Math.round(value / 2.54) * 2.54);
        }}
        options={[
          { v: "cm", label: "cm", name: "Centimetres" },
          { v: "ftin", label: "ft", name: "Feet and inches" },
        ]}
      />
    );
  } else {
    const u = units.waist;
    const step = u === "in" ? 0.5 : 1;
    const dmin = u === "in" ? Math.ceil(cmTo(min, u)) : min;
    const dmax = u === "in" ? Math.floor(cmTo(max, u)) : max;
    const v = cmTo(value, u);
    slider = { value: Math.round(v / step) * step, min: dmin, max: dmax, step, ends: [String(dmin), String(dmax)], text: fmtLength(value, u), to: (x) => toCm(x, u) };
    head = <NumberBox id={`${id}-n`} value={v} min={dmin} max={dmax} step={0.1} unit={u} onChange={(x) => onChange(toCm(x, u))} />;
    switcher = (
      <UnitSwitch
        label={label}
        value={u}
        onChange={(w) => setUnits({ waist: w })}
        options={[
          { v: "cm", label: "cm", name: "Centimetres" },
          { v: "in", label: "in", name: "Inches" },
        ]}
      />
    );
  }

  return (
    <div className={b.field}>
      <div className={b.fieldHead}>
        <span className={k.labelRow}>
          <label htmlFor={`${id}-n`}>{label}</label>
          {switcher}
        </span>
        {head}
      </div>
      <Slider
        label={label}
        value={slider.value}
        min={slider.min}
        max={slider.max}
        step={slider.step}
        valueText={slider.text}
        ends={slider.ends}
        plain={plain}
        onChange={(x) => onChange(slider.to(x))}
      />
    </div>
  );
}

/** The weight unit on its own, for tools that show a weight without asking for one. */
export function WeightUnitToggle() {
  const units = useUnits();
  return (
    <UnitSwitch
      label="Weight"
      value={units.weight}
      onChange={(w) => setUnits({ weight: w })}
      options={[
        { v: "kg", label: "kg", name: "Kilograms" },
        { v: "lb", label: "lb", name: "Pounds" },
      ]}
    />
  );
}

/** A count with minus and plus, for adding portions. */
export function Stepper({ label, value, max = 6, onChange }: { label: string; value: number; max?: number; onChange: (v: number) => void }) {
  return (
    <span className={k.stepper}>
      <button type="button" aria-label={`One less: ${label}`} disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))}>
        <Minus size={14} weight="bold" />
      </button>
      <output className="num" aria-label={`${label}: ${value}`}>
        {value}
      </output>
      <button type="button" aria-label={`One more: ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus size={14} weight="bold" />
      </button>
    </span>
  );
}

/** A banded track with a marker: the shared read-out for every reading. */
export function BandTrack({
  min,
  max,
  value,
  bands,
  cuts,
  format = (c) => String(c),
}: {
  min: number;
  max: number;
  /** leave out to show the bands without a marker */
  value?: number;
  bands: { to: number; tone: 0 | 1 | 2 | 3 }[];
  cuts: number[];
  format?: (c: number) => string;
}) {
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
  const segs = bands.map((band, i) => {
    const from = i === 0 ? min : bands[i - 1].to;
    const left = pct(from);
    return { tone: band.tone, left, width: pct(Math.min(band.to, max)) - left };
  });
  return (
    <div className={k.trackWrap} aria-hidden="true">
      <div className={k.track}>
        {segs.map((g, i) => (
          <span key={i} className={k.band} data-tone={g.tone} style={{ left: `${g.left}%`, width: `${g.width}%` }} />
        ))}
        {value !== undefined && (
          <span className={k.slide} style={{ "--x": `${pct(value)}%` } as React.CSSProperties}>
            <i className={k.marker} />
          </span>
        )}
      </div>
      <div className={k.axis}>
        {cuts.map((c) => (
          <span key={c} className="num" style={{ left: `${pct(c)}%` }}>
            {format(c)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The close of every tool: the one action, two plain assurances and the fine print. */
export function NextStep({ fine, action = true }: { fine: ReactNode; action?: boolean }) {
  return (
    <div className={b.next}>
      {action && (
        <a href={ASSESSMENT_URL} className={`btn ${b.go}`}>
          <span>Book consultation</span>
          <span className="well" aria-hidden="true">
            <ArrowRight size={18} />
          </span>
        </a>
      )}
      <ul className={b.assure}>
        <li>
          <span className={b.badge} aria-hidden="true">
            <LockSimple size={15} />
          </span>
          Private to this device
        </li>
        <li>
          <span className={b.badge} aria-hidden="true">
            <Stethoscope size={15} />
          </span>
          Only a doctor can diagnose
        </li>
      </ul>
      <p className={`fineprint ${b.disclaim}`}>{fine}</p>
    </div>
  );
}
