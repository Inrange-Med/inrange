"use client";

/*
  Patients (Arhaan's clinician Patients): every patient under this doctor, searchable and filtered,
  with what matters at a glance. Real data: the patient list (GET /api/doctor/patients) and the
  consultations (for the next visit, and who has not had a first consultation yet). Proposed: the
  per-patient snapshot (programme, BMI, HbA1c) and the queue ("Waiting on you").
*/

import { useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import ClinicSkeleton from "@/app/doctor-dashboard/components/ClinicSkeleton";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import {
  listAllAppointments,
  listMyPatients,
} from "@/services/doctorPortalService";
import {
  listPatientSnapshots,
  listWaitingItems,
} from "@/services/patientRecordService";
import { flagsByPatient } from "@/app/doctor-dashboard/components/waitingWords";
import PatientRow from "./PatientRow";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "../PatientsPage.module.css";

type Filter = "All" | "Waiting on you" | "Diabetes" | "First consultation";

export default function PatientsView() {
  const patients = useApiResource("doctor-patients", listMyPatients);
  const appointments = useApiResource(
    "doctor-all-appointments",
    listAllAppointments,
  );
  const snapshots = useApiResource(
    "doctor-patient-snapshots",
    listPatientSnapshots,
  );
  const queue = useApiResource("doctor-queue", listWaitingItems);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [now] = useState(() => Date.now());

  const waiting = useMemo(() => flagsByPatient(queue.data ?? []), [queue.data]);
  const snapshotOf = useMemo(
    () =>
      new Map(
        (snapshots.data ?? []).map((snapshot) => [
          snapshot.patientId,
          snapshot,
        ]),
      ),
    [snapshots.data],
  );
  const { nextVisit, seen } = useMemo(() => {
    const next = new Map<string, string>();
    const hadConsultation = new Set<string>();
    for (const a of appointments.data ?? []) {
      if (!a.patientId) continue;
      if (a.status === "COMPLETED") hadConsultation.add(a.patientId);
      if (
        a.status === "BOOKED" &&
        Date.parse(a.startsAt) > now &&
        !next.has(a.patientId)
      )
        next.set(a.patientId, a.startsAt);
    }
    return { nextVisit: next, seen: hadConsultation };
  }, [appointments.data, now]);

  if (patients.error && !patients.data) {
    return (
      <main className={clinicStyles.page}>
        <ErrorNotice message={patients.error} onRetry={patients.reload} />
      </main>
    );
  }
  if (!patients.data) {
    return (
      <main className={clinicStyles.page}>
        <ClinicSkeleton />
      </main>
    );
  }

  // the filters that have data behind them
  const filters: Filter[] = [
    "All",
    ...(queue.data ? (["Waiting on you"] as const) : []),
    ...(snapshots.data ? (["Diabetes"] as const) : []),
    "First consultation",
  ];
  const underCare = patients.data.filter((patient) =>
    seen.has(patient.id),
  ).length;
  const newcomers = patients.data.length - underCare;
  const query = search.trim().toLowerCase();

  const shown = patients.data.filter((patient) => {
    const snapshot = snapshotOf.get(patient.id);
    if (
      query &&
      !`${patient.fullName} ${patient.mobile} ${snapshot?.city ?? ""} ${snapshot?.conditions.join(" ") ?? ""}`
        .toLowerCase()
        .includes(query)
    )
      return false;
    if (filter === "Waiting on you") return waiting.has(patient.id);
    if (filter === "Diabetes")
      return !!snapshot?.conditions.some((condition) =>
        /^type 2 diabetes$/i.test(condition),
      );
    if (filter === "First consultation") return !seen.has(patient.id);
    return true;
  });

  return (
    <main className={clinicStyles.page}>
      <PageHead
        className={clinicStyles.pageHead}
        title="Patients"
        sub={
          <>
            <span className="num">{underCare}</span> under your care
            {newcomers ? (
              <>
                {" "}
                and <span className="num">{newcomers}</span> new
              </>
            ) : null}
            .
            {queue.data && (
              <>
                {" "}
                <span className="num">{waiting.size}</span> with something
                waiting on you.
              </>
            )}
          </>
        }
      />
      {appointments.error && (
        <div className={styles.notice}>
          <ErrorNotice
            message={appointments.error}
            onRetry={appointments.reload}
          />
        </div>
      )}

      <div className={styles.tools}>
        <label className={styles.search}>
          <MagnifyingGlass size={18} aria-hidden="true" />
          <span className="sr-only">Search patients</span>
          <input
            type="search"
            placeholder={
              snapshots.data ? "Name, city or condition" : "Name or mobile"
            }
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className={styles.filters} role="radiogroup" aria-label="Filter">
          {filters.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={filter === option}
              className={styles.filter}
              onClick={() => setFilter(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <section className={clinicStyles.panel} aria-label="Patient list">
        <div className={styles.listHead} aria-hidden="true">
          <span>Patient</span>
          <span>Programme</span>
          <span>BMI</span>
          <span>HbA1c</span>
          <span>Next visit</span>
          <span />
        </div>
        <ul className={styles.plist}>
          {shown.map((patient) => (
            <li key={patient.id}>
              <PatientRow
                patient={patient}
                snapshot={snapshotOf.get(patient.id) ?? null}
                waiting={waiting.get(patient.id)}
                nextVisit={nextVisit.get(patient.id)}
              />
            </li>
          ))}
        </ul>
        {!shown.length && (
          <p className={clinicStyles.empty}>
            {patients.data.length
              ? "No patients match. Clear the search or choose All."
              : "No patients yet. Patients appear here once they book with you."}
          </p>
        )}
      </section>
    </main>
  );
}
