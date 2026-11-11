"use client";

/** /doctor-dashboard/notes: the scribe's drafts waiting to be signed, oldest first, and the last month's signed ones. */

import ErrorNotice from "@/components/ui/ErrorNotice";
import ClinicSkeleton from "@/app/doctor-dashboard/components/ClinicSkeleton";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import { listClinicalNotes } from "@/services/clinicalNoteService";
import { listPatientSnapshots } from "@/services/patientRecordService";
import NotesTabs from "./NotesTabs";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import conversationStyles from "@/app/doctor-dashboard/styles/ClinicConversations.module.css";
import styles from "../NotesPage.module.css";

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
        <ClinicSkeleton titled={false} />
      ) : notes.data ? (
        <NotesTabs notes={notes.data} snapshots={snapshots.data ?? []} />
      ) : (
        <div className={`${conversationStyles.empty} ${styles.empty}`}>
          <p>
            Call notes are not available yet. Drafts appear here once the scribe
            is connected.
          </p>
        </div>
      )}
    </main>
  );
}
