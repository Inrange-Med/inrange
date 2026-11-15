/**
 * A call note: the scribe's draft of a transcribed video consultation, which the doctor checks,
 * edits and signs. Nothing reaches the record or the patient's app before it is signed, and
 * medicine changes only ever become a draft prescription signed separately.
 * Proposed endpoints: docs/backend/doctor-dashboard.md (GET/PUT /api/doctor/notes...).
 */

import type { VisitType } from "@/types/patientRecord";

export type TranscriptSpeaker = "doctor" | "patient";
export type NoteSectionKey = "summary" | "assessment" | "plan" | "patient";
/** The lists below the prose, which the doctor can mark checked but not rewrite. */
export type NoteListKey = "medicines" | "followUps" | "recordUpdates";

/**
 * One turn of the call. `english`: an English rendering of a mostly-Hindi line. `unsure`: the words
 * the transcriber was not sure of (a substring of text). `missed`: a clinical moment no sentence in
 * the note uses, with the sentence to add if the doctor wants it.
 */
export type TranscriptSegment = {
  id: string;
  /** seconds from the start of the call */
  t: number;
  who: TranscriptSpeaker;
  text: string;
  english: string | null;
  unsure: string | null;
  missed: { to: "summary" | "plan"; text: string } | null;
};

/** Where a sentence came from: a segment, and optionally the exact words in it. */
export type Evidence = { segmentId: string; quote: string | null };

export type NoteFlagKind = "unclear" | "conflict" | "unsaid";
/** An option with `text: null` removes the sentence. `resolved` holds the chosen option's label. */
export type NoteFlag = {
  kind: NoteFlagKind;
  why: string;
  options: { label: string; text: string | null }[];
  resolved: string | null;
};

export type NoteSentence = {
  id: string;
  text: string;
  evidence: Evidence[];
  by: "scribe" | "doctor";
  flag: NoteFlag | null;
};

/** `draft`: the scribe's original, kept for "Restore". `current`: what the doctor sees and edits. */
export type NoteSection = {
  key: NoteSectionKey;
  draft: NoteSentence[];
  current: NoteSentence[];
  checked: boolean;
};

export type MedicineChange = {
  id: string;
  action: "START" | "CHANGE" | "STOP" | "CONTINUE";
  name: string;
  strength: string;
  detail: string;
  was: string | null;
  evidence: Evidence[];
  include: boolean;
  /** the pharmacy item it was picked from (GET /api/pharmacy/inventory); null when typed in, so not in the cart */
  medicineId?: string | null;
  /** packs to dispense (pens, strips); goes into the patient's cart as the most they can buy */
  quantity?: number | null;
};

export type NoteFollowUp = {
  id: string;
  text: string;
  owner: "You" | "Care team" | "Dietitian";
  evidence: Evidence[];
  include: boolean;
  done: boolean;
};

export type RecordUpdate = {
  id: string;
  field: "allergies" | "identity_verified" | "outside_medicines";
  label: string;
  from: string;
  to: string;
  include: boolean;
};

export type NoteSignature = {
  at: string;
  by: string;
  byQualification: string;
  /** the draft prescription the medicine changes became, if any, and where it stands now */
  prescriptionVersion: number | null;
  prescriptionStatus: "DRAFT" | "SIGNED" | null;
  sentToApp: boolean;
};

/** GET /api/doctor/notes/:noteId */
export type ClinicalNote = {
  id: string;
  /** whether the patient has an active plan: off the plan (first consultation), a prescription is one month */
  patientOnPlan?: boolean;
  patientId: string;
  patientName: string;
  type: VisitType;
  reason: string;
  callAt: string;
  minutes: number;
  /** false: the patient declined call transcription, so there is no draft or transcript */
  transcribed: boolean;
  /** the scribe is still writing while now < readyAt */
  readyAt: string;
  status: "DRAFT" | "SIGNED";
  /** always the four keys, in order: summary, assessment, plan, patient */
  sections: NoteSection[];
  medicines: MedicineChange[];
  followUps: NoteFollowUp[];
  recordUpdates: RecordUpdate[];
  checks: Partial<Record<NoteListKey, boolean>>;
  transcript: TranscriptSegment[];
  signed: NoteSignature | null;
  addenda: { at: string; by: string; text: string }[];
  history: { at: string; what: string }[];
};

/** PUT /api/doctor/notes/:noteId body: everything the doctor can change on a draft, and what changed. */
export type ClinicalNoteChanges = Pick<
  ClinicalNote,
  "sections" | "medicines" | "followUps" | "recordUpdates" | "checks"
> & {
  /** one line for the note's history, e.g. "Edited the Visit summary" */
  change: string;
};
