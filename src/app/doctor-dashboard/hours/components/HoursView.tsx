"use client";

/*
  Hours: when patients can book the doctor. The weekly timetable and the days off ahead both come
  from GET /api/doctor/availability; every save answers the whole picture again, so each card hands
  it back here and the count of consultations left outside the hours stays current.
*/

import Link from "next/link";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import { getMyAvailability } from "@/services/doctorPortalService";
import WeeklyHoursCard from "./WeeklyHoursCard";
import DaysOffCard from "./DaysOffCard";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "../HoursPage.module.css";

export default function HoursView() {
  const availability = useApiResource("doctor-availability", getMyAvailability);

  if (availability.error && !availability.data) {
    return (
      <main className={clinicStyles.page}>
        <ErrorNotice
          message={availability.error}
          onRetry={availability.reload}
        />
      </main>
    );
  }
  if (!availability.data) {
    return (
      <main className={clinicStyles.page}>
        <LoadingSkeleton />
      </main>
    );
  }

  const { bookedOutside } = availability.data;

  return (
    <main className={clinicStyles.page}>
      <PageHead
        className={clinicStyles.pageHead}
        title="Hours"
        sub="Set when patients can book you. Times are India time (IST)."
      />

      {bookedOutside > 0 && (
        <p className={styles.note} role="status">
          <span className="num">{bookedOutside}</span>{" "}
          {bookedOutside === 1
            ? "consultation stays booked"
            : "consultations stay booked"}{" "}
          outside your hours. Move or cancel{" "}
          {bookedOutside === 1 ? "it" : "them"} from{" "}
          <Link href="/doctor-dashboard/schedule">Schedule</Link> if needed.
        </p>
      )}

      <div className={styles.hoursGrid}>
        <WeeklyHoursCard
          availability={availability.data}
          onSaved={availability.setData}
        />
        <DaysOffCard
          daysOff={availability.data.daysOff}
          onChanged={availability.setData}
        />
      </div>
    </main>
  );
}
