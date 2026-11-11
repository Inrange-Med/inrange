"use client";

/*
  The "Personal details" sheet (Arhaan Profile.tsx Details): name, email and age, saved through
  PATCH /api/patient/profile. The mobile number signs the patient in, so it is sent unchanged and
  shown as not editable here.
*/

import { useState, type FormEvent } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import { useToast } from "@/components/ui/ToastProvider";
import { errorMessage } from "@/lib/http/apiClient";
import { updateSessionUser } from "@/lib/session/authSession";
import { updatePersonalDetails } from "@/services/patientProfileService";
import type { PatientProfile } from "@/types/patientProfile";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import ProfileField from "./ProfileField";
import SaveButton from "./SaveButton";
import styles from "../ProfilePage.module.css";

type Props = {
  profile: PatientProfile;
  onSaved: (changes: Partial<PatientProfile>) => void;
};

export default function PersonalDetailsForm({ profile, onSaved }: Props) {
  const toast = useToast();
  const [firstWord, ...otherWords] = profile.fullName.trim().split(/\s+/);
  const [form, setForm] = useState({
    firstName: firstWord ?? "",
    lastName: otherWords.join(" "),
    email: profile.email,
    age: profile.age ? String(profile.age) : "",
  });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const age = Number(form.age);
  const errors = {
    firstName: !form.firstName.trim() ? "Add your first name." : "",
    email:
      form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
        ? "This email does not look complete."
        : "",
    age:
      form.age && (!Number.isInteger(age) || age < 18 || age > 100)
        ? "inrange is for adults aged 18 and over."
        : "",
  };
  const invalid = Object.values(errors).some(Boolean);
  const shown = (key: keyof typeof errors) => (tried ? errors[key] : "");
  const set = (key: keyof typeof form) => (value: string) =>
    setForm({ ...form, [key]: value });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (invalid) return;
    setBusy(true);
    setSaveError(null);
    const changes = {
      fullName: [form.firstName.trim(), form.lastName.trim()]
        .filter(Boolean)
        .join(" "),
      email: form.email.trim(),
      phone: profile.phone,
      age: form.age ? age : null,
    };
    try {
      await updatePersonalDetails(changes);
      updateSessionUser({ fullName: changes.fullName });
      onSaved(changes);
      toast("Details saved");
    } catch (error) {
      setSaveError(errorMessage(error));
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.pairFields}>
        <ProfileField
          label="First name"
          autoComplete="given-name"
          value={form.firstName}
          onValueChange={set("firstName")}
          error={shown("firstName")}
        />
        <ProfileField
          label="Last name"
          autoComplete="family-name"
          value={form.lastName}
          onValueChange={set("lastName")}
        />
      </div>
      <ProfileField
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={form.email}
        onValueChange={set("email")}
        error={shown("email")}
        hint="For invoices and your data copy."
      />
      <ProfileField
        label="Age"
        inputMode="numeric"
        pattern="[0-9]*"
        value={form.age}
        onValueChange={set("age")}
        error={shown("age")}
      />
      <p className={formStyles.hint}>
        Your mobile number signs you in, so it changes only through your care
        team.
      </p>
      {saveError && <ErrorNotice message={saveError} />}
      <SaveButton busy={busy} />
    </form>
  );
}
