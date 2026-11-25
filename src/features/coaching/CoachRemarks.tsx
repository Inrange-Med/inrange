"use client";

/*
  Coach remarks (19 Nov 2026 call): how the patient's month went, what they followed and what they did not.
  The patient's coach (or admin) writes them here; the doctor reads them on the patient's page at the
  follow-up. Newest first. A remark is never edited or removed: a correction is a new remark.
*/

import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { errorMessage } from "@/lib/http/apiClient";
import { addCoachRemark } from "@/services/medicineOpsService";
import adminStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";
import { when } from "@/features/medicine-queue/words";
import c from "./Coaching.module.css";

export default function CoachRemarks({
  patientId,
  remarks,
  onSaved,
}: {
  patientId: string;
  remarks: { id: string; at: string; by: string; text: string }[];
  onSaved: () => void;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy || text.trim().length < 3) return;
    setBusy(true);
    try {
      await addCoachRemark(patientId, text.trim());
      toast("Remark saved");
      setText("");
      onSaved();
    } catch (caught) {
      toast(errorMessage(caught, "The remark was not saved. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={s.section} aria-label="Coach remarks">
      <h3 className={s.sectionHead}>
        Remarks <span className={adminStyles.muted}>for the doctor</span>
      </h3>
      <div className={c.form}>
        <textarea
          className={s.textarea}
          value={text}
          maxLength={4000}
          placeholder="What they followed. What they did not."
          aria-label="A remark for the doctor"
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="button"
          className={c.btn}
          disabled={busy || text.trim().length < 3}
          onClick={save}
        >
          {busy ? "Saving" : "Save"}
        </button>
      </div>
      {remarks.length === 0 ? (
        <p className={adminStyles.empty}>No remarks yet.</p>
      ) : (
        <ol className={s.timeline}>
          {remarks.map((remark) => (
            <li key={remark.id}>
              <time dateTime={remark.at}>{when(remark.at)}</time>
              <span>
                <strong className={s.pre}>{remark.text}</strong>
                <span className={s.reply}>{remark.by}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
