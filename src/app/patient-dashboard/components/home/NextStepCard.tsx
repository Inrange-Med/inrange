"use client";

/*
  Home's one card (doctor portal v2 PRD, "The next-step card, stage by stage"): what to do now, in words,
  and at most one button. Whenever something costs money, the itemised bill sits on the card above Pay.
  The stage comes from the backend (GET /api/patient/next-step), so the app and WhatsApp never disagree.
*/

import Link from "next/link";
import { ArrowRight, VideoCamera } from "@phosphor-icons/react";
import { checkoutHref } from "@/lib/payments/checkoutHref";
import {
  clockTime,
  combineDateAndTime,
  relativeDayName,
  shortDate,
} from "@/lib/format/dateTime";
import { formatRupees } from "@/lib/format/money";
import type { Bill, NextStep } from "@/types/patientHome";
import ItemisedBill from "../ItemisedBill";
import styles from "./NextStepCard.module.css";

type Action = { label: string; href: string; icon?: "video" };
type Words = {
  title: string;
  text?: string;
  bill?: Bill;
  action?: Action;
  /** a small way on, under the card's words (never a second big button) */
  quiet?: { label: string; href: string };
};

/** "Today, 7 pm", "Tomorrow, 9:30 am", "Thu 19 Nov, 7 pm" */
const when = (iso: string) => {
  const day = relativeDayName(iso);
  return `${day === "Today" || day === "Tomorrow" ? day : `${day} ${shortDate(iso)}`}, ${clockTime(new Date(iso))}`;
};
const doctor = (name: string) =>
  name ? (/^dr\.?\s/i.test(name) ? name : `Dr. ${name}`) : "your doctor";
const rupees = (paise: number) => formatRupees(Math.round(paise) / 100);
const HOME = "/patient-dashboard";

function wordsFor(step: NextStep): Words {
  switch (step.stage) {
    case "CALL_OPEN":
      return {
        title: `Your video call with ${doctor(step.appointment.doctorName)} is open`,
        text: when(step.appointment.startsAt),
        action: {
          label: "Join video call",
          href: `/consultation/${step.appointment.id}`,
          icon: "video",
        },
      };
    case "CALL_BOOKED":
      return {
        title: `Video call with ${doctor(step.appointment.doctorName)}`,
        text: `${when(step.appointment.startsAt)}. Join opens at ${clockTime(new Date(step.appointment.joinOpensAt))}.`,
      };
    case "AFTER_CALL":
      return {
        title: "Your doctor is writing your prescription",
        text: "It comes to you here and on WhatsApp.",
      };
    case "PRESCRIPTION_SENT":
      return {
        title: "Your prescription is ready",
        text: `From ${doctor(step.prescription.doctorName)}, ${shortDate(step.prescription.sentAt)}.`,
        action: {
          label: "View prescription",
          href: `${HOME}/prescriptions?rx=${step.prescription.id}`,
        },
      };
    case "PAYMENT_DUE": {
      const plan = step.payFor === "PLAN";
      const total = rupees(step.bill.totalPaise);
      return {
        title: plan
          ? "Your plan"
          : step.withPlan
            ? "Your plan and medicines"
            : "Your medicines",
        text: plan
          ? "The plan your care team recommended."
          : step.withPlan
            ? "As your doctor prescribed, in one payment. Medicines delivered to your door."
            : "As your doctor prescribed. Delivered to your door.",
        bill: step.bill,
        action: {
          label: `Pay ${total}`,
          href: plan
            ? checkoutHref({
                purpose: "PLAN",
                referenceId: step.referenceId,
                returnTo: HOME,
                payNow: true,
              })
            : step.hasAddress
              ? checkoutHref({
                  purpose: "MEDICINE_ORDER",
                  referenceId: step.referenceId,
                  returnTo: HOME,
                  payNow: true,
                })
              : `${HOME}/care/cart`,
        },
        quiet: plan
          ? undefined
          : {
              label: "Change the address or quantities",
              href: `${HOME}/care/cart`,
            },
      };
    }
    case "ON_THE_WAY":
      return {
        title: "Your medicines are on the way",
        text: step.order.expectedAt
          ? `Arriving ${when(step.order.expectedAt).split(",")[0]}.`
          : "We'll tell you when they are out for delivery.",
        action: {
          label: "Track delivery",
          href: `${HOME}/care?order=${step.order.id}`,
        },
      };
    case "DELIVERED":
      return {
        title: "Your medicines arrived",
        text: `Delivered ${when(step.order.deliveredAt)}. How to take them is on your prescription.`,
        action: step.prescription
          ? {
              label: "View prescription",
              href: `${HOME}/prescriptions?rx=${step.prescription.id}`,
            }
          : undefined,
      };
    case "BLOOD_TEST_NEEDED":
      return {
        title: "Book your home blood test, or upload a recent report",
        text: "Your doctor reads it before your video call.",
        action: { label: "Book home test", href: "/onboarding?step=report" },
        quiet: { label: "Upload a report instead", href: `${HOME}/reports` },
      };
    case "LAB_UNPAID": {
      const c = step.collection;
      return {
        title: "Pay to confirm your home collection",
        text: c
          ? `Sample collection ${collectionWords(c)}, held for you.`
          : "Your collection time is held for you.",
        bill: step.bill,
        action: {
          label: `Pay ${rupees(step.bill.totalPaise)}`,
          href: checkoutHref({
            purpose: "LAB_BOOKING",
            referenceId: step.labBookingId,
            returnTo: HOME,
            payNow: true,
          }),
        },
      };
    }
    case "TEST_BOOKED":
      return {
        title: step.collection
          ? `Sample collection ${collectionWords(step.collection)}`
          : "Your blood test is booked",
        text: step.collectorName
          ? `${step.collectorName} from the lab comes to you.`
          : "Someone from the lab comes to you at that time.",
        quiet: {
          label: "See your booking",
          href: `${HOME}/lab-tests/${encodeURIComponent(step.labBookingId)}`,
        },
      };
    case "WAITING_FOR_REPORT":
      return {
        title: "Your report is being prepared",
        text: "The lab sends it straight to our medical team.",
      };
    case "UNDER_REVIEW":
      return {
        title: "Your report is ready",
        text: "Our medical team is reading it. We'll tell you when to book your doctor.",
        action: { label: "View report", href: `${HOME}/reports` },
      };
    case "NOT_APPROVED":
      return {
        title: "Please upload a newer report",
        text: step.note || "Our medical team could not use this report.",
        action: { label: "Upload a newer report", href: `${HOME}/reports` },
      };
    case "BOOK_CONSULTATION":
      return {
        title: "Book your video call with a doctor",
        text: "Our medical team has read your report.",
        action: { label: "Book video call", href: `${HOME}/appointments/book` },
      };
    case "IN_CARE":
      return {
        title: "You're all set",
        text: "Your doctor reviews your care every month. Book the next review when it suits you.",
        action: {
          label: "Book your review",
          href: `${HOME}/appointments/book`,
        },
      };
  }
}

/** "Thu 19 Nov, 7 to 9 am" */
function collectionWords(c: {
  date: string;
  from: string | null;
  to: string | null;
}) {
  const at = combineDateAndTime(c.date, c.from ?? "09:00");
  const day = relativeDayName(at);
  const dayWords =
    day === "Today" || day === "Tomorrow"
      ? day.toLowerCase()
      : `${day} ${shortDate(at)}`;
  if (!c.from) return dayWords;
  const from = clockTime(new Date(at));
  const to = c.to
    ? clockTime(new Date(combineDateAndTime(c.date, c.to)))
    : null;
  // "7 to 9 am": one am or pm when both share it
  const range = to
    ? from.slice(-2) === to.slice(-2)
      ? `${from.slice(0, -3)} to ${to}`
      : `${from} to ${to}`
    : from;
  return `${dayWords}, ${range}`;
}

export default function NextStepCard({ step }: { step: NextStep }) {
  const w = wordsFor(step);
  return (
    <section
      className={styles.card}
      aria-labelledby="next-step"
      data-stage={step.stage}
    >
      <h2 id="next-step" className={styles.title}>
        {w.title}
      </h2>
      {w.text && <p className={`${styles.text} num`}>{w.text}</p>}
      {w.bill && (
        <ItemisedBill
          lines={w.bill.lines.map((line) => ({
            key: line.key,
            label:
              line.quantity && line.quantity > 1
                ? `${line.label} x ${line.quantity}`
                : line.label,
            note:
              line.mrpPaise && line.mrpPaise > line.amountPaise
                ? `MRP ${rupees(line.mrpPaise)}`
                : undefined,
            amount: rupees(line.amountPaise),
          }))}
          total={{ label: "To pay", amount: rupees(w.bill.totalPaise) }}
        />
      )}
      {w.action && (
        <Link href={w.action.href} className={`btn ${styles.go}`}>
          <span>{w.action.label}</span>
          <span className="well" aria-hidden="true">
            {w.action.icon === "video" ? (
              <VideoCamera size={18} weight="fill" />
            ) : (
              <ArrowRight size={18} />
            )}
          </span>
        </Link>
      )}
      {w.quiet && (
        <Link href={w.quiet.href} className={styles.quiet}>
          {w.quiet.label}
        </Link>
      )}
    </section>
  );
}
