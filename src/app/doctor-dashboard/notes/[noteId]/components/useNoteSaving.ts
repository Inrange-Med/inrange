"use client";

/**
 * Applies an edit at once and saves it in the background. Saves go out one after another, in edit
 * order: each carries the whole note, and two in flight together can land on the server in either
 * order, so a fast tick could be overwritten by the edit before it. A save that comes back after a
 * newer edit is ignored; a failed save says so and reloads the note as the backend has it.
 * `latest` is the newest note, for undos that run later.
 */

import { useEffect, useRef } from "react";
import { errorMessage } from "@/lib/http/apiClient";
import { saveClinicalNote } from "@/services/clinicalNoteService";
import type { ClinicalNote } from "@/types/clinicalNote";
import type { NoteEdit } from "@/app/doctor-dashboard/notes/components/noteEdits";

export function useNoteSaving(
  note: ClinicalNote,
  setNote: (note: ClinicalNote) => void,
  reloadNote: () => void,
  toast: (message: string) => void,
) {
  const latest = useRef(note);
  const saveCount = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    latest.current = note;
  });

  const apply = (edit: NoteEdit | null) => {
    if (!edit) return;
    latest.current = edit.note;
    setNote(edit.note);
    const count = ++saveCount.current;
    const { sections, medicines, followUps, recordUpdates, checks } = edit.note;
    queue.current = queue.current
      .then(() =>
        saveClinicalNote(edit.note.id, {
          sections,
          medicines,
          followUps,
          recordUpdates,
          checks,
          change: edit.change,
        }),
      )
      .then((saved) => count === saveCount.current && setNote(saved))
      .catch((caught) => {
        toast(errorMessage(caught, "The change was not saved."));
        reloadNote();
      });
  };
  /** settles once every save sent so far is done, so signing never overtakes an edit */
  const saved = () => queue.current;
  return { apply, latest, saved };
}
