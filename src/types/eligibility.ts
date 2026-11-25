/**
 * Whether a patient may book their first consultation. Every patient proves eligibility one of two
 * ways, chosen at the end of onboarding:
 *   OWN_REPORT  uploads a report from the last 3 months; pays nothing until approved.
 *   LAB_TEST    prepays the lab-and-consultation package; Redcliffe collects a sample at home and
 *               its report reaches the back office directly (the patient uploads nothing).
 * The back office (admin) reviews the report either way. The backend owns every stage change.
 */

export type EligibilityPath = "OWN_REPORT" | "LAB_TEST";

export type EligibilityStage =
  /** onboarding finished, no path chosen yet */
  | "NOT_STARTED"
  /** LAB_TEST: collection slot held, payment not finished */
  | "AWAITING_PAYMENT"
  /** LAB_TEST: paid, home collection booked */
  | "LAB_SCHEDULED"
  /** LAB_TEST: sample taken, waiting for Redcliffe's report */
  | "SAMPLE_COLLECTED"
  /** the report (uploaded or from Redcliffe) is with the back office */
  | "UNDER_REVIEW"
  /** eligible: the patient can book a consultation */
  | "APPROVED"
  /** not approved; reviewNote says why and what to do (for example, upload a newer report) */
  | "NOT_APPROVED";

export type Eligibility = {
  path: EligibilityPath | null;
  stage: EligibilityStage;
  reviewNote: string | null;
  /** LAB_TEST: the home collection booking */
  labBookingId: string | null;
  /** true once the first consultation is paid for (LAB_TEST prepays it inside the package) */
  consultationPaid: boolean;
  /** the blood tests are paid for and the collection is still to book (pay first, then book) */
  labCredit: boolean;
  updatedAt: string | null;
};
