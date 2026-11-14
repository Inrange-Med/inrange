"use client";

/**
 * The onboarding state machine: the patient's answers, which screen is showing, and moving forward
 * (save the step, then the next one), back and out. The answers and their checks are in
 * onboardingDraft.ts and onboardingStepAnswer.ts; question 9's paths in useBloodTestPath.ts. Order of calls: questions 1 to 8 are each saved
 * (PATCH /api/onboarding/step); after question 8 the profile is completed (POST
 * /api/onboarding/complete); only then comes the blood test step (question 9), which branches:
 *   yes  "upload"  the report is uploaded for review (purpose ELIGIBILITY), then "sent".
 *   no   "lab"     the care package with lab tests, booked with the shared lab booking flow.
 *
 * Every answer is saved as soon as Continue is pressed, so "Save and exit" only has to leave.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage } from "@/lib/http/apiClient";
import { updateSessionUser } from "@/lib/session/authSession";
import {
  completeOnboarding,
  saveOnboardingStep,
} from "@/services/onboardingService";
import type {
  OnboardingConfig,
  OnboardingStatus,
  OnboardingStepAnswer,
} from "@/types/onboarding";
import {
  answersFrom,
  draftFrom,
  experienceToggled,
  type DraftChanges,
  type Problem,
} from "./onboardingDraft";
import { clearFreeCheck } from "@/lib/onboarding/freeCheck";
import { nextOpenStep, type Prefilled } from "./freeCheckPrefill";
import { LAST_SAVED_STEP, REPORT_STEP } from "./onboardingOptions";
import { isProblem, stepAnswerFor } from "./onboardingStepAnswer";
import { useBloodTestPath } from "./useBloodTestPath";

/** `status` is null when the backend cannot resume yet: the patient starts at question 1.
 *  `prefilled`: the free check's answers were saved on the way in; moving forward skips them. */
export function useOnboardingProgress(
  status: OnboardingStatus | null,
  config: OnboardingConfig,
  prefilled?: Prefilled,
) {
  const router = useRouter();
  const path = useBloodTestPath();
  const [step, setStep] = useState(status?.currentStep ?? 1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);
  const [welcomeBack, setWelcomeBack] = useState(
    (status?.lastCompletedStep ?? 0) > 0,
  );
  // the questions saved from the free check (and an earlier name), skipped when moving forward
  const skip = useRef(prefilled?.done ?? []);
  const welcomeLine = prefilled?.fromCheck
    ? "Your answers from the check are saved."
    : undefined;
  const [problem, setProblem] = useState<Problem | null>(
    prefilled?.problem ? { message: prefilled.problem } : null,
  );
  const [draft, setDraft] = useState(() => draftFrom(status?.answers));
  // complete runs once: going back to question 8 and on again does not repeat it
  const completed = useRef(Boolean(status?.completed));
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // bumped by Back and Save and exit, so a save still in flight cannot move the patient forward afterwards
  const navigation = useRef(0);

  // on a return visit the status line says so, then settles back
  useEffect(() => {
    if (!welcomeBack) return;
    const timer = setTimeout(() => setWelcomeBack(false), 4200);
    return () => clearTimeout(timer);
  }, [welcomeBack]);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  /** Changes some answers. Pass a function when the change depends on the latest answers (a held stepper). */
  const update = (changes: DraftChanges) => {
    setDraft((current) => ({
      ...current,
      ...(typeof changes === "function" ? changes(current) : changes),
    }));
    setProblem(null);
  };

  /** Question 9 is not saved: it only opens the path the patient chose. */
  const choosePath = (hasRecentReport: boolean | null) => {
    if (hasRecentReport === null) setProblem({ message: "Choose one." });
    else {
      setDirection(1);
      path.openPath(hasRecentReport);
    }
  };

  const submit = async (override?: OnboardingStepAnswer) => {
    if (busy) return;
    if (step === REPORT_STEP) return choosePath(draft.hasRecentReport);
    const answer = override ?? stepAnswerFor(step, draft, config);
    if (isProblem(answer)) {
      setProblem(answer);
      return;
    }
    setBusy(true);
    setProblem(null);
    const ticket = navigation.current;
    try {
      await saveOnboardingStep(answer, config.consentVersion);
      if (ticket !== navigation.current) return;
      // the profile is completed before the blood test step, so the backend has it for the review
      if (answer.step === LAST_SAVED_STEP && !completed.current) {
        await completeOnboarding(answersFrom(draft, config));
        completed.current = true;
        if (ticket !== navigation.current) return;
        updateSessionUser({
          fullName: `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim(),
        });
        // the profile has everything the check held
        clearFreeCheck();
      }
      setStep(nextOpenStep(skip.current, answer.step));
      setDirection(1);
    } catch (error) {
      if (ticket === navigation.current)
        setProblem({ message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  /** Single answers: show the tick, then move on a beat later. */
  const pickThenGo = (answer: OnboardingStepAnswer) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => submit(answer), 260);
  };

  /** Question 9: show the tick, then open the chosen path a beat later. */
  const pickPathThenGo = (hasRecentReport: boolean) => {
    update({ hasRecentReport });
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => choosePath(hasRecentReport), 260);
  };

  /** One screen back: through the lab booking's steps, then to question 9, then question by question. */
  const back = () => {
    navigation.current++;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setProblem(null);
    setDirection(-1);
    if (!path.stepBack()) setStep((current) => Math.max(1, current - 1));
  };

  const saveAndExit = () => {
    navigation.current++;
    router.push("/patient-dashboard");
  };

  return {
    phase: path.phase,
    setPhase: path.setPhase,
    lab: path.lab,
    step,
    direction,
    busy,
    problem,
    welcomeBack,
    welcomeLine,
    draft,
    update,
    toggleExperience: (code: string) =>
      update({ experience: experienceToggled(draft.experience, code) }),
    /** Continue looks unavailable until this is true, but a tap still says what is missing. */
    canContinue:
      step === REPORT_STEP
        ? draft.hasRecentReport !== null
        : !isProblem(stepAnswerFor(step, draft, config)),
    submit,
    pickThenGo,
    pickPathThenGo,
    back,
    saveAndExit,
  };
}
