"use client";

/*
  The "Health profile" sheet: conditions, height and weight, with the BMI worked out from them,
  saved through PATCH /api/patient/health-profile (the service sends the BMI too). Height and weight
  are typed in the patient's own units (kg or lb, cm or feet and inches) and saved in cm and kg.
*/

import { useState, type FormEvent } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/ToastProvider";
import { errorMessage } from "@/lib/http/apiClient";
import {
  kgTo,
  setUnits,
  toCm,
  toKg,
  useUnits,
  type HeightUnit,
  type WeightUnit,
} from "@/lib/units/measurementUnits";
import { updateHealthDetails } from "@/services/patientProfileService";
import type { PatientProfile } from "@/types/patientProfile";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import ProfileField from "./ProfileField";
import SaveButton from "./SaveButton";
import styles from "../ProfilePage.module.css";

type Props = {
  profile: PatientProfile;
  onSaved: (changes: Partial<PatientProfile>) => void;
};

const oneDecimal = (n: number) => String(Math.round(n * 10) / 10);
const number = (text: string) =>
  text.trim() ? Number(text.replace(",", ".")) : NaN;

/** The height boxes' text: centimetres, or feet and inches. */
function heightText(cm: number | null) {
  if (!cm) return { cm: "", feet: "", inches: "" };
  const totalInches = Math.round(cm / 2.54);
  return {
    cm: oneDecimal(cm),
    feet: String(Math.floor(totalInches / 12)),
    inches: String(totalInches % 12),
  };
}

export default function HealthProfileForm({ profile, onSaved }: Props) {
  const toast = useToast();
  const units = useUnits();
  const [conditions, setConditions] = useState(profile.conditions);
  const [weight, setWeight] = useState(
    profile.weightKg ? oneDecimal(kgTo(profile.weightKg, units.weight)) : "",
  );
  const [height, setHeight] = useState(() => heightText(profile.heightCm));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const weightKg = weight.trim() ? toKg(number(weight), units.weight) : null;
  const heightCm =
    units.height === "cm"
      ? height.cm.trim()
        ? number(height.cm)
        : null
      : height.feet.trim() || height.inches.trim()
        ? toCm(
            (number(height.feet) || 0) * 12 + (number(height.inches) || 0),
            "in",
          )
        : null;
  const errors = {
    weight:
      weightKg !== null && !(weightKg >= 30 && weightKg <= 250)
        ? "Check the number: it looks outside the usual range."
        : "",
    height:
      heightCm !== null && !(heightCm >= 120 && heightCm <= 230)
        ? "Check your height: it looks outside the usual range."
        : "",
  };
  const bmi =
    weightKg && heightCm && !errors.weight && !errors.height
      ? weightKg / (heightCm / 100) ** 2
      : null;

  const switchWeightUnit = (unit: WeightUnit) => {
    if (weightKg !== null && Number.isFinite(weightKg))
      setWeight(oneDecimal(kgTo(weightKg, unit)));
    setUnits({ weight: unit });
  };
  const switchHeightUnit = (unit: HeightUnit) => {
    if (heightCm !== null && Number.isFinite(heightCm))
      setHeight(heightText(heightCm));
    setUnits({ height: unit });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (errors.weight || errors.height) return;
    setBusy(true);
    setSaveError(null);
    const changes = {
      conditions: conditions.trim(),
      heightCm: heightCm === null ? null : Math.round(heightCm * 10) / 10,
      weightKg: weightKg === null ? null : Math.round(weightKg * 10) / 10,
    };
    try {
      await updateHealthDetails(changes);
      onSaved(changes);
      toast("Health profile saved");
    } catch (error) {
      setSaveError(errorMessage(error));
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <ProfileField
        label="Medical conditions"
        value={conditions}
        onValueChange={setConditions}
        placeholder="For example, type 2 diabetes"
      />

      <div className={formStyles.field}>
        <SegmentedControl
          label="Weight unit"
          value={units.weight}
          onChange={switchWeightUnit}
          options={[
            { value: "kg", label: "kg" },
            { value: "lb", label: "lb" },
          ]}
        />
        <ProfileField
          label={`Weight in ${units.weight}`}
          inputMode="decimal"
          value={weight}
          onValueChange={setWeight}
          error={tried ? errors.weight : ""}
        />
      </div>

      <div className={formStyles.field}>
        <SegmentedControl
          label="Height unit"
          value={units.height}
          onChange={switchHeightUnit}
          options={[
            { value: "ftin", label: "ft, in" },
            { value: "cm", label: "cm" },
          ]}
        />
        {units.height === "cm" ? (
          <ProfileField
            label="Height in cm"
            inputMode="numeric"
            pattern="[0-9]*"
            value={height.cm}
            onValueChange={(cm) => setHeight({ ...height, cm })}
            error={tried ? errors.height : ""}
          />
        ) : (
          <div className={styles.pairFields}>
            <ProfileField
              label="Feet"
              inputMode="numeric"
              pattern="[0-9]*"
              value={height.feet}
              onValueChange={(feet) => setHeight({ ...height, feet })}
              error={tried ? errors.height : ""}
            />
            <ProfileField
              label="Inches"
              inputMode="numeric"
              pattern="[0-9]*"
              value={height.inches}
              onValueChange={(inches) => setHeight({ ...height, inches })}
            />
          </div>
        )}
      </div>

      <dl className={styles.dl}>
        <div>
          <dt>BMI</dt>
          <dd className="num">{bmi ? bmi.toFixed(1) : "Not worked out yet"}</dd>
        </div>
      </dl>
      <p className={formStyles.hint}>
        BMI is worked out from your height and weight.
      </p>
      {saveError && <ErrorNotice message={saveError} />}
      <SaveButton busy={busy} />
    </form>
  );
}
