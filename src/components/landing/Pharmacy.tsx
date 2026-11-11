import Image from "next/image";
import { CheckCircle, SealWarning } from "@phosphor-icons/react/dist/ssr";
import { Mask, Tag, Wordmark } from "./ui";
import s from "./Pharmacy.module.css";

/* A seal code drawn as a real 21-module matrix: three finder squares,
   timing rows, and a fixed pseudo-random body. It encodes nothing. */
function sealPath() {
  const N = 21;
  const on = (x: number, y: number) => {
    const finder = (fx: number, fy: number) => {
      const dx = x - fx;
      const dy = y - fy;
      if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null;
      const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      return ring !== 2;
    };
    for (const [fx, fy] of [
      [0, 0],
      [14, 0],
      [0, 14],
    ]) {
      const f = finder(fx, fy);
      if (f !== null) return f;
    }
    // quiet separators around the finders
    if ((x === 7 && (y < 8 || y > 12)) || (y === 7 && (x < 8 || x > 12)) || (x === 13 && y < 8) || (y === 13 && x < 8))
      return false;
    if (y === 6) return x % 2 === 0;
    if (x === 6) return y % 2 === 0;
    let h = (x * 73856093) ^ (y * 19349663) ^ 0x5bd1e995;
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    return ((h ^ (h >>> 15)) & 7) < 4;
  };
  let d = "";
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (on(x, y)) d += `M${x} ${y}h1v1h-1z`;
  return d;
}
export const SEAL = sealPath();

/* What a patient sees after scanning the seal on a pack from inrange’s pharmacy. Illustrative values. */
function Verify() {
  const rows: [string, string][] = [
    ["Source", "Licensed distributor"],
    ["Batch", "MX 2409 17"],
    ["Expiry", "03 / 2027"],
    ["Custody", "Logged to your door"],
  ];
  return (
    <div className={s.verify} suppressHydrationWarning data-reveal="draw">
      <div className={s.finder}>
        <p className={s.flabel}>What your scan shows</p>
        {/* the genuine-product sticker from the brand kit, as it sits on the pack */}
        <div className={s.sticker} aria-hidden="true">
          <Wordmark height={34} className={s.stickerMark} />
          <div className={s.target}>
          <svg className={s.code} viewBox="-1.5 -1.5 24 24" shapeRendering="crispEdges">
            <rect x="-1.5" y="-1.5" width="24" height="24" rx="1.2" className={s.codeBg} />
            <path d={SEAL} />
          </svg>
          <i className={`${s.corner} ${s.tl}`} />
          <i className={`${s.corner} ${s.tr}`} />
          <i className={`${s.corner} ${s.bl}`} />
          <i className={`${s.corner} ${s.br}`} />
          <i className={s.scanLine} />
          </div>
          <span className={s.stickerLabel}>Scan to verify</span>
        </div>
      </div>

      <div className={s.result}>
        <div className={s.vHead}>
          <CheckCircle size={22} weight="fill" className={s.ok} aria-hidden="true" />
          <div>
            <p className={s.vTitle}>Seal verified</p>
            <p className={s.vSub}>This pack matches its source and batch record</p>
          </div>
        </div>
        <dl className={s.vRows}>
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd className="num">{v}</dd>
            </div>
          ))}
          <div>
            <dt>Seal</dt>
            <dd className={s.intact}>Intact</dd>
          </div>
        </dl>
        <p className={s.vNote}>
          <SealWarning size={16} aria-hidden="true" />
          If anything does not match, leave the pack sealed and tell your care team.
        </p>
      </div>
    </div>
  );
}

export default function Pharmacy() {
  return (
    <section id="pharmacy" className={`section ${s.pharmacy}`} aria-labelledby="pharmacy-title">
      <div className="wrap">
        <div className={s.head}>
          <div className={s.titleCol}>
            <Tag>If medicine is prescribed</Tag>
            <Mask id="pharmacy-title" className={`h2 ${s.title}`} lines={[<>Our pharmacy, <span className="soft">or yours.</span></>]} />
          </div>
          <p className="lede" suppressHydrationWarning data-reveal="rise" style={{ "--d": "160ms" } as React.CSSProperties}>
            Not everyone is prescribed medicine. If you are, our licensed pharmacy sends it in a sealed pack. Scan the seal to
            check its batch, expiry and source, or use any licensed pharmacy you prefer.
          </p>
        </div>

        <div className={s.specimen}>
          <figure className={s.photo} suppressHydrationWarning data-reveal="wipe">
            <Image
              src="/img/pharmacy-pack-c.jpg"
              alt="A sealed white pharmacy box with a coded seal, in a grey felt envelope"
              fill
              sizes="(max-width: 1023px) 100vw, 46vw"
            />
          </figure>

          <div className={s.panel}>
            <Verify />
          </div>
        </div>
      </div>
    </section>
  );
}
