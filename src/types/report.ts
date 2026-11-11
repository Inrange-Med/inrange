/**
 * Lab reports in the patient's record: ones the patient uploaded, and ones Redcliffe Labs sent
 * for a home blood test booked through InRange (GET /api/reports returns both).
 */

export type ReportSource = "UPLOADED" | "LAB_BOOKING";

export type MedicalReport = {
  id: string;
  title: string;
  source: ReportSource;
  /** the API path that streams the file (fileService.getFile) */
  file: string | null;
  labBookingId: string | null;
  /** when it was uploaded, or when the lab's report arrived (ISO) */
  addedAt: string;
  /** the back office's review, for reports that decide eligibility; null for other reports */
  reviewStatus: "UNDER_REVIEW" | "APPROVED" | "NOT_APPROVED" | null;
  reviewNote: string | null;
};

/** POST /api/reports (multipart). */
export type NewReport = {
  file: File;
  title: string;
  /** ELIGIBILITY: the report a new patient uploads at the end of onboarding, sent for review */
  purpose?: "ELIGIBILITY";
};
