/**
 * A patient's clinical record, from their doctor's side, and the doctor's work queue.
 * Doc: docs/backend/doctor-dashboard.md
 *   GET    /api/doctor/patients/:patientId/record                                PROPOSED. The record
 *   GET    /api/doctor/patients/snapshots                                        PROPOSED. The patient list's columns per patient
 *   GET    /api/doctor/queue                                                     PROPOSED. What is waiting on the doctor
 *   GET    /api/doctor/work-counts                                               PROPOSED. Navigation badge counts
 *   GET    /api/doctor/patients/:patientId/photos                                PROPOSED. Shared progress photos
 *   POST   /api/doctor/patients/:patientId/photos/viewed                         PROPOSED. Logs a look at the photos
 *   POST   /api/doctor/patients/:patientId/symptoms/:symptomId/acknowledgement   PROPOSED. Acknowledges a symptom { outcome }
 *   DELETE /api/doctor/patients/:patientId/symptoms/:symptomId/acknowledgement   PROPOSED. Undoes that
 *   POST   /api/doctor/patients/:patientId/labs/:labId/review                    PROPOSED. Marks a lab report reviewed { comment }
 *   POST   /api/doctor/patients/:patientId/prescriptions/:prescriptionId/sign    PROPOSED. Signs a draft prescription
 *   POST   /api/doctor/patients/:patientId/private-notes                         PROPOSED. Adds a private note { text }
 *   POST   /api/doctor/patients/:patientId/plan-recommendation                   Suggests a plan { planId, note }
 *   DELETE /api/doctor/patients/:patientId/plan-recommendation                   Withdraws that suggestion
 * Reads return null on 404, so screens can say so. BMI, care week and "since the last visit" are
 * worked out here from the record.
 */

import {
  ApiError,
  apiRequest,
  listFrom,
  nullWhenMissing,
} from "@/lib/http/apiClient";
import type {
  DoctorWorkCounts,
  PatientRecord,
  PatientSnapshot,
  ProgressPhotoSet,
  SinceLastVisit,
  WaitingItem,
} from "@/types/patientRecord";

const WEEK_MS = 7 * 864e5;

const dataOf = <T>(body: { data?: T } | T): T =>
  ((body as { data?: T }).data ?? body) as T;

const careWeekFrom = (careStartedAt: string | null) =>
  careStartedAt
    ? Math.max(1, Math.ceil((Date.now() - Date.parse(careStartedAt)) / WEEK_MS))
    : null;

/** What changed since the last consultation: the doctor's first question. */
function sinceLastVisitOf(record: PatientRecord): SinceLastVisit | null {
  const lastVisit = [...record.visits].sort((first, second) =>
    second.at.localeCompare(first.at),
  )[0];
  if (!lastVisit) return null;
  const before =
    record.weights.filter((weight) => weight.at <= lastVisit.at).at(-1) ??
    record.weights[0];
  const latest = record.weights.at(-1);
  const newLab = record.labs.find(
    (lab) => (lab.reportedAt ?? "") > lastVisit.at,
  );
  const newSymptom = record.symptoms.find(
    (symptom) => symptom.at > lastVisit.at && symptom.requiresReview,
  );
  const isHba1c = (result: { test: string }) => result.test === "HbA1c";
  const hba1c = newLab?.results.find(isHba1c);
  const hba1cBefore = record.labs
    .find((lab) => lab !== newLab && lab.results.some(isHba1c))
    ?.results.find(isHba1c);
  return {
    at: lastVisit.at,
    weightChangeKg:
      before && latest && latest !== before
        ? Math.round((latest.kg - before.kg) * 10) / 10
        : null,
    news: newSymptom
      ? `${newSymptom.label}, ${newSymptom.severity.toLowerCase()}`
      : hba1c
        ? `HbA1c ${hba1c.value}%${hba1cBefore ? `, was ${hba1cBefore.value}%` : ""}`
        : newLab
          ? `${newLab.packageName} ready`
          : null,
  };
}

function toPatientRecord(
  raw: Partial<PatientRecord>,
  patientId: string,
): PatientRecord {
  const record: PatientRecord = {
    patientId,
    planRecommendation: raw.planRecommendation ?? null,
    activePlan: raw.activePlan ?? null,
    programme: raw.programme ?? "",
    city: raw.city ?? "",
    careStartedAt: raw.careStartedAt ?? null,
    identityVerified: raw.identityVerified ?? false,
    heightCm: raw.heightCm ?? null,
    weights: [...(raw.weights ?? [])].sort((first, second) =>
      first.at.localeCompare(second.at),
    ),
    waist: raw.waist ?? null,
    hba1c: [...(raw.hba1c ?? [])].sort((first, second) =>
      first.at.localeCompare(second.at),
    ),
    conditions: raw.conditions ?? [],
    allergies: raw.allergies ?? null,
    outsideMedicines: raw.outsideMedicines ?? null,
    consents: raw.consents ?? [],
    plan: raw.plan ?? null,
    concern: raw.concern ?? "",
    screening: raw.screening ?? null,
    labs: raw.labs ?? [],
    prescriptions: raw.prescriptions ?? [],
    visits: raw.visits ?? [],
    symptoms: raw.symptoms ?? [],
    adherence: raw.adherence ?? null,
    injections: raw.injections ?? null,
    privateNotes: raw.privateNotes ?? [],
    audit: raw.audit ?? [],
    photosShared: raw.photosShared ?? false,
    bmi: null,
    careWeek: careWeekFrom(raw.careStartedAt ?? null),
    sinceLastVisit: null,
  };
  const latestKg = record.weights.at(-1)?.kg;
  record.bmi =
    latestKg && record.heightCm
      ? Math.round((latestKg / (record.heightCm / 100) ** 2) * 10) / 10
      : null;
  record.sinceLastVisit = sinceLastVisitOf(record);
  return record;
}

export function getPatientRecord(
  patientId: string,
): Promise<PatientRecord | null> {
  return nullWhenMissing(async () => {
    const body = await apiRequest<{ data?: Partial<PatientRecord> }>(
      `/api/doctor/patients/${patientId}/record`,
    );
    return toPatientRecord(dataOf(body), patientId);
  });
}

export function listPatientSnapshots(): Promise<PatientSnapshot[] | null> {
  return nullWhenMissing(async () => {
    const body = await apiRequest("/api/doctor/patients/snapshots");
    return listFrom<Omit<PatientSnapshot, "careWeek">>(body, "patients").map(
      (raw) => ({
        ...raw,
        patientId: String(raw.patientId),
        careWeek: careWeekFrom(raw.careStartedAt),
      }),
    );
  });
}

export function listWaitingItems(): Promise<WaitingItem[] | null> {
  return nullWhenMissing(async () => {
    const body = await apiRequest("/api/doctor/queue");
    return listFrom<WaitingItem>(body, "items").map((raw) => ({
      ...raw,
      patientId: String(raw.patientId),
      severity: raw.severity ?? null,
      urgent: !!raw.urgent,
    }));
  });
}

export function getWorkCounts(): Promise<DoctorWorkCounts | null> {
  return nullWhenMissing(async () => {
    const raw = dataOf(
      await apiRequest<{ data?: Partial<DoctorWorkCounts> }>(
        "/api/doctor/work-counts",
      ),
    );
    return {
      waitingOnYou: raw.waitingOnYou ?? 0,
      notesToSign: raw.notesToSign ?? 0,
      messagesForYou: raw.messagesForYou ?? 0,
    };
  });
}

/** Null when the endpoint is missing or the patient is not sharing photos (403). */
export async function listProgressPhotos(
  patientId: string,
): Promise<ProgressPhotoSet[] | null> {
  try {
    const body = await apiRequest(`/api/doctor/patients/${patientId}/photos`);
    const sets = listFrom<ProgressPhotoSet>(body, "sets").sort(
      (first, second) => first.takenAt.localeCompare(second.takenAt),
    );
    return sets.length ? sets : null;
  } catch (caught) {
    if (
      caught instanceof ApiError &&
      (caught.isMissingEndpoint || caught.status === 403)
    )
      return null;
    throw caught;
  }
}

export async function recordPhotoViewing(patientId: string): Promise<void> {
  await apiRequest(`/api/doctor/patients/${patientId}/photos/viewed`, {
    method: "POST",
  });
}

export async function acknowledgeSymptom(
  patientId: string,
  symptomId: string,
  outcome: string,
): Promise<void> {
  await apiRequest(
    `/api/doctor/patients/${patientId}/symptoms/${symptomId}/acknowledgement`,
    { method: "POST", body: { outcome } },
  );
}

export async function undoSymptomAcknowledgement(
  patientId: string,
  symptomId: string,
): Promise<void> {
  await apiRequest(
    `/api/doctor/patients/${patientId}/symptoms/${symptomId}/acknowledgement`,
    { method: "DELETE" },
  );
}

export async function reviewLabReport(
  patientId: string,
  labId: string,
  comment: string,
): Promise<void> {
  await apiRequest(`/api/doctor/patients/${patientId}/labs/${labId}/review`, {
    method: "POST",
    body: { comment },
  });
}

export async function signPrescription(
  patientId: string,
  prescriptionId: string,
): Promise<void> {
  await apiRequest(
    `/api/doctor/patients/${patientId}/prescriptions/${prescriptionId}/sign`,
    { method: "POST" },
  );
}

export async function addPrivateNote(
  patientId: string,
  text: string,
): Promise<void> {
  await apiRequest(`/api/doctor/patients/${patientId}/private-notes`, {
    method: "POST",
    body: { text },
  });
}

export async function recommendPlan(
  patientId: string,
  planId: number,
  note: string,
): Promise<void> {
  await apiRequest(`/api/doctor/patients/${patientId}/plan-recommendation`, {
    method: "POST",
    body: { planId, note },
  });
}

export async function withdrawPlanRecommendation(
  patientId: string,
): Promise<void> {
  await apiRequest(`/api/doctor/patients/${patientId}/plan-recommendation`, {
    method: "DELETE",
  });
}
