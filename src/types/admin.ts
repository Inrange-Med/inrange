/** The InRange team's admin area: eligibility reviews and the doctor roster. */

export type ReviewPath = "OWN_REPORT" | "LAB_TEST";
export type ReviewDecision = "APPROVED" | "NOT_APPROVED";
export type ReviewStage = "UNDER_REVIEW" | ReviewDecision;

/** What the backend read from the file itself when it arrived (null fields: not in the file). */
export type ReportFacts = {
  /** false for files stored before these checks existed */
  read: boolean;
  producer: string | null;
  creator: string | null;
  /** ISO dates from inside the PDF */
  created: string | null;
  modified: string | null;
  encrypted: boolean;
};

/** Another stored report that is byte for byte the same file. */
export type SameFile = {
  mobile: string;
  samePatient: boolean;
  reviewStatus: ReviewStage | null;
  uploadedAt: string;
};

export type ReviewReport = {
  id: number;
  title: string;
  source: "UPLOAD" | "LAB";
  kind: "pdf" | "image";
  fileName: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  /** UNDER_REVIEW: new since the last decision */
  reviewStatus: ReviewStage | null;
  /** the API path that streams the file (fileService.getFile) */
  file: string | null;
  facts: ReportFacts;
  sameFile: SameFile[];
};

/** One patient's eligibility review, waiting or decided. Times are ISO with +05:30. */
export type EligibilityReview = {
  patientId: number;
  name: string;
  mobile: string;
  age: number | null;
  gender: string | null;
  path: ReviewPath;
  stage: ReviewStage;
  /** The note shown to the patient (always set for NOT_APPROVED). */
  note: string | null;
  labBookingId: string | null;
  waitingSince: string;
  decidedAt: string | null;
  decidedBy: string | null;
  reports: ReviewReport[];
};

/** A patient whose eligibility waits on a home blood test; their report joins the queue when it arrives. */
export type AwaitingLab = {
  patientId: number;
  name: string;
  mobile: string;
  bookingId: string | null;
  status:
    | "PAYMENT_PENDING"
    | "BOOKED"
    | "COLLECTOR_ASSIGNED"
    | "SAMPLE_COLLECTED"
    | "PROCESSING"
    | "REPORT_READY"
    | "CANCELLED"
    | "EXPIRED"
    | null;
  slotDate: string | null;
  slotStart: string | null;
  slotEnd: string | null;
  packageName: string | null;
  /** the lab refused the booking after payment; the care team must sort it out */
  needsAttention: boolean;
  updatedAt: string | null;
};

export type ReviewQueue = {
  waiting: EligibilityReview[];
  decided: EligibilityReview[];
  awaitingLab: AwaitingLab[];
  /** dry runs only: the lab steps can be walked by hand from the Waiting on the lab list */
  labSimulation: boolean;
};

export type AdminDoctor = {
  id: number;
  mobile: string;
  fullName: string;
  specialization: string;
  qualification: string;
  registrationNo: string;
  experience: string;
  languages: string[];
  about: string;
  consultationFeeRupees: number | null;
  active: boolean;
  /** True until the doctor sets their own hours from their dashboard. */
  usesDefaultHours: boolean;
  upcomingConsultations: number;
};

/** The profile fields an admin may change (everything but the mobile). */
export type DoctorDetails = {
  fullName: string;
  specialization: string;
  qualification: string;
  registrationNo: string;
  experience: string;
  languages: string[];
  about: string;
  consultationFeeRupees: number | null;
};

export type NewDoctor = DoctorDetails & { mobile: string };

export type DoctorChanges = Partial<DoctorDetails> & { active?: boolean };
