"use client";

/*
  Home, the patient's one screen (doctor portal v2 PRD; 17 Nov 2026 call: "lay everything out on the
  plate"): a greeting, ONE card with the next step (NextStepCard, from GET /api/patient/next-step), and
  three plain rows: Prescriptions, Lab reports, Payments. Their name, top right in the bar, opens the
  profile. It refreshes when the patient comes back to the app, so a step done elsewhere (paid, the
  call ended, the prescription sent) moves the card on.
  Kept in this folder but off Home (PRD "Cut from the patient's view"): the weight card and logging, the
  programme card, the first-steps card and the old strip (WeightCard, HomeProgrammeCard, FirstStepsCard,
  NextStepStrip).
*/

import { useEffect } from "react";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import PageGhosts from "@/app/patient-dashboard/components/PageGhosts";
import { useApiResource } from "@/hooks/useApiResource";
import { useSessionUser } from "@/hooks/useSessionUser";
import { getNextStep } from "@/services/patientHomeService";
import NextStepCard from "./NextStepCard";
import styles from "./HomeView.module.css";

const ROWS = [
  { href: "/patient-dashboard/prescriptions", label: "Prescriptions" },
  { href: "/patient-dashboard/reports", label: "Lab reports" },
  { href: "/patient-dashboard/payments", label: "Payments" },
];

export default function HomeView() {
  const { user } = useSessionUser();
  const step = useApiResource("patient-next-step", getNextStep);
  const { reload } = step;
  useEffect(() => {
    const back = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, [reload]);

  const firstName = (user?.fullName ?? "").trim().split(/\s+/)[0];

  return (
    <main className={styles.home} data-screen="home">
      <h1 className={styles.hello}>{firstName ? `Hi ${firstName}` : "Hello"}</h1>
      {step.error && !step.data ? (
        <ErrorNotice message={step.error} onRetry={reload} />
      ) : step.data ? (
        <NextStepCard step={step.data} />
      ) : (
        <PageGhosts heights={[220]} />
      )}
      <nav aria-label="Your records">
        <ul className={styles.rows}>
          {ROWS.map((row) => (
            <li key={row.href}>
              <Link href={row.href} className={styles.row}>
                <span>{row.label}</span>
                <CaretRight size={18} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
