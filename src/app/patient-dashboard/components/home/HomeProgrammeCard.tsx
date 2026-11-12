/*
  Home's third card once the first consultation is over (Arhaan HomeView "Your programme"). Before
  a plan starts it leads to the plans, with the plain facts about how one works; once a plan is
  running it names the plan and leads to Care.
*/

import Link from "next/link";
import { CaretRight, Pill, Receipt, Stethoscope } from "@phosphor-icons/react";
import pageStyles from "@/app/patient-dashboard/HomePage.module.css";

export default function HomeProgrammeCard({
  active,
  planName,
}: {
  active: boolean;
  planName: string;
}) {
  return (
    <section
      className={`${pageStyles.card} ${pageStyles.dose} ${pageStyles.quiet}`}
      aria-labelledby="stage-heading"
    >
      <div className={pageStyles.head}>
        <p className={pageStyles.label}>Your programme</p>
        <span className={pageStyles.go} aria-hidden="true">
          {active ? "Care" : "Plans"}
          <CaretRight size={14} />
        </span>
      </div>
      <h2 id="stage-heading" className={pageStyles.doseTitle}>
        <Link
          href={active ? "/patient-dashboard/care" : "/patient-dashboard/plans"}
          className={pageStyles.stretch}
        >
          {active
            ? planName || "Your programme"
            : "Your doctor may suggest a programme"}
        </Link>
      </h2>
      {active ? (
        <p className={pageStyles.quietLine}>A doctor review every month.</p>
      ) : (
        <>
          <ul className={pageStyles.process}>
            <li>
              <Stethoscope size={16} aria-hidden="true" />A doctor review every
              month
            </li>
            <li>
              <Receipt size={16} aria-hidden="true" />
              You see the itemised price before you pay
            </li>
            <li>
              <Pill size={16} aria-hidden="true" />
              Nothing is prescribed until you start it
            </li>
          </ul>
          <p className={pageStyles.quietLine}>
            Nothing is prescribed until you start it.
          </p>
        </>
      )}
    </section>
  );
}
