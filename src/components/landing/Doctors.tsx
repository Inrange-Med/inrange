import Image from "next/image";
import { HouseLine, SealCheck, ShieldCheck, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import { Mask, Tag } from "./ui";
import s from "./Doctors.module.css";

const FACTS = [
  {
    icon: SealCheck,
    lead: "Registered doctors.",
    text: "A panel of more than 50 physicians and diabetes specialists, each registered with the National Medical Commission or a State Medical Council.",
  },
  {
    icon: ShieldCheck,
    lead: "Independent prescribing.",
    text: "Your doctor alone decides what, if anything, you are prescribed. Doctors are never paid per prescription.",
  },
  {
    icon: VideoCamera,
    lead: "By video, anywhere in India.",
    text: "A secure video call from home or work. The first consultation takes 15 minutes and is free, with no waiting room and no drive across the city.",
  },
  {
    icon: HouseLine,
    lead: "Blood tests at home.",
    text: "A partner lab collects samples at your door, and the results go straight into your record for your doctor.",
  },
];

/** An instrument dial: a graduated bezel around the icon, drawn once on arrival. */
function Dial({ icon: Icon }: { icon: typeof SealCheck }) {
  return (
    <span className={s.dial} aria-hidden="true">
      <svg className={s.bezel} viewBox="0 0 52 52">
        <circle className={s.ring} cx="26" cy="26" r="25.25" />
        {Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * Math.PI * 2 - Math.PI / 2;
          const r2 = 23;
          const r1 = i % 9 === 0 ? 19.5 : 21.25;
          const c = (v: number) => Math.round(v * 100) / 100;
          return (
            <line
              key={i}
              className={i % 9 === 0 ? s.major : s.minor}
              x1={c(26 + Math.cos(a) * r1)}
              y1={c(26 + Math.sin(a) * r1)}
              x2={c(26 + Math.cos(a) * r2)}
              y2={c(26 + Math.sin(a) * r2)}
              style={{ "--t": i } as React.CSSProperties}
            />
          );
        })}
      </svg>
      <Icon size={22} weight="light" />
    </span>
  );
}

export default function Doctors() {
  return (
    <section className={`section ${s.doctors}`} aria-labelledby="doctors-title">
      <div className={`wrap ${s.grid}`}>
        <figure className={s.consult} data-reveal="wipe">
          <Image
            src="/img/consult-call.jpg"
            alt="A physician in his fifties on a video consultation, his patient on the laptop screen"
            fill
            sizes="(max-width: 1023px) 100vw, 60vw"
          />
          <figcaption className={s.cap}>
            <span>AI illustration.</span> <span>Not an InRange doctor.</span>
          </figcaption>
        </figure>

        <div className={s.copy}>
          <Tag>Your doctor</Tag>
          <Mask id="doctors-title" className="h2" lines={["A doctor who", "knows your file."]} />
          <p className="lede" data-reveal="rise" style={{ "--d": "160ms" } as React.CSSProperties}>
            Every plan is written by a doctor after your first consultation, which is free, and the same doctor stays with you for the length
            of your programme.
          </p>
        </div>

        <dl className={s.facts}>
          {FACTS.map((f, i) => (
            <div key={f.lead} className={s.fact} data-reveal="rise" style={{ "--d": `${i * 70}ms` } as React.CSSProperties}>
              <Dial icon={f.icon} />
              <dt>{f.lead}</dt>
              <dd>{f.text}</dd>
            </div>
          ))}
        </dl>

        <figure className={s.labs} data-reveal="wipe" style={{ "--d": "120ms" } as React.CSSProperties}>
          <Image
            src="/img/home-kit.jpg"
            alt="A home blood collection kit laid out on a dining table"
            fill
            sizes="(max-width: 1023px) 100vw, 34vw"
          />
        </figure>
      </div>
    </section>
  );
}
