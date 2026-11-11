/**
 * A patient's clinical record as their doctor sees it, plus the doctor's work queue.
 * None of these endpoints exist on the backend yet: shapes are proposed in
 * docs/backend/doctor-dashboard.md (derived from Arhaan's clinician prototype).
 */

export type VisitType = "FIRST_CONSULTATION" | "FOLLOW_UP";
export type SymptomSeverity = "Mild" | "Moderate" | "Severe";

export type LabResult = {
  test: string;
  value: number;
  unit: string;
  range: string;
  flag: "LOW" | "NORMAL" | "HIGH";
};

export type LabReport = {
  id: string;
  packageName: string;
  collectedAt: string; // ISO
  reportedAt: string | null;
  status: "PROCESSING" | "DOCTOR_REVIEW_PENDING" | "REVIEWED";
  /** UPLOAD: the patient's own report; LAB: from the partner lab */
  source: "UPLOAD" | "LAB";
  /** the API path that streams the report file (fileService.getFile); results stay empty until values are parsed from it */
  file: string | null;
  results: LabResult[];
  doctorComment: string | null;
  reviewedAt: string | null;
};

/** A prescription as the doctor's record lists it (the patient's signed copy is carePlan.Prescription). */
export type RecordPrescriptionItem = {
  name: string;
  strength: string;
  dose: string;
  frequency: string;
  duration: string;
};

export type RecordPrescription = {
  id: string;
  version: number;
  status: "DRAFT" | "SIGNED" | "SUPERSEDED";
  date: string; // ISO
  items: RecordPrescriptionItem[];
  advice: string;
};

/** A past consultation. `noteId`: the signed call note it came from; `assessment` is never shown to the patient. */
export type RecordVisit = {
  id: string;
  at: string;
  type: VisitType;
  summary: string;
  assessment: string | null;
  noteId: string | null;
  plan: string[];
};

export type Symptom = {
  id: string;
  label: string;
  severity: SymptomSeverity;
  note: string;
  at: string;
  requiresReview: boolean;
  acknowledged: boolean;
};

export type PrivateNote = { id: string; at: string; text: string; by: string };
export type AuditEntry = { at: string; action: string };

/** The counsellor's screening call before a first consultation. */
export type Screening = {
  by: string;
  byRole: string;
  at: string;
  minutes: number;
  goal: string;
  tried: string;
  mentioned: string;
  check: string[];
};

/** One weight in the record (the patient's own log entry is tracker.WeightReading). */
export type RecordWeight = { at: string; kg: number; source: string };

export type TreatmentPlan = {
  goals: { label: string; value: string }[];
  reviewAt: string;
  notes: string;
};

/** A weekly pen, from the patient's own logs. */
export type InjectionLog = {
  name: string;
  strength: string;
  taken: number;
  perStep: number;
  lastAt: string | null;
  lastSite: string | null;
  dueToday: boolean;
};

/** What changed since the last consultation, worked out by the service from the record. */
export type SinceLastVisit = {
  at: string;
  weightChangeKg: number | null;
  news: string | null;
};

/** GET /api/doctor/patients/:patientId/record */
/** The plan the doctor suggested, shown first on the patient's Plans screen. */
export type PlanRecommendation = {
  planId: number;
  planName: string;
  note: string;
  recommendedAt: string;
};

export type PatientRecord = {
  patientId: string;
  planRecommendation: PlanRecommendation | null;
  activePlan: { planName: string; endsAt: string } | null;
  programme: string;
  city: string;
  careStartedAt: string | null;
  identityVerified: boolean;
  heightCm: number | null;
  weights: RecordWeight[];
  waist: { at: string; cm: number } | null;
  hba1c: { at: string; value: number }[];
  conditions: string[];
  allergies: string | null;
  /** null: never asked; []: asked, none */
  outsideMedicines: string[] | null;
  consents: string[];
  plan: TreatmentPlan | null;
  concern: string;
  screening: Screening | null;
  labs: LabReport[];
  prescriptions: RecordPrescription[];
  visits: RecordVisit[];
  symptoms: Symptom[];
  adherence: { taken: number; due: number } | null;
  injections: InjectionLog | null;
  privateNotes: PrivateNote[];
  audit: AuditEntry[];
  photosShared: boolean;
  // derived by the service, never sent by the backend
  bmi: number | null;
  careWeek: number | null;
  sinceLastVisit: SinceLastVisit | null;
};

/** One row of GET /api/doctor/patients/snapshots: what the patient list shows beside each name. */
export type PatientSnapshot = {
  patientId: string;
  programme: string;
  city: string;
  conditions: string[];
  careStartedAt: string | null;
  bmi: number | null;
  latestHba1c: { value: number; at: string } | null;
  careWeek: number | null;
};

/** One progress photo set, shared by the patient with their treating doctor. */
export type ProgressPhotoSet = {
  id: string;
  takenAt: string;
  /** API paths that stream each photo (fileService.getFile) */
  front: string | null;
  side: string | null;
  /** the weight the patient logged nearest the photos, if any */
  weightKg: number | null;
};

export type WaitingItemKind = "symptom" | "message" | "lab" | "note" | "rx";

/** One thing waiting on the doctor (GET /api/doctor/queue), most pressing first. */
export type WaitingItem = {
  id: string;
  kind: WaitingItemKind;
  patientId: string;
  patientName: string;
  title: string;
  detail: string;
  at: string;
  severity: SymptomSeverity | null;
  urgent: boolean;
};

/** The badge counts on the doctor's navigation (GET /api/doctor/work-counts). */
export type DoctorWorkCounts = {
  waitingOnYou: number;
  notesToSign: number;
  messagesForYou: number;
};
