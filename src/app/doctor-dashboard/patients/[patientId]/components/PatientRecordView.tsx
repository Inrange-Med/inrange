"use client";

/*
  One patient's record (Arhaan's clinician PatientRecord): everything a doctor needs before and
  during a consultation, safety first. Who the patient is and their next visit come from the team
  endpoints (GET /api/doctor/patients, GET /api/appointments/doctor); the clinical record, photos,
  queue and call notes come from proposed endpoints and the page says so calmly until they exist.
  A first-consultation record shows one "Before the first consultation" panel instead of empty
  prescriptions, plan, labs and visits.
*/

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ErrorNotice from "@/components/ui/ErrorNotice";
import ClinicSkeleton from "@/app/doctor-dashboard/components/ClinicSkeleton";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { useNow } from "@/hooks/useNow";
import { errorMessage } from "@/lib/http/apiClient";
import type { BackDestination } from "@/lib/navigation/backDestination";
import { getSessionUser } from "@/lib/session/authSession";
import { listClinicalNotes } from "@/services/clinicalNoteService";
import {
  listAllAppointments,
  listMyPatients,
} from "@/services/doctorPortalService";
import {
  getPatientRecord,
  listProgressPhotos,
  listWaitingItems,
  recordPhotoViewing,
} from "@/services/patientRecordService";
import { isFreshRecord, recordChips } from "./recordChips";
import ActivityPanel from "./ActivityPanel";
import FirstConsultationPanel from "./FirstConsultationPanel";
import LabsPanel from "./LabsPanel";
import OverviewPanel from "./OverviewPanel";
import PhotosPanel from "./PhotosPanel";
import PlanPanel from "./PlanPanel";
import PrescriptionsPanel from "./PrescriptionsPanel";
import PrivateNotesPanel from "./PrivateNotesPanel";
import ProgrammePlanPanel from "./ProgrammePlanPanel";
import RecordHeader from "./RecordHeader";
import RecordSectionNav from "./RecordSectionNav";
import SafetyStrip from "./SafetyStrip";
import TrackersPanel from "./TrackersPanel";
import VisitsPanel from "./VisitsPanel";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "../PatientRecordPage.module.css";

/** Where the record was opened from (?from=), so the back link returns there. */
const ORIGINS: Record<string, (patientId: string) => BackDestination> = {
  today: () => ({ label: "Today", href: "/doctor-dashboard" }),
  schedule: () => ({ label: "Schedule", href: "/doctor-dashboard/schedule" }),
  messages: (patientId) => ({
    label: "Messages",
    href: `/doctor-dashboard/messages?p=${patientId}`,
  }),
  notes: () => ({ label: "Notes", href: "/doctor-dashboard/notes" }),
};

export default function PatientRecordView({
  patientId,
}: {
  patientId: string;
}) {
  const from = useSearchParams().get("from") ?? "";
  const toast = useToast();
  const now = useNow();
  const [doctorName] = useState(() => getSessionUser()?.fullName || "you");

  const patients = useApiResource("doctor-patients", listMyPatients);
  const appointments = useApiResource(
    "doctor-all-appointments",
    listAllAppointments,
  );
  const record = useApiResource(`record-${patientId}`, () =>
    getPatientRecord(patientId),
  );
  const photos = useApiResource(
    record.data?.photosShared ? `photos-${patientId}` : null,
    () => listProgressPhotos(patientId),
  );
  const queue = useApiResource("doctor-queue", listWaitingItems);
  const notes = useApiResource("doctor-notes", listClinicalNotes);

  // a link to a section (a signed note's "Review and sign" opens #prescriptions) lands on it once the
  // record is on screen; the browser cannot, because the section does not exist until the data loads
  const loaded = Boolean(record.data);
  useEffect(() => {
    if (!loaded || !window.location.hash) return;
    document
      .getElementById(decodeURIComponent(window.location.hash.slice(1)))
      ?.scrollIntoView({ block: "start" });
  }, [loaded]);

  const nextVisit = useMemo(
    () =>
      (appointments.data ?? []).find(
        (appointment) =>
          appointment.patientId === patientId &&
          appointment.status === "BOOKED" &&
          Date.parse(appointment.startsAt) + 30 * 6e4 > now,
      ),
    [appointments.data, patientId, now],
  );
  const origin = (
    ORIGINS[from] ??
    (() => ({ label: "Patients", href: "/doctor-dashboard/patients" }))
  )(patientId);

  if (patients.error && !patients.data) {
    return (
      <main className={clinicStyles.page}>
        <ErrorNotice message={patients.error} onRetry={patients.reload} />
      </main>
    );
  }
  if (!patients.data || (record.loading && !record.data)) {
    return (
      <main className={clinicStyles.page}>
        <ClinicSkeleton />
      </main>
    );
  }

  const patient = patients.data.find((candidate) => candidate.id === patientId);
  if (!patient) {
    return (
      <main className={clinicStyles.page}>
        <PageHead
          className={clinicStyles.pageHead}
          title="Patient not found"
          back={origin}
          sub={
            <>
              The record may belong to another doctor.{" "}
              <Link href="/doctor-dashboard/patients">
                Back to your patients
              </Link>
            </>
          }
        />
      </main>
    );
  }

  const data = record.data;
  const message = (queue.data ?? []).find(
    (item) => item.kind === "message" && item.patientId === patientId,
  );
  const noteToSign = (notes.data ?? [])
    .filter(
      (note) =>
        note.patientId === patientId &&
        note.status === "DRAFT" &&
        Date.parse(note.readyAt) <= now,
    )
    .sort((a, b) => a.callAt.localeCompare(b.callAt))[0];
  const header = (
    <RecordHeader
      patient={patient}
      record={data ?? null}
      origin={origin}
      nextVisit={nextVisit}
      message={message}
      now={now}
    />
  );

  if (!data) {
    return (
      <main className={clinicStyles.page}>
        {header}
        {record.error ? (
          <ErrorNotice message={record.error} onRetry={record.reload} />
        ) : (
          <section className={clinicStyles.panel}>
            <p className={clinicStyles.empty}>
              The clinical record is not available yet. Allergies,
              prescriptions, labs, trackers, notes and visits will appear here.
            </p>
          </section>
        )}
      </main>
    );
  }

  // a first-consultation record: one panel saying what to collect, never five empty ones
  const fresh = isFreshRecord(data);
  const sharedPhotos = photos.data ?? null;
  const chips = recordChips(data, !!sharedPhotos);

  return (
    <main className={clinicStyles.page}>
      {header}
      <SafetyStrip record={data} onChanged={record.reload} />
      <RecordSectionNav key={fresh ? "fresh" : "care"} chips={chips} />

      <div className={styles.recGrid}>
        <OverviewPanel record={data} sex={patient.sex} />
        {fresh && <FirstConsultationPanel screening={data.screening} />}
        {!fresh && (
          <PrescriptionsPanel
            patientId={patientId}
            prescriptions={data.prescriptions}
            doctorName={doctorName}
            onChanged={record.reload}
          />
        )}
        {!fresh && <PlanPanel plan={data.plan} />}
        {!fresh && (
          <ProgrammePlanPanel
            patientId={patientId}
            record={data}
            onChanged={record.reload}
          />
        )}
        {!fresh && (
          <LabsPanel
            patientId={patientId}
            labs={data.labs}
            onChanged={record.reload}
          />
        )}
        <TrackersPanel record={data} onChanged={record.reload} />
        <PrivateNotesPanel
          patientId={patientId}
          notes={data.privateNotes}
          onChanged={record.reload}
        />
        {sharedPhotos && (
          <PhotosPanel
            sets={sharedPhotos}
            onShow={() =>
              recordPhotoViewing(patientId)
                .then(record.reload)
                .catch((caught) => toast(errorMessage(caught)))
            }
          />
        )}
        {!fresh && <VisitsPanel visits={data.visits} noteToSign={noteToSign} />}
        <ActivityPanel record={data} />
      </div>
    </main>
  );
}
