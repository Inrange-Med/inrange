"use client";

/*
  Loads one call note with what its review needs: the queue of notes to sign, the patient's record
  (safety facts, prescriptions, flagged symptoms) and the signed-in doctor, then hands it to
  NoteReviewBody. Endpoints: GET /api/doctor/notes/<id> and /api/doctor/notes (proposed), the
  patient record (proposed), GET /api/doctor/patients and the doctor's profile.
*/

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ErrorNotice from "@/components/ui/ErrorNotice";
import ClinicSkeleton from "@/app/doctor-dashboard/components/ClinicSkeleton";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import type { BackDestination } from "@/lib/navigation/backDestination";
import {
  getClinicalNote,
  listClinicalNotes,
} from "@/services/clinicalNoteService";
import {
  getMyDoctorProfile,
  listMyPatients,
} from "@/services/doctorPortalService";
import { getPatientRecord } from "@/services/patientRecordService";
import type { ClinicalNote } from "@/types/clinicalNote";
import {
  possessive,
  shortDoctorName,
} from "@/app/doctor-dashboard/notes/components/noteFormat";
import NoteReviewBody from "./NoteReviewBody";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";

/** Where Back goes (?from=): Today, the patient's record (once the note says whose), else the Notes list. */
function backFor(
  from: string | null,
  note: ClinicalNote | null,
): BackDestination {
  if (from === "today") return { href: "/doctor-dashboard", label: "Today" };
  if (from === "patient" && note)
    return {
      href: `/doctor-dashboard/patients/${note.patientId}`,
      label: note.patientName,
    };
  return { href: "/doctor-dashboard/notes", label: "Notes" };
}

export default function NoteReviewView({ noteId }: { noteId: string }) {
  const from = useSearchParams().get("from");
  const note = useApiResource(`clinical-note-${noteId}`, () =>
    getClinicalNote(noteId),
  );
  const notes = useApiResource("clinical-notes", listClinicalNotes);
  const patientId = note.data?.patientId ?? null;
  const record = useApiResource(
    patientId ? `patient-record-${patientId}` : null,
    () => getPatientRecord(patientId ?? ""),
  );
  const patients = useApiResource("doctor-patients", listMyPatients);
  const profile = useApiResource("doctor-profile", getMyDoctorProfile);
  const back = backFor(from, note.data);

  if (note.error && !note.data)
    return (
      <main className={clinicStyles.page}>
        <PageHead
          className={clinicStyles.pageHead}
          title="Call note"
          back={back}
        />
        <ErrorNotice message={note.error} onRetry={note.reload} />
      </main>
    );
  if (
    note.loading ||
    (patientId && record.loading && !record.data && !record.error)
  )
    return (
      <main className={clinicStyles.page}>
        <ClinicSkeleton />
      </main>
    );
  if (!note.data)
    return (
      <main className={clinicStyles.page}>
        <PageHead
          className={clinicStyles.pageHead}
          title="Note not available"
          back={back}
          sub={
            <>
              It may belong to another doctor, or call notes are not available
              yet. <Link href="/doctor-dashboard/notes">Back to Notes</Link>
            </>
          }
        />
      </main>
    );

  const fullName = profile.data?.fullName ?? "You";
  return (
    <NoteReviewBody
      note={note.data}
      notes={notes.data ?? []}
      record={record.data}
      their={possessive(
        patients.data?.find((patient) => patient.id === note.data?.patientId)
          ?.sex ?? "",
      )}
      back={back}
      doctor={{
        name: fullName,
        shortName: shortDoctorName(fullName),
        qualification: profile.data?.specialization ?? "",
        photoUrl: profile.data?.photoUrl ?? null,
      }}
      setNote={note.setData}
      reloadNote={note.reload}
    />
  );
}
