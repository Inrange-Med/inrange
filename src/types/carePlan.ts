/**
 * The patient's treatment on the Care tab: the signed prescription, its prefilled medicine cart and the
 * deliveries. Docs: docs/backend/consultations-and-care.md, docs/backend/medicine-cart.md.
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

/** One prescribed item in the cart. Prices are what the patient pays, in paise, per pack. */
export type CartLine = {
  medicineId: string;
  brand: string;
  molecule: string;
  strength: string;
  form: string;
  pack: string; // "pen (4 weekly doses)"
  quantity: number;
  prescribed: number; // the most the patient may buy
  mrpPaise: number;
  pricePaise: number; // after the default discount
  available: boolean; // false once the pharmacy stops stocking it
};

/** The cart a signed prescription prefills (GET /api/care/cart). */
export type MedicineCart = {
  id: string;
  prescriptionId: string;
  months: number;
  validUntil: string | null; // ISO
  lines: CartLine[];
  discountPercent: number;
  mrpTotalPaise: number;
  discountPaise: number;
  totalPaise: number;
  address: { id: string; label: string; name: string; line: string } | null;
};

/** The cart, or when it opens (a first consultation's cart waits for the programme call). */
export type CartState = {
  cart: MedicineCart | null;
  availableAt: string | null; // ISO, while held back
};

/** What the Care tab shows about treatment. `available` is false until the backend serves it. */
export type CarePlan = {
  available: boolean;
  prescription: Prescription | null;
  orders: MedicineOrder[];
  cart: CartState;
};
