/** The coach's panel: a health or fitness coach's own patients. Docs: docs/backend/sales-and-coach.md. */

/** A diet chart or an exercise plan: the newest version, and how many there have been. */
export type CoachPlan = {
  text: string;
  by: string;
  at: string;
  versions: number;
};

export type CoachCall = {
  id: string;
  kind: "HEALTH" | "FITNESS";
  calledOn: string;
  note: string;
  by: string;
};

export type CoachPatientRow = {
  id: string;
  name: string;
  mobile: string;
  /** which coach I am for them */
  asHealth: boolean;
  asFitness: boolean;
  planName: string | null;
  planEndsAt: string | null;
  coachCalls: number | null;
  fitnessCalls: number | null;
  healthCallsMade: number;
  fitnessCallsMade: number;
  lastCallOn: string | null;
  hasDiet: boolean;
  openTasks: number;
};

export type CoachPatient = {
  patient: {
    id: string;
    name: string;
    mobile: string;
    age: number | null;
    gender: string | null;
    heightCm: number | null;
    weightKg: number | null;
    doctors: string[];
    coachName: string | null;
    fitnessCoachName: string | null;
  };
  plan: {
    name: string;
    startedAt: string;
    endsAt: string;
    doctorConsults: number | null;
    coachCalls: number | null;
    fitnessCalls: number | null;
  } | null;
  nextConsultation: { startsAt: string; doctorName: string } | null;
  /** read only: the coach follows the prescription and never changes it */
  prescription: {
    doctorName: string;
    sentAt: string | null;
    diagnosis: string;
    advice: string;
    medicines: { name: string; words: string }[];
  } | null;
  /** which side I may write for this patient */
  can: { health: boolean; fitness: boolean };
  diet: CoachPlan | null;
  fitness: CoachPlan | null;
  calls: CoachCall[];
  healthCallsMade: number;
  fitnessCallsMade: number;
  remarks: { id: string; at: string; by: string; text: string }[];
};
