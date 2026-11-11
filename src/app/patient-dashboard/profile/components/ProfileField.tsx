/*
  One labelled input in a profile sheet (Arhaan Profile.tsx field()): the label, the box, and under
  it either the error (once the person has tried to save) or a quiet hint. `labelHidden` is for a
  box whose words already sit in a row above it (a label beside its unit switch): the label then
  names the input for screen readers only.
*/

import type { InputHTMLAttributes } from "react";
import formStyles from "@/components/ui/styles/FormControls.module.css";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  hint?: string;
  labelHidden?: boolean;
};

export default function ProfileField({
  label,
  value,
  onValueChange,
  error,
  hint,
  labelHidden = false,
  ...inputProps
}: Props) {
  return (
    <label className={formStyles.field}>
      {!labelHidden && <span className={formStyles.label}>{label}</span>}
      <input
        className={formStyles.input}
        aria-label={labelHidden ? label : undefined}
        value={value}
        aria-invalid={!!error}
        onChange={(event) => onValueChange(event.target.value)}
        {...inputProps}
      />
      {error ? (
        <span className={formStyles.hint} role="alert">
          {error}
        </span>
      ) : (
        hint && <span className={formStyles.hint}>{hint}</span>
      )}
    </label>
  );
}
