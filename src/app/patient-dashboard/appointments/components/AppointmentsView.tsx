"use client";

/**
 * Appointments: what is booked (with Join, camera check, Change time, Message and Add to calendar)
 * and past consultations. Data: GET /api/appointments/patient. Design: the design repo's
 * Appointments.tsx.
 */

import { useState } from "react";
import DeviceCheck from "@/components/ui/DeviceCheck";
import ErrorNotice from "@/components/ui/ErrorNotice";
import PageGhosts from "@/app/patient-dashboard/components/PageGhosts";
import PageHead from "@/components/ui/PageHead";
import Sheet from "@/components/ui/Sheet";
import { useApiResource } from "@/hooks/useApiResource";
import { useNow } from "@/hooks/useNow";
import { isUpcomingConsultation } from "@/lib/consultations/consultationTime";
import { listMyAppointments } from "@/services/appointmentService";
import type { Appointment } from "@/types/appointment";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import ConsultationChangeTimeSheet from "./ConsultationChangeTimeSheet";
import PastConsultationsCard from "./PastConsultationsCard";
import UpcomingCard from "./UpcomingCard";
import styles from "../AppointmentsPage.module.css";

export default function AppointmentsView() {
  const now = useNow();
  const appointments = useApiResource("my-appointments", listMyAppointments);
  const [checkingDevices, setCheckingDevices] = useState(false);
  const [moving, setMoving] = useState<Appointment | null>(null);

  const all = appointments.data ?? [];
  const upcoming = all.filter((appointment) =>
    isUpcomingConsultation(appointment, now),
  );
  const past = all
    .filter((appointment) => !isUpcomingConsultation(appointment, now))
    .reverse();

  return (
    <main className={`${layoutStyles.page} ${styles.page}`}>
      <PageHead
        title="Appointments"
        back={{ href: "/patient-dashboard/care", label: "Care" }}
      />

      {appointments.loading && !appointments.data && (
        <PageGhosts heights={[196, 140]} />
      )}
      {appointments.error && (
        <ErrorNotice
          message={appointments.error}
          onRetry={appointments.reload}
        />
      )}

      {appointments.data && (
        <div className={styles.cols}>
          <UpcomingCard
            upcoming={upcoming}
            now={now}
            onCheckDevices={() => setCheckingDevices(true)}
            onChangeTime={setMoving}
          />
          <PastConsultationsCard past={past} />
        </div>
      )}

      <Sheet
        open={checkingDevices}
        onClose={() => setCheckingDevices(false)}
        title="Camera and microphone"
      >
        {checkingDevices && <DeviceCheck />}
      </Sheet>
      <Sheet
        open={!!moving}
        onClose={() => setMoving(null)}
        title="Change the time"
      >
        {moving && (
          <ConsultationChangeTimeSheet
            appointment={moving}
            onMoved={() => {
              setMoving(null);
              appointments.reload();
            }}
          />
        )}
      </Sheet>
    </main>
  );
}
