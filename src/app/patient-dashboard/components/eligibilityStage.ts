/*
  What a new patient sees before their first consultation, from their eligibility stage
  (GET /api/eligibility, src/types/eligibility.ts): a headline, one calm line, the next thing to do,
  and where they are on their path. Home and Book a consultation both read this, so they never
  disagree. Data: eligibilityService, and labTestService for the collection time.
*/

import {
  consultationMinutes,
  visitDay,
} from "@/lib/consultations/consultationTime";
import { clockTime, isCallJoinable } from "@/lib/format/dateTime";
import { checkoutHref } from "@/lib/payments/checkoutHref";
import { getMyEligibility } from "@/services/eligibilityService";
import { getLabBooking } from "@/services/labTestService";
import type { Appointment } from "@/types/appointment";
import type { Eligibility } from "@/types/eligibility";
import type { LabBooking } from "@/types/labTest";

type StatusAction = { label: string; href: string; filled: boolean };
export type EligibilityStatusView = {
  title: string;
  text: string;
  action: StatusAction | null;
  steps: { label: string }[];
  currentIndex: number;
};

const LAB_STAGES = ["AWAITING_PAYMENT", "LAB_SCHEDULED", "SAMPLE_COLLECTED"];
const LAB_STEPS = [
  { label: "Home collection" },
  { label: "Lab report" },
  { label: "Medical review" },
  { label: "Consultation" },
];
const REPORT_STEPS = [
  { label: "Your report" },
  { label: "Medical review" },
  { label: "Consultation" },
];

/** "Tomorrow, 7:00 am" or "Thu 30 Oct, 7:00 am" */
const when = (iso: string) => `${visitDay(iso)}, ${clockTime(new Date(iso))}`;

function stepIndex(eligibility: Eligibility, lab: boolean) {
  switch (eligibility.stage) {
    case "NOT_STARTED":
    case "AWAITING_PAYMENT":
    case "LAB_SCHEDULED":
      return 0;
    case "SAMPLE_COLLECTED":
      return 1;
    // a report that was not approved sends the patient back to the report step
    case "NOT_APPROVED":
      return lab ? 1 : 0;
    case "UNDER_REVIEW":
      return lab ? 2 : 1;
    case "APPROVED":
      return lab ? 3 : 2;
  }
}

function wordsFor(
  eligibility: Eligibility,
  labBooking: LabBooking | null,
  upcoming: Appointment | null,
  now: number,
): Pick<EligibilityStatusView, "title" | "text" | "action"> {
  const bookingHref = eligibility.labBookingId
    ? `/patient-dashboard/lab-tests/${encodeURIComponent(eligibility.labBookingId)}`
    : "/patient-dashboard/lab-tests";
  const seeBooking = {
    label: "See your booking",
    href: bookingHref,
    filled: false,
  };
  const collection = labBooking ? when(labBooking.collectionStartsAt) : null;

  switch (eligibility.stage) {
    // the link resumes an unfinished profile at its saved question, else asks for the report
    case "NOT_STARTED":
      return {
        title: "Finish setting up your account",
        text: "Answer any questions left, then upload a blood test report from the last 3 months, or book home tests.",
        action: {
          label: "Continue where you left off",
          href: "/onboarding?step=report",
          filled: true,
        },
      };
    case "AWAITING_PAYMENT":
      return {
        title: "Pay to confirm your collection",
        text: collection
          ? `Your home collection, ${collection}, is held for you.`
          : "Your home collection time is held for you.",
        action: eligibility.labBookingId
          ? {
              label: "Pay now",
              href: checkoutHref({
                purpose: "LAB_BOOKING",
                referenceId: eligibility.labBookingId,
                returnTo: "/patient-dashboard",
              }),
              filled: true,
            }
          : seeBooking,
      };
    case "LAB_SCHEDULED":
    case "SAMPLE_COLLECTED": {
      // the booking's own stage is fresher than eligibility's (webhooks move it first)
      const lab = labBooking?.status;
      if (
        lab === "PROCESSING" ||
        lab === "REPORT_READY" ||
        eligibility.stage === "SAMPLE_COLLECTED"
      )
        return {
          title:
            lab === "PROCESSING"
              ? "The lab is testing your sample"
              : "Your sample is at the lab",
          text: "The report goes straight to our medical team. We'll let you know what's next.",
          action: seeBooking,
        };
      if (lab === "COLLECTOR_ASSIGNED")
        return {
          title:
            labBooking?.collector?.journey === "ARRIVED"
              ? "Your collector has arrived"
              : labBooking?.collector?.journey === "ON_THE_WAY"
                ? "Your collector is on the way"
                : "Your collector is assigned",
          text: `${labBooking?.collector?.name ?? "A collector from Redcliffe Labs"} comes ${collection ?? "at the booked time"}.`,
          action: seeBooking,
        };
      return {
        title: "Your blood test is booked",
        text: collection
          ? `Home collection: ${collection}.`
          : "Your home collection is booked.",
        action: seeBooking,
      };
    }
    case "UNDER_REVIEW":
      return {
        title: "Your report is with our medical team",
        text: "We'll let you know when you can book your consultation.",
        action: {
          label: "See your reports",
          href: "/patient-dashboard/reports",
          filled: false,
        },
      };
    case "NOT_APPROVED":
      return {
        title: "Please upload a newer report",
        text:
          eligibility.reviewNote ||
          "Our medical team could not approve this report.",
        action: {
          label: "Upload a newer report",
          href: "/patient-dashboard/reports",
          filled: true,
        },
      };
    case "APPROVED":
      if (
        upcoming &&
        isCallJoinable(upcoming.startsAt, consultationMinutes(upcoming), now)
      ) {
        return {
          title: "Your consultation is open",
          text: "Join the video call now.",
          action: {
            label: "Join the video call",
            href: `/consultation/${upcoming.id}`,
            filled: true,
          },
        };
      }
      if (upcoming) {
        return {
          title: when(upcoming.startsAt),
          text: "Your consultation, by video. Join opens 10 minutes before.",
          action: {
            label: "See your appointment",
            href: "/patient-dashboard/appointments",
            filled: false,
          },
        };
      }
      return {
        title: "Book your consultation",
        text: "Our medical team has approved your report. Choose a time for your video consultation.",
        action: {
          label: "Book your consultation",
          href: "/patient-dashboard/appointments/book",
          filled: true,
        },
      };
  }
}

export function eligibilityStatus(
  eligibility: Eligibility,
  labBooking: LabBooking | null,
  upcoming: Appointment | null,
  now: number,
): EligibilityStatusView {
  const lab =
    eligibility.path === "LAB_TEST" || LAB_STAGES.includes(eligibility.stage);
  return {
    ...wordsFor(eligibility, labBooking, upcoming, now),
    steps: lab ? LAB_STEPS : REPORT_STEPS,
    currentIndex: stepIndex(eligibility, lab),
  };
}

/**
 * The eligibility review (null while the backend lacks GET /api/eligibility) and, while the patient
 * waits on a home collection, that booking for its time. A booking that fails to load only drops
 * the time from the card.
 */
export async function loadEligibilityReview() {
  const eligibility = await getMyEligibility();
  const bookingId =
    eligibility && LAB_STAGES.includes(eligibility.stage)
      ? eligibility.labBookingId
      : null;
  const labBooking = bookingId
    ? await getLabBooking(bookingId).catch(() => null)
    : null;
  return { eligibility, labBooking };
}
