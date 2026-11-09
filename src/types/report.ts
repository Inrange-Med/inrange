/**
 * Lab reports in the patient's record: ones the patient uploaded, and ones Redcliffe Labs sent
 * for a home blood test booked through InRange (GET /api/reports returns both).
 */

export type ReportSource = "UPLOADED" | "LAB_BOOKING";

export type MedicalReport = {
  id: string;
  title: string;
  /** the date printed on the report, "YYYY-MM-DD" */
  reportDate: string;
  source: ReportSource;
  /** the file, for uploads; lab reports fetch a fresh link through their booking instead */
  fileUrl: string | null;
  labBookingId: string | null;
  addedAt: string;
  /** the back office's review, for reports that decide eligibility; null for other reports */
  reviewStatus: "UNDER_REVIEW" | "APPROVED" | "NOT_APPROVED" | null;
  reviewNote: string | null;
};

/** POST /api/reports (multipart). */
export type NewReport = {
  file: File;
  reportDate: string;
  title: string;
  /** ELIGIBILITY: the report a new patient uploads at the end of onboarding, sent for review */
  purpose?: "ELIGIBILITY";
};
