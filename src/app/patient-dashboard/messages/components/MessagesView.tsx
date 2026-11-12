"use client";

/**
 * Messages: one conversation with each care-team doctor.
 * Data: GET /api/care-team (until it exists, the doctors from GET /api/appointments/patient).
 */

import Link from "next/link";
import { ArrowRight, CaretRight } from "@phosphor-icons/react";
import { loadCareTeamDoctors } from "@/app/patient-dashboard/components/careTeamDoctors";
import PageGhosts from "@/app/patient-dashboard/components/PageGhosts";
import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import ErrorNotice from "@/components/ui/ErrorNotice";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import styles from "../MessagesPage.module.css";

export default function MessagesView() {
  const team = useApiResource("care-team", loadCareTeamDoctors);
  const doctors = (team.data ?? []).filter((doctor) => doctor.doctorId);

  return (
    <main className={`${layoutStyles.page} ${styles.page}`}>
      <PageHead
        title="Consultation messages"
        back={{ href: "/patient-dashboard", label: "Home" }}
      />

      {team.loading && !team.data && <PageGhosts heights={[140]} />}
      {team.error && <ErrorNotice message={team.error} onRetry={team.reload} />}

      {team.data && (
        <Card title="My doctors" className={styles.card}>
          {doctors.length === 0 ? (
            <div className={styles.emptyBlock}>
              <p className={styles.empty}>
                No doctors yet. After your first consultation, you can message
                your doctor here.
              </p>
              <Link
                href="/patient-dashboard/appointments/book"
                className={`btn ${formStyles.go}`}
              >
                <span>Book a consultation</span>
                <span className="well" aria-hidden="true">
                  <ArrowRight size={18} />
                </span>
              </Link>
            </div>
          ) : (
            <ul className={styles.people}>
              {doctors.map((doctor) => (
                <li key={doctor.doctorId}>
                  <Link
                    href={`/patient-dashboard/messages/${doctor.doctorId}`}
                    className={styles.row}
                  >
                    <Avatar
                      name={doctor.name}
                      src={doctor.photoUrl}
                      size={40}
                    />
                    <span className={styles.rowText}>
                      <strong>{doctor.name}</strong>
                      {doctor.specialization && (
                        <span>{doctor.specialization}</span>
                      )}
                    </span>
                    <CaretRight
                      size={16}
                      className={styles.go}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </main>
  );
}
