import s from "./MeasurePlates.module.css";

/*
 * Technical plates for "What we measure". Drawn like instrument diagrams:
 * precise linework, leader-line callouts, one mint accent for the reading
 * that matters. Every value is illustrative, and nothing shows a change over
 * time, so no plate implies an outcome.
 */

type Pt = [number, number];
const f1 = (n: number) => n.toFixed(1);
const toPath = (pts: Pt[], close = false) =>
  pts.map((p, i) => `${i ? "L" : "M"}${f1(p[0])} ${f1(p[1])}`).join(" ") + (close ? " Z" : "");
const style = (vars: Record<string, string | number>) => vars as React.CSSProperties;
// Catmull-Rom through the samples, written as cubic Beziers: no corners anywhere
const toSmooth = (pts: Pt[]) => {
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d;
};

/* ------------------------------------------------------------------ */
/* Waist: a transverse section of the torso at the navel, front at top. */

const CX = 180;
const CY = 172;
const RX = 116;
const RY = 86;

// one shape function drives every layer, so the contours stay concentric
function torso(scale: number, flatten = 1, steps = 180): Pt[] {
  const pts: Pt[] = [];
  for (let k = 0; k < steps; k++) {
    const t = -Math.PI + (k / steps) * Math.PI * 2;
    const front = Math.max(0, -Math.sin(t)); // belly bulges forward
    const back = Math.max(0, Math.sin(t)); // back is flatter
    const spine = Math.exp(-Math.pow((t - Math.PI / 2) / 0.17, 2));
    const f = (0.06 * front ** 2 - 0.07 * back ** 3) * flatten - 0.08 * spine * flatten;
    pts.push([CX + RX * scale * Math.cos(t) * (1 + f), CY + RY * scale * Math.sin(t) * (1 + f)]);
  }
  return pts;
}

const SKIN = torso(1);
const WALL = torso(0.83, 0.6);
const CAVITY = torso(0.64, 0.45);
const ISO = [0.5, 0.37, 0.24].map((k) => torso(k, 0.3));
const TAPE = torso(1.075);

// tape ticks, evenly spaced along the tape's own length
function tapeTicks(): { a: Pt; b: Pt; major: boolean }[] {
  const pts = [...TAPE, TAPE[0]];
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = lens[lens.length - 1];
  const n = 72;
  const out: { a: Pt; b: Pt; major: boolean }[] = [];
  for (let j = 0; j < n; j++) {
    const L = (j / n) * total;
    let i = lens.findIndex((l) => l >= L);
    if (i < 1) i = 1;
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const u = (L - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
    const x = p0[0] + (p1[0] - p0[0]) * u;
    const y = p0[1] + (p1[1] - p0[1]) * u;
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const m = Math.hypot(dx, dy) || 1;
    const nx = dy / m; // outward normal for a clockwise contour in screen space
    const ny = -dx / m;
    const major = j % 6 === 0;
    const len = major ? 6 : 3.5;
    out.push({ a: [x, y], b: [x - nx * len, y - ny * len], major });
  }
  return out;
}
const TICKS = tapeTicks();
const top = (pts: Pt[]) => pts.reduce((a, p) => (p[1] < a[1] ? p : a));
const TAPE_TOP = top(TAPE);
// the "tape" callout lands on the tape itself, clear of the buckle
const TAPE_PIN = TAPE.filter((p) => p[1] < TAPE_TOP[1] + 20).reduce((a, p) =>
  Math.abs(p[0] - (TAPE_TOP[0] - 24)) < Math.abs(a[0] - (TAPE_TOP[0] - 24)) ? p : a,
);
const SKIN_TOP = top(SKIN);
const at = (pts: Pt[], deg: number) => pts[Math.round(((deg + 180) / 360) * pts.length) % pts.length];

export function WaistPlate() {
  const subPoint = at(torso(0.915), -14); // between skin and muscle wall, front right
  const visPoint = at(torso(0.42, 0.3), 32); // inside the abdominal cavity
  return (
    <svg viewBox="0 0 360 320" className={s.plate} role="img" aria-label="Cross-section of the waist at the navel, showing the tape, the fat under the skin and the visceral fat around the organs">
      <path d={toPath(SKIN, true)} className={`${s.skin} ${s.draw}`} pathLength={1} />
      {/* the muscle wall, drawn over the fat so the fat reads as its own layer */}
      <path d={toPath(WALL, true)} className={`${s.wallFill} ${s.fade}`} style={style({ "--dl": "250ms" })} />
      <path d={toPath(CAVITY, true)} className={`${s.cavity} ${s.fade}`} style={style({ "--dl": "500ms" })} />
      <path d={toPath(WALL, true)} className={`${s.wall} ${s.draw}`} pathLength={1} style={style({ "--dl": "200ms" })} />
      <path d={toPath(CAVITY, true)} className={`${s.cavityLine} ${s.draw}`} pathLength={1} style={style({ "--dl": "350ms" })} />
      {ISO.map((p, i) => (
        <path key={i} d={toPath(p, true)} className={`${s.iso} ${s.draw}`} pathLength={1} style={style({ "--dl": `${500 + i * 120}ms` })} />
      ))}
      {/* vertebra at the back */}
      <g className={s.fade} style={style({ "--dl": "700ms" })}>
        <rect x={CX - 1.6} y={CY + RY * 0.72 + 6} width="3.2" height={RY * 0.2} rx="1.6" className={s.bone} />
        <circle cx={CX} cy={CY + RY * 0.72} r="9" className={s.bone} />
      </g>
      {/* navel */}
      <circle cx={SKIN_TOP[0]} cy={SKIN_TOP[1] + 5} r="2.4" className={`${s.navel} ${s.fade}`} style={style({ "--dl": "700ms" })} />

      {/* the tape and its scale */}
      <path d={toPath(TAPE, true)} className={`${s.tape} ${s.draw}`} pathLength={1} style={style({ "--dl": "650ms", "--dur": "1700ms" })} />
      <g className={s.fade} style={style({ "--dl": "1500ms" })}>
        {TICKS.map((t, i) => (
          <line key={i} x1={f1(t.a[0])} y1={f1(t.a[1])} x2={f1(t.b[0])} y2={f1(t.b[1])} className={t.major ? s.tickMajor : s.tick} />
        ))}
        <rect x={TAPE_TOP[0] - 9} y={TAPE_TOP[1] - 5.5} width="18" height="11" rx="3" className={s.tab} />
        <circle cx={TAPE_TOP[0] + 3} cy={TAPE_TOP[1]} r="2.2" className={s.signal} />
      </g>

      {/* callouts */}
      <g className={s.label} style={style({ "--dl": "1750ms" })}>
        <path
          d={`M${f1(TAPE_PIN[0])} ${f1(TAPE_PIN[1])} V ${f1(TAPE_TOP[1] - 10)} H 112 L 96 32 H 22`}
          className={s.leader}
        />
        <circle cx={f1(TAPE_PIN[0])} cy={f1(TAPE_PIN[1])} r="2" className={s.leaderEnd} />
        <text x="22" y="24" className={s.txt}>
          Tape at the navel
        </text>

        <path d={`M${f1(subPoint[0])} ${f1(subPoint[1])} L 304 70 L 338 70`} className={s.leader} />
        <circle cx={f1(subPoint[0])} cy={f1(subPoint[1])} r="2" className={s.leaderEnd} />
        <text x="338" y="62" textAnchor="end" className={s.txt}>
          Fat under the skin
        </text>

        <path d={`M${f1(visPoint[0])} ${f1(visPoint[1])} L 262 292 L 338 292`} className={s.leader} />
        <circle cx={f1(visPoint[0])} cy={f1(visPoint[1])} r="2" className={s.leaderEndOn} />
        <text x="338" y="284" textAnchor="end" className={s.txtOn}>
          Visceral fat
        </text>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Weight: one week of morning readings against their seven-day average. */

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const READ = [0.35, -0.45, 0.15, -0.3, 0.5, -0.1, 2.15]; // Sunday follows a late dinner
const AVG = READ.reduce((a, b) => a + b, 0) / READ.length;
const WX = (i: number) => 74 + i * 42;
const WY = (v: number) => 170 - v * 30;

export function WeightPlate() {
  const ay = WY(AVG);
  return (
    <svg viewBox="0 0 360 300" className={s.plate} role="img" aria-label="Seven daily weight readings scattered around a steady seven-day average, with one high Sunday reading after a late dinner">
      {/* the value scale: one tick per quarter unit, a long tick per unit, on the same scale as the dots */}
      <g className={s.fade}>
        {Array.from({ length: 17 }, (_, i) => {
          const v = -1.25 + i * 0.25;
          return <line key={i} x1={Number.isInteger(v) ? 26 : 32} x2="38" y1={WY(v)} y2={WY(v)} className={s.rule} />;
        })}
      </g>
      <rect x="52" y={ay - 7} width="292" height="14" rx="7" className={`${s.band} ${s.grow}`} />
      <line x1="52" x2="344" y1={ay} y2={ay} className={`${s.avg} ${s.draw}`} pathLength={1} style={style({ "--dl": "250ms" })} />
      {READ.map((v, i) => (
        <g key={i} className={s.pop} style={style({ "--i": i })}>
          <line x1={WX(i)} x2={WX(i)} y1={ay} y2={WY(v)} className={s.stem} />
          {i === 6 ? (
            <>
              <circle cx={WX(i)} cy={WY(v)} r="7" className={s.ring} />
              <circle cx={WX(i)} cy={WY(v)} r="2.6" className={s.signal} />
            </>
          ) : (
            <circle cx={WX(i)} cy={WY(v)} r="4.2" className={s.dot} />
          )}
        </g>
      ))}
      <g className={s.label} style={style({ "--dl": "1200ms" })}>
        <text x="52" y={ay - 16} className={s.txtOn}>
          Seven-day average
        </text>
        <path d={`M${WX(6)} ${WY(READ[6]) - 8} L ${WX(6)} 58 L 300 58`} className={s.leader} />
        <text x="292" y="62" textAnchor="end" className={s.txt}>
          One heavy morning
        </text>
      </g>
      {DAYS.map((d, i) => (
        <text key={i} x={WX(i)} y="266" textAnchor="middle" className={s.axis}>
          {d}
        </text>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Blood sugar: one day of sensor readings against the 70 to 180 mg/dL range. */

const GX = (t: number) => 56 + t * 286;
const GY = (v: number) => 216 - (v - 70);
// meal time, rise width, height
const MEALS: [number, number, number, string][] = [
  [0.14, 0.06, 58, "Breakfast"],
  [0.42, 0.07, 48, "Lunch"],
  [0.76, 0.08, 104, "Dinner"],
];
function glucose(): Pt[] {
  return Array.from({ length: 97 }, (_, i) => {
    const t = i / 96;
    // lognormal humps: a quick rise after each meal and a long, gentle tail
    const rise = MEALS.reduce((a, [m, w, h]) => a + (t > m ? h * Math.exp(-(Math.log((t - m) / w) ** 2) / (2 * 0.45 ** 2)) : 0), 0);
    const drift = 1.6 * Math.sin(i * 0.23 + 1.1) + 1.1 * Math.sin(i * 0.61 + 2.7);
    return [GX(t), GY(98 + rise + drift)];
  });
}
const TRACE = glucose();
const PEAK = TRACE.reduce((a, p) => (p[1] < a[1] ? p : a));

export function GlucosePlate() {
  return (
    <svg viewBox="0 0 360 300" className={s.plate} role="img" aria-label="One day of blood sugar readings inside the 70 to 180 mg/dL target range, rising above it after dinner">
      <rect x="56" y={GY(180)} width="286" height={GY(70) - GY(180)} rx="6" className={`${s.range} ${s.grow}`} />
      <line x1="56" x2="342" y1={GY(180)} y2={GY(180)} className={s.limit} />
      <line x1="56" x2="342" y1={GY(70)} y2={GY(70)} className={s.limit} />
      <text x="46" y={GY(180) + 4} textAnchor="end" className={s.axis}>
        180
      </text>
      <text x="46" y={GY(180) - 16} textAnchor="end" className={s.unit}>
        mg/dL
      </text>
      <text x="46" y={GY(70) + 4} textAnchor="end" className={s.axis}>
        70
      </text>
      <text x="64" y={GY(70) - 9} className={`${s.txtOn} ${s.label}`} style={style({ "--dl": "900ms" })}>
        Target range
      </text>
      {MEALS.map(([m, , , name]) => (
        <g key={name}>
          <line x1={GX(m)} x2={GX(m)} y1={GY(70) + 2} y2={GY(70) + 9} className={s.rule} />
          <text x={GX(m)} y="266" textAnchor="middle" className={s.axis}>
            {name}
          </text>
        </g>
      ))}
      <path d={toSmooth(TRACE)} className={`${s.trace} ${s.draw}`} pathLength={1} style={style({ "--dl": "300ms", "--dur": "1900ms" })} />
      <g className={s.label} style={style({ "--dl": "1700ms" })}>
        <circle cx={f1(PEAK[0])} cy={f1(PEAK[1])} r="6.5" className={s.ring} />
        <path d={`M${f1(PEAK[0] - 7)} ${f1(PEAK[1])} L ${f1(PEAK[0] - 28)} ${f1(PEAK[1])} L ${f1(PEAK[0] - 40)} 46 L 150 46`} className={s.leader} />
        <text x="150" y="40" className={s.txt}>
          Above range after dinner
        </text>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Protein: one day's target, built meal by meal from food already on the table. */

const PX = (g: number) => 40 + g * 3.75;
const PROTEIN_TARGET = 70;
// meal, what it was, grams
const PLATES: [string, string, number][] = [
  ["Breakfast", "besan chilla", 16],
  ["Lunch", "dal and paneer", 26],
  ["Snack", "curd", 8],
  ["Dinner", "chicken or rajma", 22],
];
const PROTEIN_ROWS = PLATES.reduce<{ name: string; food: string; g: number; from: number; y: number }[]>((rows, [name, food, g], i) => {
  const from = i ? rows[i - 1].from + rows[i - 1].g : 0;
  return [...rows, { name, food, g, from, y: 52 + i * 46 }];
}, []);
const PROTEIN_TOTAL = PLATES.reduce((a, p) => a + p[2], 0);

export function ProteinPlate() {
  const totalY = 236;
  return (
    <svg
      viewBox="0 0 360 300"
      className={s.plate}
      role="img"
      aria-label={`One day of protein built across four meals, besan chilla, dal and paneer, curd, and chicken or rajma, reaching a daily target of ${PROTEIN_TARGET} grams`}
    >
      <line x1={PX(PROTEIN_TARGET)} x2={PX(PROTEIN_TARGET)} y1="30" y2={totalY + 20} className={s.limit} />
      <text x={PX(PROTEIN_TARGET) + 6} y="20" textAnchor="end" className={`${s.txtOn} ${s.label}`} style={style({ "--dl": "1500ms" })}>
        Daily target, {PROTEIN_TARGET} g
      </text>
      {PROTEIN_ROWS.map((r, i) => (
        <g key={r.name}>
          {i > 0 && (
            <line x1={PX(r.from)} x2={PX(r.from)} y1={r.y - 34} y2={r.y + 12} className={`${s.stem} ${s.fade}`} style={style({ "--dl": `${250 + i * 160}ms` })} />
          )}
          {/* drawn after the leader line, with a halo of the plate's surface, so the line passes behind the words */}
          <text x="40" y={r.y - 9} className={`${s.txt} ${s.label} ${s.halo}`} style={style({ "--dl": `${300 + i * 160}ms` })}>
            {r.name} <tspan className={s.axis}>· {r.food}</tspan>
          </text>
          <rect x={PX(r.from)} y={r.y} width={r.g * 3.75} height="12" rx="6" className={`${s.dot} ${s.grow}`} style={style({ "--dl": `${300 + i * 160}ms` })} />
          <text x={PX(r.from + r.g) + 8} y={r.y + 10.5} className={`${s.axis} ${s.label}`} style={style({ "--dl": `${600 + i * 160}ms` })}>
            {r.g} g
          </text>
        </g>
      ))}
      <rect x={PX(0)} y={totalY} width={PROTEIN_TOTAL * 3.75} height="12" rx="6" className={`${s.signal} ${s.grow}`} style={style({ "--dl": "1100ms" })} />
      <text x="40" y={totalY - 9} className={`${s.txtOn} ${s.label}`} style={style({ "--dl": "1300ms" })}>
        Across the day, {PROTEIN_TOTAL} g
      </text>
      {[0, 20, 40, 60, 80].map((g) => (
        <g key={g}>
          <line x1={PX(g)} x2={PX(g)} y1={totalY + 24} y2={totalY + 30} className={s.rule} />
          <text x={PX(g)} y={totalY + 48} textAnchor="middle" className={s.axis}>
            {g ? g : "0 g"}
          </text>
        </g>
      ))}
    </svg>
  );
}
