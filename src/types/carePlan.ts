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
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

/** One delivery from inrange's pharmacy. `history` holds each status reached, oldest first
    (and "DELAYED" when the expected date moved). Docs: docs/backend/medicine-flow.md. */
export type MedicineOrder = {
  id: string;
  /** "MED-00042", as WhatsApp says it */
  orderNumber?: string;
  status: MedicineOrderStatus;
  placedAt: string; // ISO
  expectedAt: string | null; // ISO, once the courier has it
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  courier?: string | null;
  trackingNo: string | null;
  trackingUrl: string | null;
  items: { name: string; quantity: string }[];
  history: {
    status: MedicineOrderStatus | "DELAYED";
    at: string;
    note: string;
  }[];
  feedback?: "GOOD" | "ISSUE" | null;
  /** delivered within the last two weeks and not rated yet */
  canGiveFeedback?: boolean;
  /** YYYY-MM-DD, when the delivered supply runs out */
  runOutOn?: string | null;
  cancelReason?: string | null;
  refundedPaise?: number | null;
};

/** A dose reminder the app and WhatsApp share (patients on a plan). */
export type DoseSchedule = {
  id: string;
  medicine: string;
  cadence: "WEEKLY" | "DAILY" | "TWICE_DAILY";
  weekday: number | null; // ISO, 1 Monday ... 7 Sunday
  times: string[]; // "09:00", India time
  paused: boolean;
  startsOn: string;
  endsOn: string | null;
};

export type DoseEvent = {
  id: string;
  scheduleId: string;
  medicine: string;
  dueAt: string; // ISO
  status: "DUE" | "TAKEN" | "TAKEN_LATE" | "SKIPPED" | "MISSED";
  skipReason: "UNWELL" | "FORGOT" | "SIDE_EFFECTS" | "OTHER" | null;
};

export type Doses = { schedules: DoseSchedule[]; events: DoseEvent[] };

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
  /** the plan the prescription carries, in this bill with the medicines (totalPaise includes it) */
  plan: { id: string; name: string; pricePaise: number } | null;
  totalPaise: number;
  address: { id: string; label: string; name: string; line: string } | null;
  /** REFILL: the next supply on the same prescription */
  kind?: "FIRST" | "REFILL";
  boughtElsewhere?: boolean;
};

/** The prescription's cart, open the moment it is sent. */
export type CartState = { cart: MedicineCart | null };

/** What the Care tab shows about treatment. `available` is false until the backend serves it. */
export type CarePlan = {
  available: boolean;
  prescription: Prescription | null;
  orders: MedicineOrder[];
  cart: CartState;
};
