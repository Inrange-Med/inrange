import Image from "next/image";
import {
  BatteryFull,
  CalendarBlank,
  Check,
  CheckCircle,
  Microphone,
  Play,
  WifiHigh,
} from "@phosphor-icons/react/dist/ssr";
import ContourField from "./ContourField";
import { Dot, Mask, Tag } from "./ui";
import s from "./Companion.module.css";

const WAVE = [3, 6, 10, 7, 12, 16, 9, 5, 11, 14, 8, 4, 9, 13, 7, 10, 15, 6, 3, 8, 12, 5, 9, 4];

/** Hand-built iPhone 17 Pro: titanium band, side buttons, Dynamic Island, status bar, home indicator. */
function IPhone({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.device} suppressHydrationWarning data-reveal="thread">
      <span className={`${s.side} ${s.action}`} aria-hidden="true" />
      <span className={`${s.side} ${s.volUp}`} aria-hidden="true" />
      <span className={`${s.side} ${s.volDown}`} aria-hidden="true" />
      <span className={`${s.side} ${s.power}`} aria-hidden="true" />
      <span className={`${s.side} ${s.camera}`} aria-hidden="true" />
      <div className={s.bezel}>
        <div className={s.screen}>
          <div className={s.status} aria-hidden="true">
            <span className={s.time}>9:41</span>
            <span className={s.island}>
              <i />
            </span>
            <span className={s.sys}>
              {/* iOS draws signal as four rising bars */}
              <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden="true">
                <rect x="0" y="7" width="3" height="4" rx="1" />
                <rect x="4.5" y="5" width="3" height="6" rx="1" />
                <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
                <rect x="13.5" y="0" width="3" height="11" rx="1" />
              </svg>
              <WifiHigh size={17} weight="bold" />
              <BatteryFull size={25} weight="fill" />
            </span>
          </div>
          {children}
          <span className={s.home} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export default function Companion() {
  return (
    <section className={s.companion} aria-labelledby="companion-title">
      <ContourField className={s.field} density={8} lineAlpha={0.08} signalAlpha={0.3} seed={3} interactive={false} />
      {/* one grid: the words on the left (heading on two lines, client 18 Oct 2026), the phone on the
          right from the tag down, so the section ends where the list and the phone end together */}
      <div className={`wrap ${s.grid}`}>
        <div className={s.head}>
          <Tag dark>Between appointments</Tag>
          <Mask id="companion-title" className={`h2 ${s.title}`} lines={["Care that notices", "when things slip."]} soft={1} join={false} />
          <p className={s.lede} suppressHydrationWarning data-reveal="rise" style={{ "--d": "180ms" } as React.CSSProperties}>
            Your care team is in the app and on WhatsApp, and messages you first if you miss a check-in.
          </p>
        </div>
        <div className={s.copy}>
          <ul className={s.facts} suppressHydrationWarning data-reveal="rise" style={{ "--d": "280ms" } as React.CSSProperties}>
            <li>Reminders and short how-to videos in the app</li>
            <li>WhatsApp support in English, Hindi or Hinglish</li>
            <li>An AI care assistant for everyday questions, day or night</li>
            <li>Symptoms, medicines and anything unclear go to a doctor</li>
          </ul>
        </div>

        <figure className={s.phoneWrap}>
          <IPhone>
            <header className={s.bar}>
              <span className={s.avatar}>
                <Dot size={11} />
              </span>
              <span>
                <strong>Your care team</strong>
                <small>In the inrange app, and on WhatsApp</small>
              </span>
            </header>

            <div className={s.thread}>
              <p className={s.day} style={{ "--n": 0 } as React.CSSProperties}>
                Monday
              </p>

              <div className={`${s.msg} ${s.me} ${s.photo}`} style={{ "--n": 0 } as React.CSSProperties}>
                <span className={s.thumb}>
                  <Image src="/img/morning-scale-c.jpg" alt="" fill sizes="160px" style={{ objectPosition: "50% 72%" }} />
                </span>
                <p>Morning weight</p>
              </div>
              <p className={s.via} style={{ "--n": 0 } as React.CSSProperties}>
                Sent on WhatsApp
              </p>
              <p className={s.logged} style={{ "--n": 1 } as React.CSSProperties}>
                <CheckCircle size={13} weight="fill" /> Weight logged to your record
              </p>

              <div className={`${s.msg} ${s.me}`} style={{ "--n": 2 } as React.CSSProperties}>
                <div className={s.voice}>
                  <span className={s.play}>
                    <Play size={12} weight="fill" />
                  </span>
                  <span className={s.wave} aria-hidden="true">
                    {WAVE.map((h, i) => (
                      <i key={i} style={{ height: h }} />
                    ))}
                  </span>
                  <span className={s.len}>0:14</span>
                </div>
                <p className={s.transcript}>
                  <Microphone size={11} /> Diwali dinner at my in-laws this week. Plan ka kya karun?
                </p>
              </div>
              <p className={s.via} style={{ "--n": 2 } as React.CSSProperties}>
                Sent on WhatsApp, transcribed
              </p>

              <div className={`${s.msg} ${s.them}`} style={{ "--n": 3 } as React.CSSProperties}>
                <p className={s.who}>
                  Care assistant <span className={s.ai}>AI</span>
                </p>
                <p>Enjoy it. Keep protein at breakfast and walk after the big meals.</p>
              </div>

              <div className={`${s.msg} ${s.flag}`} style={{ "--n": 4 } as React.CSSProperties}>
                <p className={s.flagHead}>Time for a short review</p>
                <p>Your doctor would like a quick review.</p>
                <div className={s.slot}>
                  <CalendarBlank size={15} />
                  <span>Friday, 6:30 pm</span>
                  <span className={s.book}>Book</span>
                </div>
              </div>

              <div className={`${s.msg} ${s.me}`} style={{ "--n": 5 } as React.CSSProperties}>
                <p>Friday works, thank you.</p>
                <span className={s.read} aria-hidden="true">
                  <Check size={11} />
                  <Check size={11} />
                </span>
              </div>
            </div>
          </IPhone>
        </figure>
      </div>
    </section>
  );
}
