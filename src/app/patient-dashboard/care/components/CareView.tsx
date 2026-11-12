"use client";

/**
 * Care: the doctors looking after you, your programme and treatment, blood tests and the next
 * consultation. Design: the design repo's CareTab.tsx.
 * Data: GET /api/appointments/patient, the care team (GET /api/care-team, else the doctors from the
 * consultations), GET /api/subscriptions/status + /plans, and the PROPOSED care-plan endpoints in
 * carePlanService (prescription and deliveries; a calm note until they exist).
 */

import { useState } from "react";
import {
  loadCareTeamDoctors,
  type CareTeamDoctor,
} from "@/app/patient-dashboard/components/careTeamDoctors";
import DeviceCheck from "@/components/ui/DeviceCheck";
import ErrorNotice from "@/components/ui/ErrorNotice";
import PageHead from "@/components/ui/PageHead";
import Sheet from "@/components/ui/Sheet";
import { useApiResource } from "@/hooks/useApiResource";
import { useNow } from "@/hooks/useNow";
import { isUpcomingConsultation } from "@/lib/consultations/consultationTime";
import { getSessionUser } from "@/lib/session/authSession";
import { listMyAppointments } from "@/services/appointmentService";
import { loadCarePlan } from "@/services/carePlanService";
import { getMyEligibility } from "@/services/eligibilityService";
import {
  getSubscriptionStatus,
  listPlans,
} from "@/services/subscriptionService";
import PageGhosts from "@/app/patient-dashboard/components/PageGhosts";
import AppointmentsCard from "./AppointmentsCard";
import BloodTestsCard from "./BloodTestsCard";
import CareTeamCard from "./CareTeamCard";
import DeliverySheet from "./DeliverySheet";
import DoctorSheet from "./DoctorSheet";
import PrescriptionSheet from "./PrescriptionSheet";
import CareProgrammeCard, { type Programme } from "./CareProgrammeCard";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import styles from "../CarePage.module.css";

type SheetName = "rx" | "delivery" | "devices" | null;

/** The signed-in patient's active plan, if any. */
async function loadProgramme(): Promise<Programme> {
  const userId = getSessionUser()?.userId;
  if (!userId) return { active: false, plan: null };
  const status = await getSubscriptionStatus(userId);
  if (!status.hasActivePlan) return { active: false, plan: null };
  const plans = await listPlans();
  return {
    active: true,
    plan: plans.find((plan) => plan.id === status.planId) ?? null,
  };
}

export default function CareView() {
  const now = useNow();
  const appointments = useApiResource("my-appointments", listMyAppointments);
  const programme = useApiResource("my-programme", loadProgramme);
  const carePlan = useApiResource("care-plan", loadCarePlan);
  const team = useApiResource("care-team", loadCareTeamDoctors);
  const eligibility = useApiResource("eligibility", getMyEligibility);
  const [doctor, setDoctor] = useState<CareTeamDoctor | null>(null);
  const [sheet, setSheet] = useState<SheetName>(null);

  const all = appointments.data ?? [];
  const doctors = team.data ?? [];
  const next =
    all.find((appointment) => isUpcomingConsultation(appointment, now)) ?? null;
  const hasTeam = doctors.length > 0;
  const prescription = carePlan.data?.prescription ?? null;
  // the delivery on its way if there is one, otherwise the last one that arrived
  const orders = carePlan.data?.orders ?? [];
  const order =
    orders.find((candidate) => candidate.status !== "DELIVERED") ??
    orders[0] ??
    null;
  const closeSheet = () => setSheet(null);

  return (
    <main className={`${layoutStyles.page} ${styles.page}`}>
      <PageHead title="Your care" />

      {(appointments.loading || team.loading) &&
        !(appointments.data && team.data) && (
          <PageGhosts heights={[168, 212, 168]} className={styles.grid} />
        )}
      {appointments.error && (
        <ErrorNotice
          message={appointments.error}
          onRetry={appointments.reload}
        />
      )}
      {team.error && <ErrorNotice message={team.error} onRetry={team.reload} />}

      {appointments.data && team.data && (
        <div className={`${styles.grid} ${hasTeam ? "" : styles.gridFirst}`}>
          {hasTeam ? (
            <CareTeamCard
              doctors={doctors}
              next={next}
              onOpenDoctor={setDoctor}
            />
          ) : (
            <AppointmentsCard
              next={null}
              now={now}
              everyWidth
              onCheckDevices={() => setSheet("devices")}
            />
          )}
          <CareProgrammeCard
            programme={programme.data}
            programmeError={programme.error}
            carePlan={carePlan.data}
            carePlanError={carePlan.error}
            order={order}
            onRetry={() => {
              programme.reload();
              carePlan.reload();
            }}
            onOpenPrescription={() => setSheet("rx")}
            onOpenDelivery={() => setSheet("delivery")}
          />
          <BloodTestsCard
            hasTeam={hasTeam}
            hasTestsOrReport={Boolean(eligibility.data?.path)}
            settled={Boolean(eligibility.data || eligibility.error)}
          />
          {hasTeam && (
            <AppointmentsCard
              next={next}
              now={now}
              onCheckDevices={() => setSheet("devices")}
            />
          )}
        </div>
      )}

      <Sheet
        open={!!doctor}
        onClose={() => setDoctor(null)}
        title={doctor?.name ?? ""}
      >
        {doctor && (
          <DoctorSheet
            doctor={doctor}
            booked={
              all.find(
                (appointment) =>
                  isUpcomingConsultation(appointment, now) &&
                  (appointment.doctorId ?? appointment.doctorName) ===
                    (doctor.doctorId ?? doctor.name),
              ) ?? null
            }
          />
        )}
      </Sheet>
      <Sheet
        open={sheet === "rx"}
        onClose={closeSheet}
        title="Your prescription"
      >
        {sheet === "rx" && prescription && (
          <PrescriptionSheet prescription={prescription} />
        )}
      </Sheet>
      <Sheet
        open={sheet === "delivery"}
        onClose={closeSheet}
        title={
          order?.status === "DELIVERED" ? "Last delivery" : "Next delivery"
        }
      >
        {sheet === "delivery" && order && <DeliverySheet order={order} />}
      </Sheet>
      <Sheet
        open={sheet === "devices"}
        onClose={closeSheet}
        title="Camera and microphone"
      >
        {sheet === "devices" && <DeviceCheck />}
      </Sheet>
    </main>
  );
}
