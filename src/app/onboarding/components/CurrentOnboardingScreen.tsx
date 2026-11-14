"use client";

/**
 * Renders the onboarding screen the patient is on: one of questions 1 to 9 (questions/), or a
 * screen of the blood test path question 9 opens (blood-test-step/: upload a report, report sent,
 * or book a home test in a care package). State and saving live in useOnboardingProgress; this file
 * only picks what shows, and moves scroll and focus to each new screen.
 */

import { useEffect, useLayoutEffect, useRef } from "react";
import type { OnboardingConfig, OnboardingStatus } from "@/types/onboarding";
import type { Prefilled } from "../freeCheckPrefill";
import { CHAPTERS } from "../onboardingOptions";
import { bmiOf } from "../onboardingDraft";
import { useOnboardingProgress } from "../useOnboardingProgress";
import LabBookingScreen from "./blood-test-step/LabBookingScreen";
import ReportSentScreen from "./blood-test-step/ReportSentScreen";
import ReportUploadScreen from "./blood-test-step/ReportUploadScreen";
import DrawnArcs from "./DrawnArcs";
import OnboardingTopBar from "./OnboardingTopBar";
import AgeQuestion from "./questions/AgeQuestion";
import ConditionsQuestion from "./questions/ConditionsQuestion";
import ConsentQuestion from "./questions/ConsentQuestion";
import GenderQuestion from "./questions/GenderQuestion";
import HeightQuestion from "./questions/HeightQuestion";
import NameQuestion from "./questions/NameQuestion";
import QuestionScreen from "./questions/QuestionScreen";
import FirstStepChoice from "./questions/FirstStepChoice";
import WeightLossExperienceQuestion from "./questions/WeightLossExperienceQuestion";
import WeightQuestion from "./questions/WeightQuestion";
import styles from "../OnboardingPage.module.css";

/** Typing questions put the cursor in the first box; the others move focus to the question. */
const TYPING_STEPS = [1, 3];

export default function CurrentOnboardingScreen({
  status,
  config,
  prefilled,
}: {
  status: OnboardingStatus | null;
  config: OnboardingConfig;
  prefilled?: Prefilled;
}) {
  const progress = useOnboardingProgress(status, config, prefilled);
  const { phase, step, draft, problem, update, lab } = progress;
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bmi = bmiOf(draft.heightCm, draft.weightKg);

  // every question and every screen starts at the top, with its heading in view
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [step, phase, lab.step]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const firstInput =
        phase === "steps" && TYPING_STEPS.includes(step)
          ? formRef.current?.querySelector("input")
          : null;
      (firstInput ?? headingRef.current)?.focus({ preventScroll: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [step, phase, lab.step]);

  const chapterName = (
    CHAPTERS.find((chapter) => chapter.steps.includes(step)) ?? CHAPTERS[0]
  ).name;

  const answers = {
    1: <NameQuestion draft={draft} problem={problem} update={update} />,
    2: (
      <GenderQuestion
        genders={config.genders}
        draft={draft}
        update={update}
        pickThenGo={progress.pickThenGo}
      />
    ),
    3: <AgeQuestion draft={draft} problem={problem} update={update} />,
    4: <HeightQuestion draft={draft} update={update} />,
    5: <WeightQuestion draft={draft} update={update} />,
    6: (
      <WeightLossExperienceQuestion
        experiences={config.experiences}
        selected={draft.experience}
        onToggle={progress.toggleExperience}
      />
    ),
    7: (
      <ConditionsQuestion
        config={config}
        draft={draft}
        problem={problem}
        update={update}
      />
    ),
    8: (
      <ConsentQuestion
        consents={config.consents}
        draft={draft}
        update={update}
      />
    ),
    9: (
      <FirstStepChoice
        onLab={progress.openLab}
        onUpload={progress.openUpload}
      />
    ),
  }[step];

  return (
    <main
      className={styles.page}
      data-phase={phase}
      data-step={phase === "steps" ? step : undefined}
    >
      <DrawnArcs className={styles.art} />
      <OnboardingTopBar
        phase={phase}
        step={step}
        chapterName={chapterName}
        onBack={progress.back}
        onSaveAndExit={progress.saveAndExit}
      />

      {phase === "steps" && (
        <QuestionScreen
          step={step}
          chapterName={chapterName}
          direction={progress.direction}
          busy={progress.busy}
          canContinue={progress.canContinue}
          problem={problem}
          welcomeBack={progress.welcomeBack}
          welcomeLine={progress.welcomeLine}
          formRef={formRef}
          headingRef={headingRef}
          dock={step !== 9}
          onSubmit={() => progress.submit()}
        >
          {answers}
        </QuestionScreen>
      )}

      {phase === "upload" && (
        <ReportUploadScreen
          direction={progress.direction}
          headingRef={headingRef}
          onSent={() => progress.setPhase("sent")}
        />
      )}
      {phase === "sent" && (
        <ReportSentScreen bmi={bmi} headingRef={headingRef} />
      )}
      {phase === "lab" && (
        <LabBookingScreen
          lab={lab}
          draft={draft}
          bmi={bmi}
          direction={progress.direction}
          headingRef={headingRef}
        />
      )}
    </main>
  );
}
