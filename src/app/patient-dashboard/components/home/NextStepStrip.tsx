"use client";

/*
  Home's strip (Arhaan HomeView pillFor): the one thing to look at next as a single tappable line,
  with Chat beside it. The line follows the patient's real consultations: join the call when it is
  open, the next consultation's day and time, or the next thing to do (book, or choose a plan).
*/

import type { ReactNode } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  CaretRight,
  ChatCircleText,
  Stethoscope,
  VideoCamera,
} from "@phosphor-icons/react";
import { clockTime, isCallJoinable } from "@/lib/format/dateTime";
import type { Appointment } from "@/types/appointment";
import {
  consultationMinutes,
  dayLabel,
  doctorShortName,
  type CareStage,
} from "./careStage";
import styles from "./NextStepStrip.module.css";

type NextStep = {
  tone?: "join" | "act";
  icon: ReactNode;
  title: string;
  sub: string;
  /** the same two lines for a phone under 390px, short enough to read in full */
  short?: { title: string; sub: string };
  href: string;
};

function nextStepFor(
  upcoming: Appointment | null,
  stage: CareStage,
  now: number,
): NextStep {
  if (upcoming) {
    const doctor = doctorShortName(upcoming.doctorName);
    const who = doctor ?? "With a doctor";
    const minutes = consultationMinutes(upcoming);
    if (isCallJoinable(upcoming.startsAt, minutes, now)) {
      return {
        tone: "join",
        icon: <VideoCamera size={20} weight="fill" />,
        title: "Join the video call",
        sub: `${who}, it is open now`,
        href: `/consultation/${upcoming.id}`,
      };
    }
    const starts = new Date(upcoming.startsAt);
    const day = dayLabel(upcoming.startsAt);
    const time = clockTime(starts);
    const opens = clockTime(new Date(starts.getTime() - 10 * 6e4));
    const today = day === "Today";
    return {
      icon: <VideoCamera size={20} />,
      title: `${day}, ${time}`,
      sub: today
        ? `${doctor ? `${doctor}, join` : "Join"} opens at ${opens}`
        : `${who}, by video`,
      short: today
        ? { title: `Today, ${time}`, sub: `Join opens at ${opens}` }
        : { title: day, sub: `${time}, ${doctor ?? "by video"}` },
      href: "/patient-dashboard/appointments",
    };
  }
  if (stage === "choose-plan") {
    return {
      tone: "act",
      icon: <Stethoscope size={20} />,
      title: "Review your plan",
      sub: "After your consultation",
      href: "/patient-dashboard/plans",
    };
  }
  return {
    tone: "act",
    icon: <CalendarPlus size={20} />,
    title: "Book a consultation",
    sub:
      stage === "in-programme"
        ? "With your doctor, by video"
        : "By video, with a doctor",
    href: "/patient-dashboard/appointments/book",
  };
}

export default function NextStepStrip({
  upcoming,
  stage,
  now,
}: {
  upcoming: Appointment | null;
  stage: CareStage;
  now: number;
}) {
  const step = nextStepFor(upcoming, stage, now);
  return (
    <div className={styles.strip} data-tone={step.tone}>
      <Link href={step.href} className={styles.pill} data-tone={step.tone}>
        <span className={styles.pillIcon} aria-hidden="true">
          {step.icon}
        </span>
        <span className={styles.pillText}>
          <strong className={step.short ? styles.full : undefined}>
            {step.title}
          </strong>
          <span className={step.short ? styles.full : undefined}>
            {step.sub}
          </span>
          {step.short && (
            <>
              <strong className={styles.compact}>{step.short.title}</strong>
              <span className={styles.compact}>{step.short.sub}</span>
            </>
          )}
        </span>
        <CaretRight size={18} className={styles.pillGo} aria-hidden="true" />
      </Link>
      <Link
        href="/patient-dashboard/messages"
        className={styles.chat}
        aria-label="Chat with your care team"
      >
        <ChatCircleText size={20} aria-hidden="true" />
        <span aria-hidden="true">Chat</span>
      </Link>
    </div>
  );
}
