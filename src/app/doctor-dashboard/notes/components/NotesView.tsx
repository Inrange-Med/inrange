"use client";

/** /doctor-dashboard/notes: the scribe's drafts waiting to be signed, oldest first, and the last month's signed ones. */

import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import { listClinicalNotes } from "@/services/clinicalNoteService";
import { listPatientSnapshots } from "@/services/patientRecordService";
import NotesTabs from "./NotesTabs";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";

export default function NotesView() {
  const notes = useApiResource("clinical-notes", listClinicalNotes);
  const snapshots = useApiResource("patient-snapshots", listPatientSnapshots);

  return (
    <main className={clinicStyles.page}>
      <PageHead
        className={clinicStyles.pageHead}
        title="Notes"
        sub="Every finished call leaves a draft note here. Nothing reaches a record until you sign it."
      />
      {notes.error && !notes.data ? (
        <ErrorNotice message={notes.error} onRetry={notes.reload} />
      ) : notes.loading ? (
        <LoadingSkeleton />
      ) : notes.data ? (
        <NotesTabs notes={notes.data} snapshots={snapshots.data ?? []} />
      ) : (
        <p className={clinicStyles.empty}>
          Call notes are not available yet. Drafts appear here once the scribe
          is connected.
        </p>
      )}
    </main>
  );
}
