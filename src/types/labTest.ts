/**
 * Home blood tests through Redcliffe Labs. The browser only ever sees these inrange shapes: the
 * backend calls Redcliffe (with its secret key) and maps its replies (docs/backend/lab-tests-redcliffe.md).
 * Money is in rupees.
 */

/** A test package the patient can book (Redcliffe center-package-data). */
export type LabPackage = {
  code: string;
  name: string;
  description: string;
  testCount: number;
  /** Redcliffe's own words, e.g. "8-10 Hrs Fasting Required"; empty when no fasting is needed */
  fastingNote: string;
  /** e.g. "Within 24-48 hrs." */
  reportTime: string;
  forGender: "Both" | "Male" | "Female";
  /** null when the lab sets no age limit */
  ageRange: { min: number; max: number } | null;
  price: number;
  listPrice: number;
  /** true when a lab plan the patient already paid for covers this package */
  coveredByPlan: boolean;
};

/** What a package tests, grouped as the lab groups it (Redcliffe package-parameter-data). */
export type LabPackageTests = {
  code: string;
  name: string;
  groups: { name: string; tests: string[] }[];
};

/** One place found by the area search (Redcliffe get-partner-location-2-eloc). */
export type LabPlaceMatch = {
  eloc: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

export type LabCoordinates = { latitude: number; longitude: number };

/** Whether Redcliffe's collectors reach a point (Redcliffe is-location-serviceable). */
export type LabServiceability = { serviceable: boolean; message: string };

/** A one-hour collection window (Redcliffe get-time-slot-list). */
export type LabSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  open: boolean;
};

/** Redcliffe accepts only these two. */
export type LabPatientGender = "Male" | "Female";

/** The person the sample is taken from. Redcliffe needs every field: name 3 to 30 letters, mobile 10
 * digits from 6000000000, a real email (labPatientProblem in lib/validation/labBookingRules checks them). */
export type LabPatient = {
  name: string;
  age: number;
  gender: LabPatientGender;
  mobile: string;
  email: string;
};

/** POST /api/labs/bookings body. */
export type NewLabBooking = {
  packageCode: string;
  addressId: number;
  /** "YYYY-MM-DD", today to today + 4 (Redcliffe books no further ahead) */
  collectionDate: string;
  /** Redcliffe slot id (an integer, as a string) */
  slotId: string;
  patient: LabPatient;
  /** set when the booking is part of a care package (for example lab tests and consultation, bought at
   * the end of onboarding): the backend then charges the package price and marks the consultation paid */
  carePackageCode?: string;
};

/**
 * Where a booking is. PAYMENT_PENDING: the slot is held for 30 minutes while the patient pays.
 * EXPIRED: the hold ended unpaid. The rest follow Redcliffe's webhooks.
 */
export type LabBookingStatus =
  | "PAYMENT_PENDING"
  | "BOOKED"
  | "COLLECTOR_ASSIGNED"
  | "SAMPLE_COLLECTED"
  | "PROCESSING"
  | "REPORT_READY"
  | "CANCELLED"
  | "EXPIRED";

export type LabTestStatus = "PENDING" | "COMPLETED" | "REJECTED" | "DISMISSED";

export type LabBooking = {
  /** inrange's booking id (used in URLs and payments) */
  id: string;
  /** Redcliffe's booking id, shown to the patient for calls with the lab */
  partnerBookingId: string | null;
  status: LabBookingStatus;
  packageCode: string;
  packageName: string;
  fastingNote: string;
  collectionStartsAt: string;
  collectionEndsAt: string | null;
  /** the saved address it is collected from (slots for a reschedule are looked up there) */
  addressId: number;
  address: string;
  patient: { name: string; age: number; gender: LabPatientGender };
  price: {
    packagePrice: number;
    discount: number;
    collectionCharge: number;
    total: number;
  };
  /** false when a paid lab plan covers it, so no checkout is needed */
  paymentRequired: boolean;
  /** while PAYMENT_PENDING: when the 30-minute slot hold ends */
  holdExpiresAt: string | null;
  /** Redcliffe allows two reschedules, and none once a collector is assigned */
  reschedulesLeft: number;
  canReschedule: boolean;
  canCancel: boolean;
  collector: {
    name: string;
    phone: string;
    trackingUrl: string | null;
    /** from the lab's journey webhooks: the collector has set off, or has reached the address */
    journey?: "ON_THE_WAY" | "ARRIVED" | null;
  } | null;
  /** true when the test is part of the eligibility check: a doctor reviews the report next */
  forEligibility?: boolean;
  /** the API path that streams the lab's report once it is in hand (fileService.getFile) */
  reportFile: string | null;
  tests: { code: string; name: string; status: LabTestStatus }[];
};
