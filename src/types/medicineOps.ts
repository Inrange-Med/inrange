/**
 * The medicine queue in the admin area (admin and health coach). Doc: docs/backend/medicine-flow.md.
 */

import type { CoachCall, CoachPlan } from "@/types/coach";
import type { PaymentLink } from "@/types/sales";

export type TaskKind =
  | "NO_REPLY"
  | "QUESTIONS"
  | "PLAN_CALL"
  | "PAYMENT_FAILED"
  | "DISPATCH_DUE"
  | "DELIVERY_LATE"
  | "DELIVERY_ISSUE"
  | "RENEWAL"
  | "REFILL_GAP"
  | "ADHERENCE"
  | "RECONCILE"
  /** a medicine the doctor typed that is not on the master list (doctor portal v2) */
  | "MATCH_MEDICINE"
  /** a paid add-on test (cortisol) to add to the Redcliffe booking by hand */
  | "LAB_ADD_ON";

/** A hand-typed line waiting to be matched to the master list. */
export type UnmatchedLine = {
  index: number;
  name: string;
  dose: string;
  frequencyWords: string;
  duration: string;
};

export type TaskPriority = "CRITICAL" | "HIGH" | "NORMAL";

export type TaskOutcome =
  | "RESOLVED"
  | "WILL_PAY"
  | "PAID"
  | "ELSEWHERE"
  | "DECLINED"
  | "CALL_BACK"
  | "NO_ANSWER";

export type OpsTask = {
  id: string;
  kind: TaskKind;
  priority: TaskPriority;
  title: string;
  detail: string | null;
  dueAt: string;
  status: "OPEN" | "DONE";
  outcome: TaskOutcome | null;
  outcomeNote: string | null;
  createdAt: string;
  doneAt: string | null;
  patientId: string | null;
  patientName: string | null;
  patientMobile: string | null;
  assignedTo: string | null;
  assignedName: string | null;
  cartId: string | null;
  orderId: string | null;
  orderNumber: string | null;
};

export type OpsSummary = {
  tasks: { open: number; overdue: number; critical: number; mine: number };
  orders: { toDispatch: number; onTheWay: number };
  messages: { failed: number; whatsapp: "live" | "mock" };
  lastTickAt: string | null;
  role: "ADMIN" | "COACH";
};

export type OrderStep =
  | "PLACED"
  | "PACKED"
  | "DISPATCHED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED";

export type OpsOrder = {
  id: string;
  orderNumber: string;
  status: OrderStep | "CANCELLED";
  flow: "NANO" | "PLAN";
  placedAt: string;
  expectedAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  dispatchBy: string;
  courier: string | null;
  trackingNo: string | null;
  trackingUrl: string | null;
  items: { name: string; quantity: string }[];
  feedback: "GOOD" | "ISSUE" | null;
  patientId: string;
  patientName: string;
  patientMobile: string;
  address: string;
};

export type OrderMove = {
  to: Exclude<OrderStep, "PLACED">;
  courier?: string;
  trackingNo?: string;
  trackingUrl?: string;
  expectedAt?: string;
  note?: string;
};

export type OpsPatientRow = {
  id: string;
  name: string;
  mobile: string;
  coachId: string | null;
  coachName: string | null;
  salesperson: string | null;
  /** the doctors on their care team, by name, the main one first ("Dr. A, Dr. B") */
  doctors: string | null;
  fitnessCoachName: string | null;
  /** the active plan's name, if any */
  planName: string | null;
  lastOrderStatus: OpsOrder["status"] | null;
  lastOrderAt: string | null;
  runOutOn: string | null;
  openTasks: number;
  dosesResolved: number;
  dosesTaken: number;
  whatsapp: boolean;
};

export type MessageStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "SKIPPED";

export type OpsMessage = {
  id: string;
  kind: string;
  status: MessageStatus;
  skipReason: string | null;
  error: string | null;
  values: string[] | null;
  text: string | null;
  /** a list the patient was asked to pick from (the skip reasons) */
  choices?: { code: string; label: string }[] | null;
  createdAt: string;
  sentAt: string | null;
  readAt: string | null;
  replies?: {
    action: string | null;
    text: string | null;
    outcome: string | null;
    at: string;
  }[];
  patientId?: string;
  patientName?: string;
  sendAfter?: string;
};

export type HistoryEntry = {
  at: string;
  by?: number | null;
  byName?: string | null;
  what?: string;
  status?: string;
  note?: string;
};

export type OpsPatient = {
  patient: {
    id: string;
    name: string;
    mobile: string;
    plan: string | null;
    planEndsAt: string | null;
    whatsappSince: string | null;
    coach: { id: string; name: string } | null;
    fitnessCoach: { id: string; name: string } | null;
    /** how the plan they are on was sold and paid for (the sales form) */
    planSale: {
      startedAt: string;
      salesperson: string | null;
      coachPreference: string | null;
      note: string | null;
      /** in the app (its payment ID), or outside it (what admin typed); null when unknown */
      paid: {
        where: "APP" | "LINK" | "OUTSIDE";
        ref: string;
        at: string | null;
        amountRupees: number | null;
      } | null;
    } | null;
    salesperson: string | null;
    salespersonId: string | null;
    /** the doctors on their care team, the main one (who joined first) first */
    doctors: { id: string; name: string }[];
    /** the plan admin put them on, waiting for them to pay in the app */
    assignedPlan: {
      planId: string;
      name: string;
      priceRupees: number;
      assignedAt: string;
      salesperson: string | null;
      salespersonId: string | null;
      coachPreference: string | null;
      note: string | null;
    } | null;
  };
  /** what the plan they are on includes, against what has happened since it started; null with no plan */
  included: {
    doctorConsults: number | null;
    coachCalls: number | null;
    fitnessCalls: number | null;
    consultsDone: number;
    coachCallsMade: number;
    fitnessCallsMade: number;
  } | null;
  /** the coach's side: the diet chart, the exercise plan and the calls made */
  coaching: {
    diet: CoachPlan | null;
    fitness: CoachPlan | null;
    calls: CoachCall[];
  };
  /** their payment links, newest first (admin) */
  links: PaymentLink[];
  /** how the month went, written by the coach for the doctor */
  remarks: { id: string; at: string; by: string; text: string }[];
  /** every prescription issued, the current one first, with who sent it and when (no PDFs here) */
  prescriptions: {
    id: string;
    version: number;
    current: boolean;
    doctorName: string;
    sentAt: string | null;
    edited: boolean;
    diagnosis: string;
    medicines: { name: string; words: string }[];
  }[];
  consultations: OpsConsultation[];
  prescription: {
    id: string;
    doctor: string;
    signedAt: string;
    validUntil: string | null;
    months: number;
    items: { name: string; frequency: string; stocked: boolean }[];
  } | null;
  carts: {
    id: string;
    kind: "FIRST" | "REFILL";
    status: "OPEN" | "PAID" | "CLOSED";
    boughtElsewhere: boolean;
    totalPaise: number;
    lines: { name: string; quantity: number; prescribed: number }[];
  }[];
  followups: {
    id: string;
    cartId: string;
    flow: "NANO" | "PLAN";
    stage: string;
    nextAt: string | null;
    closedReason: string | null;
    history: HistoryEntry[];
  }[];
  orders: (Omit<
    OpsOrder,
    | "dispatchBy"
    | "patientId"
    | "patientName"
    | "patientMobile"
    | "address"
    | "dispatchedAt"
  > & {
    history: HistoryEntry[];
    feedbackNote: string | null;
    supplyDays: number | null;
  })[];
  messages: OpsMessage[];
  looseReplies: { text: string | null; outcome: string | null; at: string }[];
  tasks: {
    id: string;
    kind: TaskKind;
    priority: TaskPriority;
    title: string;
    status: "OPEN" | "DONE";
    outcome: string | null;
    outcomeNote: string | null;
    dueAt: string;
    history: HistoryEntry[];
  }[];
  doses: {
    schedules: {
      id: string;
      medicine: string;
      cadence: "WEEKLY" | "DAILY" | "TWICE_DAILY";
      weekday: number | null;
      times: string[];
      paused: boolean;
      startsOn: string;
      endsOn: string | null;
    }[];
    events: {
      id: string;
      medicine: string;
      status: "DUE" | "TAKEN" | "TAKEN_LATE" | "SKIPPED" | "MISSED";
      skipReason: string | null;
      dueAt: string;
    }[];
  };
};

export type OpsMeasure = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  target?: number;
  lowerIsBetter?: boolean;
  base?: number;
  note?: string | null;
};

export type Coach = {
  id: string;
  fullName: string;
  mobile: string;
  patients: number;
};

/** Someone on the sales team. `rank` is their place among the active people, 1 the best; null once off the team. */
export type Salesperson = {
  id: string;
  fullName: string;
  mobile: string | null;
  active: boolean;
  rank: number | null;
  /** patients they are the salesperson of */
  patients: number;
  /** they have a sign-in to the sales panel (a mobile number nobody else uses, and on the team) */
  canSignIn: boolean;
  /** plans they sold that the patient has paid for, and those still waiting for payment */
  plansSold: number;
  plansWaiting: number;
};

/** One of the patient's consultations, as admin sees it. */
export type OpsConsultation = {
  id: string;
  startsAt: string;
  doctorId: string;
  doctorName: string;
  visitType: "FIRST" | "FOLLOW_UP";
  status: "Booked" | "InProgress" | "Completed" | "Cancelled" | "NoShow";
  upcoming: boolean;
  /** the patient is asked on their Join screen; RECORDED has a recording to watch */
  recording: "NOT_AGREED" | "AGREED" | "RECORDED" | "FAILED";
  recordingProblem: string | null;
};

/** What the salesperson gives admin when a sale closes. */
export type SalesForm = {
  planId: string;
  salespersonId: string | null;
  coachPreference: string;
  note: string;
  /** the money was taken outside the app: the plan starts at once */
  paidOutside: { amountRupees: number; paymentRef: string } | null;
};

/** Admin's Payments view: every payment link, and money that matched no order or link of ours. */
export type OpsPayments = {
  links: PaymentLink[];
  received: {
    id: string;
    amountRupees: number;
    mobile: string | null;
    method: string | null;
    description: string | null;
    capturedAt: string;
    /** the patient whose number paid it, when there is one */
    patientId: string | null;
    patientName: string | null;
  }[];
};

/** Admin's Calls view: consultations coming up, and who is due a follow-up. */
export type OpsCalls = {
  upcoming: {
    id: string;
    startsAt: string;
    status: "Booked" | "InProgress";
    visitType: "FIRST" | "FOLLOW_UP";
    patientId: string;
    patientName: string;
    patientMobile: string;
    doctorName: string;
    salesperson: string | null;
  }[];
  followUpsDue: {
    patientId: string;
    patientName: string;
    patientMobile: string;
    salesperson: string | null;
    lastOn: string;
    daysSince: number;
    doctorName: string | null;
    planName: string | null;
    consultsIncluded: number | null;
    consultsDone: number;
  }[];
};

/** Who the team calls next, by where each patient is stuck (admin's To call view). */
export type PipelineRow = {
  patientId: string;
  patientName: string;
  patientMobile: string;
  salesperson: string | null;
};
export type OpsPipeline = {
  /** signed up, no blood test booked and no report sent in */
  bloodTest: (PipelineRow & { since: string; holding: boolean })[];
  /** a paid blood test that is not happening as booked */
  labProblem: (PipelineRow & {
    bookingId: string;
    why: string;
    since: string;
  })[];
  /** the report is in and no consultation is booked */
  consultation: (PipelineRow & {
    stage: "UNDER_REVIEW" | "APPROVED";
    since: string;
  })[];
  /** seen by the doctor, not on a plan */
  plan: (PipelineRow & { lastOn: string; linkWaiting: boolean })[];
  /** on a plan, no health coach yet */
  coach: (PipelineRow & { planName: string; since: string })[];
};

/** A blood test booking as the team sees it. */
export type TeamLabBooking = {
  id: string;
  status:
    | "PAYMENT_PENDING"
    | "BOOKED"
    | "COLLECTOR_ASSIGNED"
    | "SAMPLE_COLLECTED"
    | "PROCESSING"
    | "REPORT_READY"
    | "CANCELLED"
    | "EXPIRED";
  startsAt: string;
  endsAt: string | null;
  address: string;
  person: { name: string; age: number; gender: string };
  totalRupees: number;
  holdExpiresAt: string | null;
  reschedulesLeft: number;
  paid: boolean;
  bookedByTeam: boolean;
  needsAttention: string | null;
};

/** What booking a blood test for a patient needs, and their bookings so far. */
export type PatientLab = {
  person: { name: string; age: number | null; gender: string | null };
  addresses: { id: string; line: string; placed: boolean }[];
  priceRupees: number | null;
  bookings: TeamLabBooking[];
};

export type LabPlace = {
  eloc: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};
export type LabSlot = {
  slotId: number;
  startTime: string;
  endTime: string;
  available: number;
};

/** A consultation's video links, to share by any means. */
export type CallLinks = {
  patient: string;
  doctor: string;
  sales: string | null;
  salesName: string | null;
};

/** A doctor's time on a day, for admin's booking. */
export type OpsSlot = { id: string; startTime: string; free: boolean };
