/** The patient's Home (doctor portal v2): the one next step and the prescriptions list. patientHomeService. */

import type { MedicineLineView } from "./consultation";

export type NextAppointment = {
  id: string;
  startsAt: string;
  doctorName: string;
  visitType: "FIRST" | "FOLLOW_UP";
  joinOpensAt: string;
};

export type BillLine = {
  key: string;
  label: string;
  quantity?: number;
  mrpPaise?: number | null;
  amountPaise: number;
};

export type Bill = {
  lines: BillLine[];
  discountPercent?: number;
  totalPaise: number;
};

export type PrescriptionSummary = {
  id: string;
  sentAt: string;
  doctorName: string;
  pdf: string;
  medicines: number;
};

/** One next step, from the backend (GET /api/patient/next-step); Home words it and gives it one button. */
export type NextStep =
  | {
      stage: "CALL_OPEN" | "CALL_BOOKED" | "AFTER_CALL";
      appointment: NextAppointment;
    }
  | {
      stage: "PAYMENT_DUE";
      payFor: "PLAN" | "MEDICINES";
      referenceId: string;
      bill: Bill;
      hasAddress: boolean;
      followedBy: "MEDICINES" | null;
      /** the plan the doctor prescribed is in this bill with the medicines: one payment */
      withPlan?: boolean;
    }
  | {
      stage: "ON_THE_WAY";
      order: { id: string; status: string; expectedAt: string | null };
    }
  | {
      stage: "DELIVERED";
      order: { id: string; deliveredAt: string };
      prescription: PrescriptionSummary | null;
    }
  | {
      stage: "PRESCRIPTION_SENT";
      prescription: PrescriptionSummary;
    }
  | {
      stage: "LAB_UNPAID";
      labBookingId: string;
      collection: Collection | null;
      bill: Bill;
    }
  | {
      stage: "TEST_BOOKED";
      labBookingId: string;
      collection: Collection | null;
      collectorName: string | null;
    }
  | { stage: "WAITING_FOR_REPORT"; labBookingId: string }
  | { stage: "UNDER_REVIEW" }
  | { stage: "NOT_APPROVED"; note: string | null }
  | { stage: "BOOK_CONSULTATION"; paid: boolean }
  | { stage: "BLOOD_TEST_NEEDED" }
  | { stage: "IN_CARE"; prescription: PrescriptionSummary | null };

export type Collection = {
  date: string;
  from: string | null;
  to: string | null;
};

export type PatientPrescription = {
  id: string;
  version: number;
  current: boolean;
  sentAt: string;
  validUntil: string | null;
  doctorName: string;
  doctorQualification: string;
  medicines: MedicineLineView[];
  pdf: string;
};
