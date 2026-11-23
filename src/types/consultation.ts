/** The doctor's consultations (doctor portal v2): Today, History and the consultation page. consultationService. */

/** One state per consultation, from the backend, so Today, History and the page always agree. */
export type ConsultationState =
  | "UPCOMING"
  | "CALL_OPEN"
  | "TO_WRITE"
  | "TO_SEND"
  | "SENT"
  | "NO_CALL"
  | "CANCELLED";

export type ConsultationRow = {
  id: string;
  patientId: string;
  patientName: string;
  age: number | null;
  sex: string;
  visitType: "FIRST" | "FOLLOW_UP";
  startsAt: string;
  state: ConsultationState;
  /** a new version of a sent prescription is being written */
  revising: boolean;
  sentAt: string | null;
  resentAt: string | null;
  /** the sent prescription's PDF */
  pdf: string | null;
};

export type ConsultationDay = {
  date: string;
  day: ConsultationRow[];
  /** "Do this now": anything waiting on the doctor, any date */
  waiting: ConsultationRow[];
};

export type ConsultationHistory = {
  from: string;
  to: string;
  consultations: ConsultationRow[];
};

/** How often, as tapped. */
export type Frequency =
  | "1-0-0"
  | "0-0-1"
  | "1-0-1"
  | "1-1-1"
  | "WEEKLY"
  | "OTHER"
  | "";
export type DurationUnit = "DAYS" | "WEEKS" | "MONTHS";
export type Intake = "BEFORE_FOOD" | "AFTER_FOOD" | "EMPTY_STOMACH" | "";

/** One medicine line as the form edits it. */
export type MedicineLine = {
  key: string;
  medicineId: string | null;
  name: string;
  genericName?: string | null;
  /** the master list's brand and form: the strengths to switch between, and no food choice for an injection */
  brand?: string | null;
  form?: string;
  dose: string;
  frequency: Frequency;
  frequencyOther: string;
  durationValue: number;
  durationUnit: DurationUnit;
  intake: Intake;
  /** typed by hand, not on the master list: prints, cannot be ordered until admin matches it */
  unlisted?: boolean;
};

/** A line as the server words it (the last prescription, the patient's list). */
export type MedicineLineView = MedicineLine & {
  frequencyWords: string;
  duration: string;
  intakeWords: string;
};

export type Prescription = {
  id: string;
  version: number;
  status: "DRAFT" | "SENT";
  diagnosis: string;
  patientHistory: string;
  remarks: string;
  advice: string;
  medicines: MedicineLineView[];
  savedAt: string | null;
  /** the PDF on the page is current (null once an edit makes it stale) */
  pdfMadeAt: string | null;
  pdf: string | null;
  sentAt: string | null;
  resentAt: string | null;
};

export type PrescriptionDraft = Pick<
  Prescription,
  "diagnosis" | "patientHistory" | "remarks" | "advice"
> & { medicines: MedicineLine[] };

export type ConsultationReport = {
  id: string;
  title: string;
  source: "LAB" | "UPLOAD";
  at: string;
  file: string;
};

export type ConsultationPage = {
  activePlan: { planName: string; endsAt: string } | null;
  /** sold and assigned by admin, not paid yet */
  assignedPlan: { planName: string } | null;
  /** callOpen: the call can be joined now (it stays true after a mid-call send, so Join stays) */
  consultation: ConsultationRow & {
    endsAt: string | null;
    reason: string;
    callOpen: boolean;
  };
  patient: {
    id: string;
    name: string;
    age: number | null;
    sex: string;
    heightCm: number | null;
    weightKg: number | null;
    weighedAt: string | null;
    bmi: number | null;
    monthChangeKg: number | null;
    allergies: string | null;
    conditions: string[];
    onPlan: boolean;
    /** who sells to the patient, and their health coach (19 Nov 2026 call) */
    salesperson: string | null;
    coachName: string | null;
    /** the doctors on their care team, by name, the main one first */
    doctors: string[];
  };
  reports: ConsultationReport[];
  lastPrescription: {
    id: string;
    at: string;
    doctorName: string;
    diagnosis: string;
    patientHistory: string;
    advice: string;
    medicines: MedicineLineView[];
    pdf: string;
  } | null;
  prescription: Prescription | null;
};

/** An item on the master list (the doctor's medicine search). */
export type ListItem = {
  id: string;
  name: string;
  brand: string;
  molecule: string;
  form: string;
  strength: string;
  kind: "MEDICINE" | "SUPPLEMENT";
  dose: string;
  frequency: string;
  packDays: number;
  orderable: boolean;
};

export type MedicineSearch = { matches: ListItem[]; didYouMean: ListItem[] };
