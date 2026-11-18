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
  consultation: ConsultationRow & { endsAt: string | null; reason: string };
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
  };
  reports: ConsultationReport[];
  lastPrescription: {
    id: string;
    at: string;
    doctorName: string;
    diagnosis: string;
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
