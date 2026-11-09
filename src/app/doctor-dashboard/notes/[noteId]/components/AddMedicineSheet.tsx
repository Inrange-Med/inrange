/** The doctor adds a medicine change the call missed; it joins the note's list, included, and saves with it. */

"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Sheet from "@/components/ui/Sheet";
import type { MedicineChange } from "@/types/clinicalNote";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "./NoteListSections.module.css";

type Action = MedicineChange["action"];

const ACTIONS: { value: Action; label: string }[] = [
  { value: "START", label: "Start" },
  { value: "CHANGE", label: "Change" },
  { value: "STOP", label: "Stop" },
  { value: "CONTINUE", label: "Continue" },
];

export default function AddMedicineSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (
    medicine: Pick<MedicineChange, "action" | "name" | "strength" | "detail">,
  ) => void;
}) {
  const [action, setAction] = useState<Action>("START");
  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [detail, setDetail] = useState("");
  const [tried, setTried] = useState(false);
  const missingName = !name.trim();

  const close = () => {
    setAction("START");
    setName("");
    setStrength("");
    setDetail("");
    setTried(false);
    onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (missingName) return;
    onAdd({
      action,
      name: name.trim(),
      strength: strength.trim(),
      detail: detail.trim(),
    });
    close();
  };

  return (
    <Sheet open={open} onClose={close} title="Add a medicine">
      <form className={styles.addForm} onSubmit={submit} noValidate>
        <div className={formStyles.field}>
          <span className={formStyles.label}>Change</span>
          <SegmentedControl
            label="Change"
            value={action}
            options={ACTIONS}
            onChange={setAction}
          />
        </div>
        <label className={formStyles.field}>
          <span className={formStyles.label}>Medicine</span>
          <input
            className={formStyles.input}
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={tried && missingName}
            autoComplete="off"
          />
          {tried && missingName && (
            <span className={formStyles.err}>
              Enter the medicine&apos;s name.
            </span>
          )}
        </label>
        <label className={formStyles.field}>
          <span className={formStyles.label}>Strength</span>
          <input
            className={formStyles.input}
            value={strength}
            maxLength={40}
            onChange={(event) => setStrength(event.target.value)}
            placeholder="For example, 500 mg"
            autoComplete="off"
          />
        </label>
        <label className={formStyles.field}>
          <span className={formStyles.label}>How to take it</span>
          <input
            className={formStyles.input}
            value={detail}
            maxLength={160}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="For example, twice a day after meals"
            autoComplete="off"
          />
        </label>
        <button type="submit" className={`btn ${formStyles.go}`}>
          <span>Add to the note</span>
          <span className="well" aria-hidden="true">
            <ArrowRight size={18} />
          </span>
        </button>
      </form>
    </Sheet>
  );
}
