"use client";

/**
 * Step 3: who is being tested, shown only when the profile (or the onboarding answers) leaves
 * something missing or wrong, or the patient taps Change on the review. Starts from those answers;
 * Redcliffe needs every field and accepts only male or female. The lab's rules and the package's
 * own limits (age range, one sex only) are checked here, before a time is chosen, so the booking
 * does not fail at the end.
 */

import { useState, type FormEvent } from "react";
import { ArrowRight, WarningCircle } from "@phosphor-icons/react";
import type { LabPackage, LabPatient, LabPatientGender } from "@/types/labTest";
import { labPatientProblem } from "@/lib/validation/labBookingRules";
import SegmentedControl from "@/components/ui/SegmentedControl";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import type { LabPatientDraft } from "../useLabBookingFlow";
import styles from "../LabBookingFlow.module.css";

/** The first thing wrong with the form, in words, or null when Redcliffe will accept it. */
function problemWith(draft: LabPatientDraft, labPackage: LabPackage) {
  // the lab's own rules (labTestService), then this package's limits
  const general = labPatientProblem({
    ...draft,
    gender: draft.gender ?? ("" as LabPatientGender),
  });
  if (general) return general;
  if (
    labPackage.ageRange &&
    (draft.age < labPackage.ageRange.min || draft.age > labPackage.ageRange.max)
  ) {
    return `${labPackage.name} is for ages ${labPackage.ageRange.min} to ${labPackage.ageRange.max}.`;
  }
  if (
    labPackage.forGender !== "Both" &&
    labPackage.forGender !== draft.gender
  ) {
    return `${labPackage.name} is for ${labPackage.forGender === "Female" ? "women" : "men"} only.`;
  }
  return null;
}

/** The draft as a finished person when nothing is missing or wrong, else null (the step is shown). */
export function readyPatient(
  draft: LabPatientDraft,
  labPackage: LabPackage,
): LabPatient | null {
  if (problemWith(draft, labPackage) || !draft.gender) return null;
  return {
    ...draft,
    name: draft.name.trim(),
    email: draft.email.trim(),
    gender: draft.gender,
  };
}

export default function TestedPersonStep({
  initial,
  labPackage,
  onSave,
}: {
  initial: LabPatientDraft;
  labPackage: LabPackage;
  onSave: (patient: LabPatient) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [tried, setTried] = useState(false);
  const problem = problemWith(draft, labPackage);
  const set = (changes: Partial<LabPatientDraft>) =>
    setDraft((current) => ({ ...current, ...changes }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (problem || !draft.gender) return;
    onSave({
      ...draft,
      name: draft.name.trim(),
      email: draft.email.trim(),
      gender: draft.gender,
    });
  };

  return (
    <form className={styles.fields} onSubmit={submit} noValidate>
      <p className={styles.sheetMeta}>
        The lab needs these details for the sample and the report.
      </p>
      <label className={formStyles.field}>
        <span className={formStyles.label}>Full name</span>
        <input
          className={formStyles.input}
          value={draft.name}
          onChange={(event) => set({ name: event.target.value })}
          autoComplete="name"
        />
      </label>
      <div className={styles.pairFields}>
        <label className={formStyles.field}>
          <span className={formStyles.label}>Age</span>
          <input
            className={`${formStyles.input} num`}
            inputMode="numeric"
            value={draft.age || ""}
            maxLength={3}
            onChange={(event) =>
              set({ age: Number(event.target.value.replace(/\D/g, "")) })
            }
          />
        </label>
        <div className={`${formStyles.field} ${styles.genderField}`}>
          <span className={formStyles.label}>Gender</span>
          <SegmentedControl<LabPatientGender>
            label="Gender"
            value={draft.gender ?? ("" as LabPatientGender)}
            options={[
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" },
            ]}
            onChange={(gender) => set({ gender })}
          />
        </div>
      </div>
      <label className={formStyles.field}>
        <span className={formStyles.label}>Mobile number</span>
        <input
          className={`${formStyles.input} num`}
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={draft.mobile}
          onChange={(event) =>
            set({ mobile: event.target.value.replace(/\D/g, "") })
          }
          autoComplete="tel-national"
        />
        <span className={formStyles.hint}>
          The collector calls this number.
        </span>
      </label>
      <label className={formStyles.field}>
        <span className={formStyles.label}>Email</span>
        <input
          className={formStyles.input}
          type="email"
          value={draft.email}
          onChange={(event) => set({ email: event.target.value })}
          autoComplete="email"
        />
      </label>
      {tried && problem && (
        <p className={formStyles.err} role="alert">
          <WarningCircle size={16} weight="bold" aria-hidden="true" />
          <span>{problem}</span>
        </p>
      )}
      <button type="submit" className={`btn ${formStyles.go}`}>
        <span>Continue</span>
        <span className="well" aria-hidden="true">
          <ArrowRight size={18} />
        </span>
      </button>
    </form>
  );
}
