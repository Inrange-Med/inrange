"use client";

/*
  Add a doctor, or edit one (`doctor` set; the mobile is then read-only, since it is their sign-in).
  The checks mirror the backend's: a 10-digit Indian mobile, a name, a specialisation and a
  registration number, a fee in whole rupees; lengths are capped where the backend trims. A refusal
  from the backend (the number already belongs to someone) shows under the form as it is.
*/

import { useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import { useToast } from "@/components/ui/ToastProvider";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import { isValidMobile, mobileDigitsFrom } from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import { addDoctor, updateDoctor } from "@/services/adminService";
import type { AdminDoctor, DoctorDetails } from "@/types/admin";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";

type Values = {
  mobile: string;
  fullName: string;
  specialization: string;
  qualification: string;
  registrationNo: string;
  experience: string;
  languages: string;
  fee: string;
  about: string;
};

type Field = keyof Values;

const FIELDS: {
  name: Field;
  label: string;
  max: number;
  hint?: string;
  wide?: boolean;
}[] = [
  {
    name: "mobile",
    label: "Mobile number",
    max: 16,
    hint: "10 digits. The doctor signs in with it.",
  },
  {
    name: "fullName",
    label: "Full name",
    max: 120,
    hint: "As the patient should see it, for example Dr. Asha Rao.",
  },
  { name: "specialization", label: "Specialisation", max: 120 },
  { name: "qualification", label: "Qualification", max: 200 },
  {
    name: "registrationNo",
    label: "Registration number",
    max: 60,
    hint: "Medical council registration.",
  },
  {
    name: "experience",
    label: "Experience",
    max: 60,
    hint: "For example 12 years.",
  },
  {
    name: "languages",
    label: "Languages",
    max: 200,
    hint: "Separate with commas.",
  },
  {
    name: "fee",
    label: "Consultation fee in rupees",
    max: 7,
    hint: "Whole rupees. Leave empty for no fee.",
  },
  { name: "about", label: "About", max: 1000, wide: true },
];

const valuesFor = (doctor: AdminDoctor | null): Values => ({
  mobile: doctor?.mobile ?? "",
  fullName: doctor?.fullName ?? "",
  specialization: doctor?.specialization ?? "",
  qualification: doctor?.qualification ?? "",
  registrationNo: doctor?.registrationNo ?? "",
  experience: doctor?.experience ?? "",
  languages: doctor ? doctor.languages.join(", ") : "English, Hindi",
  fee: doctor?.consultationFeeRupees?.toString() ?? "",
  about: doctor?.about ?? "",
});

function problemsIn(values: Values, creating: boolean) {
  const problems: Partial<Record<Field, string>> = {};
  if (creating && !isValidMobile(mobileDigitsFrom(values.mobile)))
    problems.mobile = "Enter a 10-digit mobile number starting with 6 to 9.";
  if (!values.fullName.trim())
    problems.fullName = "Add the doctor's full name.";
  if (!values.specialization.trim())
    problems.specialization = "Add the specialisation.";
  if (!values.registrationNo.trim())
    problems.registrationNo = "Add the medical council registration number.";
  if (values.fee.trim() && !/^\d+$/.test(values.fee.trim()))
    problems.fee = "The fee is a whole number of rupees.";
  if (values.languages.split(",").filter((l) => l.trim()).length > 8)
    problems.languages = "List up to 8 languages.";
  return problems;
}

const detailsFrom = (values: Values): DoctorDetails => ({
  fullName: values.fullName.trim(),
  specialization: values.specialization.trim(),
  qualification: values.qualification.trim(),
  registrationNo: values.registrationNo.trim(),
  experience: values.experience.trim(),
  languages: values.languages
    .split(",")
    .map((language) => language.trim())
    .filter(Boolean),
  about: values.about.trim(),
  consultationFeeRupees: values.fee.trim() ? Number(values.fee.trim()) : null,
});

export default function DoctorForm({
  doctor,
  onSaved,
  onCancel,
}: {
  doctor: AdminDoctor | null;
  onSaved: (doctor: AdminDoctor) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const creating = doctor === null;
  const [values, setValues] = useState(() => valuesFor(doctor));
  const [problems, setProblems] = useState<Partial<Record<Field, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idFor = (name: Field) => `doctor-${doctor?.id ?? "new"}-${name}`;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = problemsIn(values, creating);
    setProblems(found);
    if (Object.keys(found).length) {
      document.getElementById(idFor(Object.keys(found)[0] as Field))?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = creating
        ? await addDoctor({
            mobile: mobileDigitsFrom(values.mobile),
            ...detailsFrom(values),
          })
        : await updateDoctor(doctor.id, detailsFrom(values));
      toast(creating ? `${saved.fullName} added` : "Saved");
      onSaved(saved);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  };

  return (
    <form className={adminStyles.form} onSubmit={submit} noValidate>
      <div className={adminStyles.fields}>
        {FIELDS.map((field) => {
          const id = idFor(field.name);
          const problem = problems[field.name];
          const readOnly = field.name === "mobile" && !creating;
          const common = {
            id,
            value: values[field.name],
            maxLength: field.max,
            readOnly,
            "aria-invalid": Boolean(problem),
            "aria-describedby":
              problem || field.hint ? `${id}-note` : undefined,
            onChange: (
              event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
            ) => {
              setValues({ ...values, [field.name]: event.target.value });
              if (problem)
                setProblems({ ...problems, [field.name]: undefined });
            },
          };
          return (
            <div
              key={field.name}
              className={`${formStyles.field} ${field.wide ? adminStyles.wide : ""}`}
            >
              <label className={formStyles.label} htmlFor={id}>
                {field.label}
              </label>
              {field.name === "about" ? (
                <textarea
                  {...common}
                  className={adminStyles.textarea}
                  rows={4}
                />
              ) : (
                <input
                  {...common}
                  className={`${formStyles.input} ${adminStyles.input}`}
                  type={field.name === "mobile" ? "tel" : "text"}
                  inputMode={
                    field.name === "mobile" || field.name === "fee"
                      ? "numeric"
                      : undefined
                  }
                  autoComplete="off"
                />
              )}
              {(problem || (field.hint && !readOnly)) && (
                <p
                  id={`${id}-note`}
                  className={problem ? formStyles.err : formStyles.hint}
                >
                  {problem ?? field.hint}
                </p>
              )}
              {readOnly && (
                <p id={`${id}-note`} className={formStyles.hint}>
                  The mobile is the doctor&apos;s sign-in and cannot be changed
                  here.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {error && <ErrorNotice message={error} />}

      <div className={adminStyles.actions}>
        <button type="submit" className="btn" data-busy={busy} disabled={busy}>
          <span>
            {busy ? "Saving" : creating ? "Add doctor" : "Save changes"}
          </span>
          <span className="well" aria-hidden="true">
            {busy ? (
              <span className={formStyles.spin} />
            ) : (
              <ArrowRight size={18} />
            )}
          </span>
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy}
          data-busy={false}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
