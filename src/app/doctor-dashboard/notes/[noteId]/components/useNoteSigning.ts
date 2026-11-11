"use client";

/**
 * Signing a call note and adding signed addenda (POST /api/doctor/notes/:id/sign and /addenda).
 * Signing has no Undo: a signed note is final, and corrections are signed addenda. When the doctor
 * signs, the next note waiting in the queue is remembered, so the sign bar can point onwards.
 */

import { useCallback, useState } from "react";
import { errorMessage } from "@/lib/http/apiClient";
import {
  addClinicalNoteAddendum,
  signClinicalNote,
} from "@/services/clinicalNoteService";
import type { ClinicalNote } from "@/types/clinicalNote";
import {
  firstName,
  sectionOf,
} from "@/app/doctor-dashboard/notes/components/noteState";
import { scrollPageTop } from "./noteScroll";

export function useNoteSigning({
  note,
  queueSource,
  queue,
  their,
  setNote,
  toast,
  saved,
}: {
  note: ClinicalNote;
  /** every note, with this one as it now stands */
  queueSource: ClinicalNote[];
  /** the notes waiting to be signed, in order */
  queue: ClinicalNote[];
  their: string;
  setNote: (note: ClinicalNote) => void;
  toast: (message: string) => void;
  /** settles when every edit sent so far has saved */
  saved: () => Promise<unknown>;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [afterSigning, setAfterSigning] = useState<string | null>(null);
  // true from the sheet's Sign until the call settles, so the Sign button can show it is working
  const [signing, setSigning] = useState(false);
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const others = (notes: ClinicalNote[]) =>
    notes.find((queued) => queued.id !== note.id);
  const nextUp =
    queueSource.find(
      (other) => other.id === afterSigning && other.status === "DRAFT",
    ) ?? others(queue);

  const sign = (sendToApp: boolean) => {
    setSheetOpen(false);
    setSigning(true);
    const hasText = sectionOf(note, "patient").current.length > 0;
    const at = queue.findIndex((queued) => queued.id === note.id);
    // the next note waiting after this one, else the first before it
    setAfterSigning((others(queue.slice(at + 1)) ?? others(queue))?.id ?? null);
    saved()
      .then(() => signClinicalNote(note.id, sendToApp))
      .then((signed) => {
        setNote(signed);
        toast(
          `Signed. In ${firstName(note)}'s record${sendToApp && hasText ? `, and ${their} summary is in ${their} app` : ""}`,
        );
        scrollPageTop();
      })
      .catch((caught) =>
        toast(errorMessage(caught, "The note was not signed.")),
      )
      .finally(() => setSigning(false));
  };

  const addAddendum = async (text: string) => {
    try {
      setNote(await addClinicalNoteAddendum(note.id, text));
      toast("Addendum signed");
      return true;
    } catch (caught) {
      toast(errorMessage(caught, "The addendum was not saved."));
      return false;
    }
  };

  return {
    sheetOpen,
    openSheet,
    closeSheet,
    sign,
    addAddendum,
    nextUp,
    signing,
  };
}
