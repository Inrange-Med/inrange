/**
 * The sales panel (a salesperson's own customers) and what it shares with admin: payment links and the
 * plans on sale. Docs: docs/backend/sales-and-coach.md.
 */

/** A plan as it is sold: its price, what it includes, and the most a salesperson may take off it. */
export type PlanOnSale = {
  id: string;
  name: string;
  months: number;
  priceRupees: number;
  maxDiscountPercent: number;
  doctorConsults: number | null;
  coachCalls: number | null;
  fitnessCalls: number | null;
};

/** A payment link made for one patient and one plan. When it is paid the plan starts by itself. */
export type PaymentLink = {
  id: string;
  patientId: string;
  /** null on a link for a blood test */
  planId: string | null;
  /** what it pays for: a plan, or the blood tests the team booked */
  purpose: "PLAN" | "LAB_BOOKING";
  planName: string;
  status: "CREATED" | "PAID" | "CANCELLED" | "EXPIRED";
  url: string;
  listRupees: number;
  amountRupees: number;
  salesperson: string | null;
  coachPreference: string | null;
  note: string | null;
  /** Razorpay's payment ID, once paid */
  paymentId: string | null;
  /** paid, but the plan could not start (the patient was already on one) */
  needsAttention: string | null;
  /** a link made while payments are in test mode */
  test: boolean;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  /** admin's list only: who it is for */
  patientName?: string;
  patientMobile?: string;
};

/** What goes on a payment link: the sales form. */
export type LinkForm = {
  planId: string;
  discountPercent: number;
  coachPreference: string;
  note: string;
  /** admin only: who sold it */
  salespersonId?: string | null;
};

export type SalesMe = {
  name: string;
  rank: number;
  patients: number;
  plansSold: number;
  linksWaiting: number;
};

export type SalesCustomerRow = {
  id: string;
  name: string;
  mobile: string;
  doctors: string | null;
  coachName: string | null;
  planName: string | null;
  planEndsAt: string | null;
  /** a payment link waiting to be paid */
  linkRupees: number | null;
  linkSentAt: string | null;
  nextCallId: string | null;
  nextCallAt: string | null;
  nextCallDoctor: string | null;
};

export type SalesCustomer = {
  patient: {
    id: string;
    name: string;
    mobile: string;
    age: number | null;
    gender: string | null;
    doctors: string[];
    coachName: string | null;
    fitnessCoachName: string | null;
  };
  plan: { name: string; startedAt: string; endsAt: string } | null;
  consultations: {
    id: string;
    startsAt: string;
    doctorName: string;
    status: "Booked" | "InProgress" | "Completed" | "NoShow";
    visitType: "FIRST" | "FOLLOW_UP";
    /** still to come or running: the salesperson can join it */
    joinable: boolean;
  }[];
  /** what the doctor found and prescribed, so the plan can be explained against it */
  prescription: {
    doctorName: string;
    sentAt: string | null;
    diagnosis: string;
    medicines: string[];
  } | null;
  links: PaymentLink[];
};
