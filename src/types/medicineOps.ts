/**
 * The medicine queue in the admin area (admin and health coach). Doc: docs/backend/medicine-flow.md.
 */

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
  | "MATCH_MEDICINE";

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
    salesperson: string | null;
    /** the plan admin put them on, waiting for them to pay in the app */
    assignedPlan: {
      planId: string;
      name: string;
      priceRupees: number;
      assignedAt: string;
      salesperson: string | null;
    } | null;
  };
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
