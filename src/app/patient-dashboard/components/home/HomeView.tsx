"use client";

/*
  Home (Arhaan HomeView): a greeting, the next thing to do as one line with Chat beside it, the
  weight card, and one card for where the patient stands in care. On a phone it never scrolls.
  Before the first consultation the strip and that card give way to one status card driven by the
  eligibility review (GET /api/eligibility); while the backend lacks it, the consultations decide.
  Data: the patient's consultations, their profile (name, weight, plan), weight readings, eligibility.
*/

import { useCallback } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { useNow } from "@/hooks/useNow";
import { errorMessage } from "@/lib/http/apiClient";
import { getSessionUser } from "@/lib/session/authSession";
import { listMyAppointments } from "@/services/appointmentService";
import { getMyProfile } from "@/services/patientProfileService";
import {
  deleteWeightReading,
  listWeightReadings,
  logWeight,
} from "@/services/trackerService";
import EligibilityStatus from "../EligibilityStatus";
import { eligibilityStatus, loadEligibilityReview } from "../eligibilityStage";
import { careStageOf, isPlanActive, upcomingConsultation } from "./careStage";
import FirstStepsCard from "./FirstStepsCard";
import NextStepStrip from "./NextStepStrip";
import HomeProgrammeCard from "./HomeProgrammeCard";
import WeightCard from "./WeightCard";
import styles from "@/app/patient-dashboard/HomePage.module.css";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import { listMyLabBookings } from "@/services/labTestService";
import OngoingLabCard from "@/app/patient-dashboard/lab-tests/components/OngoingLabCard";

function greeting(hour: number) {
  if (hour < 5) return "Hello";
  if (hour >= 17) return "Good evening";
  if (hour < 12) return "Good morning";
  return "Good afternoon";
}

async function loadHome() {
  const [appointments, profile, weights, review, labBookings] =
    await Promise.all([
      listMyAppointments(),
      getMyProfile(),
      listWeightReadings(),
      loadEligibilityReview(),
      listMyLabBookings().catch(() => null),
    ]);
  return {
    appointments,
    profile,
    weights,
    ...review,
    labBookings: labBookings ?? [],
  };
}

const LAB_UNDER_WAY = [
  "BOOKED",
  "COLLECTOR_ASSIGNED",
  "SAMPLE_COLLECTED",
  "PROCESSING",
];

export default function HomeView() {
  const toast = useToast();
  const now = useNow();
  const home = useApiResource("patient-home", loadHome);
  const { data, reload, setData } = home;

  // the card shows the new reading (or drops an undone one) at once; the reload then confirms it
  const saveWeight = useCallback(
    async (weightKg: number) => {
      const reading = await logWeight(weightKg);
      if (data)
        setData({ ...data, weights: [...(data.weights ?? []), reading] });
      reload();
      toast("Weight saved", () => {
        if (data) setData(data);
        deleteWeightReading(reading.id)
          .then(reload)
          .catch((error) => toast(errorMessage(error)));
      });
    },
    [data, reload, setData, toast],
  );

  if (!data) {
    return (
      <main className={layoutStyles.page}>
        {home.error ? (
          <ErrorNotice message={home.error} onRetry={reload} />
        ) : (
          <LoadingSkeleton />
        )}
      </main>
    );
  }

  const fullName = data.profile.fullName || getSessionUser()?.fullName || "";
  const firstName = fullName.trim().split(" ")[0] || "there";
  const planActive = isPlanActive(data.profile.planStatus);
  const upcoming = upcomingConsultation(data.appointments, now);
  const stage = careStageOf(data.appointments, planActive, now);
  // before the first consultation the eligibility review leads; after it, the normal Home
  const status =
    data.eligibility && stage === "before-consultation"
      ? eligibilityStatus(data.eligibility, data.labBooking, upcoming, now)
      : null;
  // a paid blood test under way always shows on Home (the eligibility test is already in the status card)
  const labUnderWay =
    data.labBookings.find(
      (b) =>
        LAB_UNDER_WAY.includes(b.status) &&
        !(status && b.id === data.labBooking?.id),
    ) ?? null;
  const labCard = labUnderWay && (
    <OngoingLabCard booking={labUnderWay} now={now} />
  );
  // one filled button per screen: when the next step is a dark "do this", logging steps back
  const nextStepIsAction = status ? Boolean(status.action?.filled) : !upcoming;
  const greetingBlock = (
    <header className={styles.hello}>
      <h1 className={styles.h1}>
        {greeting(new Date(now).getHours())}, {firstName}.
      </h1>
      <p className={styles.sub}>Welcome to InRange</p>
    </header>
  );
  const weightCard = (
    <WeightCard
      readings={data.weights}
      profileWeightKg={data.profile.weightKg}
      primary={!nextStepIsAction}
      onSave={saveWeight}
    />
  );

  if (status) {
    return (
      <main
        className={`${styles.home} ${styles.withStatus}`}
        data-screen="home"
      >
        {greetingBlock}
        <section
          className={`${styles.card} ${styles.dose}`}
          aria-labelledby="status-heading"
        >
          <div className={styles.head}>
            <h2 id="status-heading" className={styles.label}>
              Your next step
            </h2>
          </div>
          <EligibilityStatus status={status} />
        </section>
        {labCard}
        {weightCard}
      </main>
    );
  }

  return (
    <main className={styles.home} data-screen="home">
      {greetingBlock}

      <NextStepStrip upcoming={upcoming} stage={stage} now={now} />

      {labCard}
      {weightCard}

      {stage === "before-consultation" ? (
        <FirstStepsCard upcoming={upcoming} />
      ) : (
        <HomeProgrammeCard
          active={stage === "in-programme"}
          planName={data.profile.planName}
        />
      )}
    </main>
  );
}
