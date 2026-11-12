/**
 * The patient's treatment on the Care tab: the signed prescription and the medicine deliveries.
 * The backend does not serve these yet; see docs/backend/consultations-and-care.md.
 */

/** One medicine on a signed prescription. */
export type PrescriptionItem = {
  medicineName: string;
  strength: string; // "0.5 mg"
  dose: string; // "one injection"
  frequency: string; // "once a week, on Mondays"
  route: string; // "Under the skin"
  instructions: string;
  reason: string;
  genericName: string | null;
};

/** The current signed prescription. */
export type Prescription = {
  id: string;
  doctorName: string;
  doctorQualification: string;
  doctorRegistrationNo: string;
  signedAt: string; // ISO
  version: number; // above 1 when updated after a follow-up
  /** the API path that streams the signed PDF (fileService.getFile) */
  pdf: string | null;
  items: PrescriptionItem[];
};

export type MedicineOrderStatus =
  | "PLACED"
  | "PACKED"
  | "DISPATCHED"
  | "DELIVERED";

/** One delivery from inrange's pharmacy. `history` holds each status reached, oldest first. */
export type MedicineOrder = {
  id: string;
  status: MedicineOrderStatus;
  placedAt: string; // ISO
  expectedAt: string | null; // ISO, once the courier has it
  trackingNo: string | null;
  trackingUrl: string | null;
  items: { name: string; quantity: string }[];
  history: { status: MedicineOrderStatus; at: string; note: string }[];
};

/** What the Care tab shows about treatment. `available` is false until the backend serves it. */
export type CarePlan = {
  available: boolean;
  prescription: Prescription | null;
  orders: MedicineOrder[];
};
