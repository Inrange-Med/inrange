/**
 * What a call note's state means, read from ClinicalNote (Arhaan's notes-store selectors without the
 * store): section titles, whether it is still being written, what blocks signing, the queue to sign
 * and how far the review has got. Derived, never stored, so it can never go stale.
 */

import type {
  ClinicalNote,
  NoteListKey,
  NoteSection,
  NoteSectionKey,
} from "@/types/clinicalNote";

export type Blocker = { label: string; target: string };

export const TITLES: Record<NoteSectionKey | NoteListKey, string> = {
  summary: "Visit summary",
  assessment: "Assessment",
  plan: "Plan",
  patient: "For the patient",
  medicines: "Medicines",
  followUps: "Follow-ups",
  recordUpdates: "Record updates",
};

export const isSectionKey = (key: string): key is NoteSectionKey =>
  key === "summary" ||
  key === "assessment" ||
  key === "plan" ||
  key === "patient";

export const writing = (note: ClinicalNote, now: number) =>
  note.status === "DRAFT" && now < Date.parse(note.readyAt);
export const sectionOf = (
  note: ClinicalNote,
  key: NoteSectionKey,
): NoteSection =>
  note.sections.find((section) => section.key === key) ?? {
    key,
    draft: [],
    current: [],
    checked: false,
  };
export const openFlags = (note: ClinicalNote) =>
  note.sections.flatMap((section) =>
    section.current.filter(
      (sentence) => sentence.flag && !sentence.flag.resolved,
    ),
  );
export const firstName = (note: ClinicalNote) => note.patientName.split(" ")[0];
export const rxChanges = (note: ClinicalNote) =>
  note.medicines.filter(
    (medicine) => medicine.action !== "CONTINUE" && medicine.include,
  );
export const prose = (note: ClinicalNote, key: NoteSectionKey) =>
  sectionOf(note, key)
    .current.map((sentence) => sentence.text)
    .join(key === "plan" ? "\n" : " ");

/** What stops signing, each with the element to scroll to. */
export function blockers(note: ClinicalNote): Blocker[] {
  const out: Blocker[] = [];
  const flags = openFlags(note);
  if (flags.length)
    out.push({
      label: `${flags.length} to check`,
      target: `sent-${flags[0].id}`,
    });
  if (!sectionOf(note, "summary").current.length)
    out.push({ label: "Visit summary is empty", target: "sec-summary" });
  if (!sectionOf(note, "plan").current.length)
    out.push({ label: "Plan is empty", target: "sec-plan" });
  return out;
}

/** Written, nothing left to check, nothing empty. The screens call it "Ready to sign". */
export const isReady = (note: ClinicalNote, now: number) =>
  !writing(note, now) && note.status === "DRAFT" && blockers(note).length === 0;

/** Drafts that are written, oldest call first: the longest-waiting note is the liability. */
export const toSign = (notes: ClinicalNote[], now: number) =>
  notes
    .filter((note) => note.status === "DRAFT" && !writing(note, now))
    .sort((a, b) => a.callAt.localeCompare(b.callAt));

/**
 * Where the review stands: the medicine list shows on every draft (the doctor can add a medicine there)
 * and on signed notes with rows; follow-ups show once the call was transcribed or they have rows. A
 * section counts as unticked only while it has text (ticks are optional).
 */
export function reviewProgress(note: ClinicalNote) {
  const showMedicines =
    note.status === "DRAFT" || note.transcribed || note.medicines.length > 0;
  const showFollowUps = note.transcribed || note.followUps.length > 0;
  const listKeys: NoteListKey[] = [
    ...(showMedicines ? (["medicines"] as const) : []),
    ...(showFollowUps ? (["followUps"] as const) : []),
    ...(note.recordUpdates.length ? (["recordUpdates"] as const) : []),
  ];
  const hasRows = (key: NoteListKey) =>
    (key !== "medicines" || note.medicines.length > 0) &&
    (key !== "followUps" || note.followUps.length > 0);
  const unchecked = [
    ...note.sections
      .filter((section) => section.current.length && !section.checked)
      .map((section) => TITLES[section.key]),
    ...listKeys
      .filter((key) => !note.checks[key] && hasRows(key))
      .map((key) => TITLES[key]),
  ];
  const sectionsShown =
    note.sections.filter((section) => section.current.length).length +
    listKeys.filter(hasRows).length;
  return { showMedicines, showFollowUps, unchecked, sectionsShown };
}

/** Clinical moments in the call that no sentence in the note uses. */
export function missedOpen(note: ClinicalNote) {
  const cited = new Set(
    note.sections.flatMap((section) =>
      section.current.flatMap((sentence) =>
        sentence.evidence.map((evidence) => evidence.segmentId),
      ),
    ),
  );
  return note.transcript.filter(
    (segment) => segment.missed && !cited.has(segment.id),
  );
}

/** Edited: the doctor's text differs from the scribe's in any way. */
export const isEdited = (section: NoteSection) =>
  section.current.length !== section.draft.length ||
  section.current.some(
    (sentence, index) =>
      sentence.id !== section.draft[index].id ||
      sentence.text !== section.draft[index].text,
  );
