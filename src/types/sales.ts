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
  /** place on the team, 1 the best; null for an admin looking at everyone's leads */
  rank: number | null;
  patients: number;
  plansSold: number;
  linksWaiting: number;
  admin: boolean;
};

/** Where a lead stands, worked out from what has happened to them. */
export type LeadStage =
  | "NEW"
  | "PAID"
  | "TEST_BOOKED"
  | "REPORT_IN"
  | "CONSULT_BOOKED"
  | "CONSULTED"
  | "LINK_SENT"
  | "ON_PLAN";

export type CallStatus =
  | "SPOKE"
  | "NO_ANSWER"
  | "CALL_BACK"
  | "INTERESTED"
  | "NOT_INTERESTED";

/** One lead as the team's sheet tracks it: enough to follow them from sign-up to a plan, and nothing clinical beyond it. */
export type Lead = {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  createdAt: string;
  stage: LeadStage;
  bmi: number | null;
  salesperson: string | null;
  salespersonId: string | null;
  doctors: string | null;
  coachName: string | null;
  fitnessCoachName: string | null;
  eligibilityStage: string;
  /** paid for the blood tests, collection not booked yet */
  labCredit: boolean;
  /** everything they have paid, what the last payment was for, and when */
  paidRupees: number | null;
  paidFor: string | null;
  lastPaidAt: string | null;
  planName: string | null;
  planStartedAt: string | null;
  planEndsAt: string | null;
  /** on a plan, and the sales form is not filled in yet */
  formDue: boolean;
  /** a payment link waiting to be paid */
  linkRupees: number | null;
  linkSentAt: string | null;
  nextCallId: string | null;
  nextCallAt: string | null;
  nextCallDoctor: string | null;
  nextCallStatus: "Booked" | "InProgress" | null;
  lastConsultAt: string | null;
  lastConsultDoctor: string | null;
  prescriptionSentAt: string | null;
  /** whether the prescription has a GLP-1 medicine; null with no prescription */
  glp1Prescribed: boolean | null;
  lastOrderAt: string | null;
  /** the salesperson's own latest note */
  callStatus: CallStatus | null;
  remark: string | null;
  followUpOn: string | null;
  lastNoteAt: string | null;
};

export type LeadUpdate = {
  id: string;
  by: string;
  callStatus: CallStatus | null;
  remark: string | null;
  followUpOn: string | null;
  at: string;
};

/** The sale behind the plan a lead is on: what the payment recorded, and what the sales form adds. */
export type Sale = {
  planName: string;
  startedAt: string;
  amountRupees: number | null;
  paymentId: string | null;
  salesperson: string | null;
  coachPreference: string | null;
  note: string | null;
  condition: string | null;
  programme: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
};

export type SaleForm = {
  condition: string;
  programme: string;
  coachPreference: string;
  note: string;
};

export type LeadDetail = {
  lead: Lead;
  /** the condition the doctor wrote on the prescription */
  condition: string | null;
  consultations: {
    id: string;
    startsAt: string;
    doctorName: string;
    status: "Booked" | "InProgress" | "Completed" | "NoShow";
    visitType: "FIRST" | "FOLLOW_UP";
    /** still to come or running: the salesperson can join it */
    joinable: boolean;
  }[];
  links: PaymentLink[];
  updates: LeadUpdate[];
  payments: {
    title: string;
    amountRupees: number;
    paidAt: string;
    paymentId: string | null;
  }[];
  sale: Sale | null;
};
