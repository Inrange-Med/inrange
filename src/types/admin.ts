/** The InRange team's admin area: eligibility reviews and the doctor roster. */

export type ReviewPath = "OWN_REPORT" | "LAB_TEST";
export type ReviewDecision = "APPROVED" | "NOT_APPROVED";
export type ReviewStage = "UNDER_REVIEW" | ReviewDecision;

export type ReviewReport = {
  id: number;
  title: string;
  source: "UPLOAD" | "LAB";
  uploadedAt: string;
  /** Signed for 10 minutes; null when the file could not be signed. */
  url: string | null;
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
  labBookingId: number | null;
  waitingSince: string;
  decidedAt: string | null;
  decidedBy: string | null;
  reports: ReviewReport[];
};

export type ReviewQueue = {
  waiting: EligibilityReview[];
  decided: EligibilityReview[];
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
