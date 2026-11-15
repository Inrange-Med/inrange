/**
 * Call notes the scribe drafts from each transcribed consultation, for the doctor to check and sign.
 * Doc: docs/backend/doctor-dashboard.md
 *   GET  /api/doctor/notes                   PROPOSED. The doctor's drafts, and notes signed in the last 30 days
 *   GET  /api/doctor/notes/:noteId           PROPOSED. One note with its transcript
 *   PUT  /api/doctor/notes/:noteId           PROPOSED. Saves the doctor's edits to a draft (ClinicalNoteChanges)
 *   POST /api/doctor/notes/:noteId/sign      Signs it into the record { sendToApp, rxMonths }; also signs the prescription
 *   POST /api/doctor/notes/:noteId/addenda   PROPOSED. Adds a signed addendum to a signed note { text }
 * Each write answers with the whole updated note. Reads return null on 404, so screens can say so.
 */

import { apiRequest, listFrom, nullWhenMissing } from "@/lib/http/apiClient";
import type { ClinicalNote, ClinicalNoteChanges } from "@/types/clinicalNote";

function toClinicalNote(raw: ClinicalNote): ClinicalNote {
  return {
    ...raw,
    id: String(raw.id),
    patientId: String(raw.patientId),
    sections: raw.sections ?? [],
    medicines: raw.medicines ?? [],
    followUps: raw.followUps ?? [],
    recordUpdates: raw.recordUpdates ?? [],
    checks: raw.checks ?? {},
    transcript: raw.transcript ?? [],
    signed: raw.signed ?? null,
    addenda: raw.addenda ?? [],
    history: raw.history ?? [],
  };
}

const noteFrom = (body: { data?: ClinicalNote }) =>
  toClinicalNote((body.data ?? body) as ClinicalNote);

export function listClinicalNotes(): Promise<ClinicalNote[] | null> {
  return nullWhenMissing(async () =>
    listFrom<ClinicalNote>(await apiRequest("/api/doctor/notes"), "notes").map(
      toClinicalNote,
    ),
  );
}

export function getClinicalNote(noteId: string): Promise<ClinicalNote | null> {
  return nullWhenMissing(async () =>
    noteFrom(await apiRequest(`/api/doctor/notes/${noteId}`)),
  );
}

export async function saveClinicalNote(
  noteId: string,
  changes: ClinicalNoteChanges,
): Promise<ClinicalNote> {
  return noteFrom(
    await apiRequest(`/api/doctor/notes/${noteId}`, {
      method: "PUT",
      body: changes,
    }),
  );
}

export async function signClinicalNote(
  noteId: string,
  sendToApp: boolean,
  rxMonths: number,
): Promise<ClinicalNote> {
  return noteFrom(
    await apiRequest(`/api/doctor/notes/${noteId}/sign`, {
      method: "POST",
      body: { sendToApp, rxMonths },
    }),
  );
}

export async function addClinicalNoteAddendum(
  noteId: string,
  text: string,
): Promise<ClinicalNote> {
  return noteFrom(
    await apiRequest(`/api/doctor/notes/${noteId}/addenda`, {
      method: "POST",
      body: { text },
    }),
  );
}
