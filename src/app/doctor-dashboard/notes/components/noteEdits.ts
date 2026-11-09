/**
 * Every change the doctor can make to a call note, as pure functions on ClinicalNote (Arhaan's
 * notes-store actions without the store). An edit returns the new note and one line for its
 * history; the screen saves it with saveClinicalNote.
 */

import type {
  ClinicalNote,
  MedicineChange,
  NoteListKey,
  NoteSection,
  NoteSectionKey,
  NoteSentence,
} from "@/types/clinicalNote";
import { isSectionKey, sectionOf, TITLES } from "./noteState";

export type NoteEdit = { note: ClinicalNote; change: string };

const withSection = (
  note: ClinicalNote,
  key: NoteSectionKey,
  change: (section: NoteSection) => NoteSection,
): ClinicalNote => ({
  ...note,
  sections: note.sections.some((section) => section.key === key)
    ? note.sections.map((section) =>
        section.key === key ? change(section) : section,
      )
    : [...note.sections, change(sectionOf(note, key))],
});

export const setSectionText = (
  note: ClinicalNote,
  key: NoteSectionKey,
  current: NoteSentence[],
) => withSection(note, key, (section) => ({ ...section, current }));

/** The doctor's text back into sentences: the plan is one point per line, prose splits at full stops. */
function splitText(key: NoteSectionKey, text: string): string[] {
  if (key === "plan")
    return text
      .split("\n")
      .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
      .filter(Boolean);
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Unchanged sentences keep their evidence and flags; new ones are the doctor's own. Null when nothing changed. */
export function editSection(
  note: ClinicalNote,
  key: NoteSectionKey,
  text: string,
): NoteEdit | null {
  const section = sectionOf(note, key);
  const parts = splitText(key, text);
  if (
    parts.length === section.current.length &&
    parts.every((part, index) => part === section.current[index].text)
  )
    return null;
  const pool = [...section.current];
  const tag = Date.now().toString(36);
  const current = parts.map((text, index): NoteSentence => {
    const kept = pool.findIndex((sentence) => sentence.text === text);
    if (kept >= 0) return pool.splice(kept, 1)[0];
    return {
      id: `${note.id}-${key}-d${tag}${index}`,
      text,
      evidence: [],
      by: "doctor",
      flag: null,
    };
  });
  return {
    note: setSectionText(note, key, current),
    change: `Edited the ${TITLES[key]}`,
  };
}

export function checkSection(
  note: ClinicalNote,
  key: NoteSectionKey | NoteListKey,
  on: boolean,
): NoteEdit {
  const checked = isSectionKey(key)
    ? withSection(note, key, (section) => ({ ...section, checked: on }))
    : { ...note, checks: { ...note.checks, [key]: on } };
  return {
    note: checked,
    change: `${on ? "Checked" : "Unchecked"} the ${TITLES[key]}`,
  };
}

export const restoreSection = (
  note: ClinicalNote,
  key: NoteSectionKey,
): NoteEdit => ({
  note: withSection(note, key, (section) => ({
    ...section,
    current: section.draft,
    checked: false,
  })),
  change: `Restored the scribe's ${TITLES[key]}`,
});

/** Settle a flag with one of its options. `before` is the section as it was, for Undo. */
export function resolveFlag(
  note: ClinicalNote,
  sentenceId: string,
  option: number,
) {
  const section = note.sections.find((candidate) =>
    candidate.current.some((line) => line.id === sentenceId),
  );
  const sentence = section?.current.find((line) => line.id === sentenceId);
  const chosen = sentence?.flag?.options[option];
  if (!section || !sentence?.flag || !chosen) return null;
  const flag = sentence.flag;
  const current =
    chosen.text === null
      ? section.current.filter((line) => line.id !== sentenceId)
      : section.current.map((line) =>
          line.id === sentenceId
            ? {
                ...line,
                text: chosen.text ?? line.text,
                flag: { ...flag, resolved: chosen.label },
              }
            : line,
        );
  return {
    note: setSectionText(note, section.key, current),
    change: `Checked: ${chosen.label}`,
    key: section.key,
    before: section.current,
    label: chosen.label,
    removed: chosen.text === null,
  };
}

/** "Add to note" from the transcript: the moment becomes the doctor's sentence, linked to the call. */
export function addMissed(note: ClinicalNote, segmentId: string) {
  const segment = note.transcript.find((entry) => entry.id === segmentId);
  if (!segment?.missed) return null;
  const to = segment.missed.to;
  const sentenceId = `${note.id}-${to}-m${segmentId}`;
  const section = sectionOf(note, to);
  if (section.current.some((line) => line.id === sentenceId)) return null;
  const sentence: NoteSentence = {
    id: sentenceId,
    text: segment.missed.text,
    evidence: [{ segmentId, quote: null }],
    by: "doctor",
    flag: null,
  };
  return {
    note: setSectionText(note, to, [...section.current, sentence]),
    change: `Added to the ${TITLES[to]} from the transcript`,
    to,
    sentenceId,
  };
}

export const removeSentence = (
  note: ClinicalNote,
  key: NoteSectionKey,
  sentenceId: string,
): NoteEdit => ({
  note: setSectionText(
    note,
    key,
    sectionOf(note, key).current.filter(
      (sentence) => sentence.id !== sentenceId,
    ),
  ),
  change: `Took out of the ${TITLES[key]}`,
});

export function toggleMedicine(note: ClinicalNote, id: string): NoteEdit {
  const medicines = note.medicines.map((medicine) =>
    medicine.id === id ? { ...medicine, include: !medicine.include } : medicine,
  );
  const changed = medicines.find((medicine) => medicine.id === id);
  return {
    note: { ...note, medicines },
    change: `${changed?.include ? "Included" : "Left out"} ${changed?.name ?? "a medicine"}`,
  };
}

/** Ids of medicines the doctor typed in (the scribe's have evidence); only these can be removed. */
export const ADDED_MEDICINE_PREFIX = "added-";

export function addMedicine(
  note: ClinicalNote,
  medicine: Pick<MedicineChange, "action" | "name" | "strength" | "detail">,
): NoteEdit {
  const added: MedicineChange = {
    ...medicine,
    id: `${ADDED_MEDICINE_PREFIX}${Date.now().toString(36)}`,
    was: null,
    evidence: [],
    include: true,
  };
  return {
    note: { ...note, medicines: [...note.medicines, added] },
    change: `Added ${medicine.name}`,
  };
}

export function removeMedicine(note: ClinicalNote, id: string): NoteEdit {
  const removed = note.medicines.find((medicine) => medicine.id === id);
  return {
    note: {
      ...note,
      medicines: note.medicines.filter((medicine) => medicine.id !== id),
    },
    change: `Removed ${removed?.name ?? "a medicine"}`,
  };
}

export function toggleFollowUp(note: ClinicalNote, id: string): NoteEdit {
  const followUps = note.followUps.map((followUp) =>
    followUp.id === id ? { ...followUp, include: !followUp.include } : followUp,
  );
  const changed = followUps.find((followUp) => followUp.id === id);
  return {
    note: { ...note, followUps },
    change: `${changed?.include ? "Included" : "Left out"}: ${changed?.text ?? "a follow-up"}`,
  };
}

export function toggleRecordUpdate(note: ClinicalNote, id: string): NoteEdit {
  const recordUpdates = note.recordUpdates.map((update) =>
    update.id === id ? { ...update, include: !update.include } : update,
  );
  const changed = recordUpdates.find((update) => update.id === id);
  return {
    note: { ...note, recordUpdates },
    change: `${changed?.include ? "Included" : "Left out"}: ${changed?.label ?? "a record update"}`,
  };
}

/** After signing, a follow-up can still be ticked off as done. */
export function markFollowUpDone(note: ClinicalNote, id: string): NoteEdit {
  const followUps = note.followUps.map((followUp) =>
    followUp.id === id ? { ...followUp, done: !followUp.done } : followUp,
  );
  const changed = followUps.find((followUp) => followUp.id === id);
  return {
    note: { ...note, followUps },
    change: `${changed?.done ? "Done" : "Not done"}: ${changed?.text ?? ""}`,
  };
}
