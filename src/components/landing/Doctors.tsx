import Image from "next/image";
import { ArrowRight, HouseLine, SealCheck, ShieldCheck, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import { Mask, Tag } from "./ui";
import { LISTED_DOCTORS } from "./doctor-data";
import DoctorBench from "./DoctorBench";
import s from "./Doctors.module.css";

export const FACTS = [
  {
    icon: SealCheck,
    lead: "Registered doctors.",
    text: "Physicians, each registered with the National Medical Commission or a State Medical Council.",
  },
  {
    icon: ShieldCheck,
    lead: "Independent prescribing.",
    text: "Only your doctor prescribes, and only when it is clinically appropriate. Doctors are never paid per prescription.",
  },
  {
    icon: VideoCamera,
    lead: "By video, anywhere in India.",
    text: "A secure video call from home or work, with no waiting room.",
  },
  {
    icon: HouseLine,
    lead: "Blood tests at home.",
    text: "Upload a report from the last three months, or a lab collects samples at your door. Results go straight to your doctor.",
  },
];

/** An instrument dial: a graduated bezel around the icon, drawn once on arrival. */
export function Dial({ icon: Icon }: { icon: typeof SealCheck }) {
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
    <section id="doctors" className={`section ${s.doctors}`} aria-labelledby="doctors-title">
      <div className={`wrap ${s.grid}`}>
        <figure className={s.consult} suppressHydrationWarning data-reveal="wipe">
          <Image
            src="/img/consult-call-c.jpg"
            alt="A physician in his fifties on a video consultation, his patient on the laptop screen"
            fill
            sizes="(max-width: 1023px) 100vw, 60vw"
          />
        </figure>

        <div className={s.copy}>
          <Tag>Your doctor</Tag>
          <Mask id="doctors-title" className="h2" lines={["A doctor who", "knows your file."]} soft={1} />
          <p className="lede" suppressHydrationWarning data-reveal="rise" style={{ "--d": "160ms" } as React.CSSProperties}>
            The doctor who writes your plan stays with you for the whole programme.
          </p>
          <a href="/doctors" className={s.more} suppressHydrationWarning data-reveal="rise" style={{ "--d": "220ms" } as React.CSSProperties}>
            Meet the doctors
            <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>


        {LISTED_DOCTORS.length > 0 && <DoctorBench doctors={LISTED_DOCTORS} />}

        <dl className={s.facts}>
          {FACTS.map((f, i) => (
            <div key={f.lead} className={s.fact} suppressHydrationWarning data-reveal="rise" style={{ "--d": `${i * 70}ms` } as React.CSSProperties}>
              <Dial icon={f.icon} />
              <dt>{f.lead}</dt>
              <dd>{f.text}</dd>
            </div>
          ))}
        </dl>

      </div>
    </section>
  );
}
