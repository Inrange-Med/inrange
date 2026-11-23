"use client";

/*
  The doctor's workspace around every /doctor-dashboard page. Four places (doctor portal v2 PRD,
  17 Nov 2026 call: "what a doctor needs, and nothing more"; Patients added 23 Nov 2026 so a doctor can
  open any of their patients' charts): Today, Patients, History, Availability, as a quiet rail on a laptop
  and a dock on a phone, with the toast. Today carries the count of what is waiting on the doctor (calls
  open, prescriptions to write or send). A consultation's page lights Today, a chart lights Patients.
  The rest of the old portal (Schedule, Notes, Messages) is off the doctor's navigation; its pages send
  old links to Today and its code stays for the back office.
  Only signed-in doctors get past it: anyone signed out goes to /sign-in (?next= brings them back to
  this page), anyone else (a patient, an admin, a coach) to their own home. Offline, a line above the
  page says so.
*/

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClockCounterClockwise,
  Clock,
  SquaresFour,
  UsersThree,
} from "@phosphor-icons/react";
import AppTheme from "@/components/ui/AppTheme";
import Avatar from "@/components/ui/Avatar";
import Wordmark from "@/components/ui/Wordmark";
import ToastProvider from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { useOnline } from "@/hooks/useOnline";
import { useSessionUser } from "@/hooks/useSessionUser";
import { DATA_CHANGED_EVENT } from "@/lib/http/apiClient";
import { signInHrefFor } from "@/lib/navigation/signInReturn";
import { homePathFor } from "@/lib/session/authSession";
import { toApiDate } from "@/lib/format/dateTime";
import { countWaiting } from "@/services/consultationService";
import { getMyDoctorProfile } from "@/services/doctorPortalService";
import ClinicSkeleton from "./ClinicSkeleton";
import SignOutButton from "./SignOutButton";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "./DoctorShell.module.css";

type Section = "today" | "patients" | "history" | "hours";

const SECTIONS: {
  id: Section;
  href: string;
  label: string;
  icon: typeof SquaresFour;
  /** carries the count of what is waiting on the doctor */
  counted?: true;
}[] = [
  {
    id: "today",
    href: "/doctor-dashboard",
    label: "Today",
    icon: SquaresFour,
    counted: true,
  },
  {
    id: "patients",
    href: "/doctor-dashboard/patients",
    label: "Patients",
    icon: UsersThree,
  },
  {
    id: "history",
    href: "/doctor-dashboard/history",
    label: "History",
    icon: ClockCounterClockwise,
  },
  {
    id: "hours",
    href: "/doctor-dashboard/hours",
    label: "Availability",
    icon: Clock,
  },
];

/** Which place lights up for a page: its first folder (a consultation's page sits under Today). */
function sectionFor(pathname: string): Section | null {
  const folder = pathname.split("/")[2];
  if (!folder || folder === "consultations") return "today";
  return SECTIONS.find((section) => section.id === folder)?.id ?? null;
}

export default function DoctorShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status: role, user } = useSessionUser();
  const online = useOnline();
  const isDoctor = role === "DOCTOR";
  const profile = useApiResource(
    isDoctor ? "doctor-profile" : null,
    getMyDoctorProfile,
  );
  // the count refreshes on every move between places and after every change the doctor makes
  // (a prescription sent), so done work drops off at once
  const counts = useApiResource(
    isDoctor ? `waiting-count-${pathname}` : null,
    () => countWaiting(toApiDate(new Date())),
  );
  const reloadCounts = counts.reload;
  useEffect(() => {
    window.addEventListener(DATA_CHANGED_EVENT, reloadCounts);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, reloadCounts);
  }, [reloadCounts]);

  useEffect(() => {
    if (role === "OUT")
      router.replace(
        signInHrefFor(window.location.pathname + window.location.search),
      );
    else if (role && role !== "DOCTOR") router.replace(homePathFor(role));
  }, [role, router]);

  // while the session is checked the frame is already up (the brand only: no places, no name), and the
  // page breathes inside it, so nothing pops in once the role is known
  if (!isDoctor) {
    return (
      <AppTheme>
        <div className={styles.app}>
          <aside className={styles.rail}>
            <span className={styles.brand}>
              <Wordmark height={34} />
              <span className={styles.portal}>Clinician</span>
            </span>
          </aside>
          <header className={styles.top}>
            <span className={styles.brand}>
              <Wordmark height={34} />
              <span className={styles.portal}>Clinician</span>
            </span>
          </header>
          <div className={styles.main}>
            <main className={clinicStyles.page}>
              <ClinicSkeleton />
            </main>
          </div>
        </div>
      </AppTheme>
    );
  }

  const section = sectionFor(pathname);
  const name = profile.data?.fullName ?? user?.fullName ?? "Doctor";
  const countOf = (counted?: true) =>
    counted && counts.data ? counts.data : 0;

  return (
    <AppTheme>
      <ToastProvider className={styles.toast}>
        <div className={styles.app}>
          <aside className={styles.rail}>
            <Link
              href="/doctor-dashboard"
              className={styles.brand}
              aria-label="inrange clinician portal"
            >
              <Wordmark height={34} />
              <span className={styles.portal}>Clinician</span>
            </Link>
            <nav className={styles.nav} aria-label="Clinician">
              {SECTIONS.map((item) => {
                const Icon = item.icon;
                const count = countOf(item.counted);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={styles.navItem}
                    aria-current={item.id === section ? "page" : undefined}
                  >
                    <Icon
                      size={19}
                      weight={item.id === section ? "fill" : "regular"}
                    />
                    {item.label}
                    {count > 0 && <span className={styles.badge}>{count}</span>}
                  </Link>
                );
              })}
            </nav>
            <div className={styles.me}>
              <Avatar name={name} src={profile.data?.photoUrl} size={36} />
              <div>
                <strong>{name}</strong>
                {profile.data?.specialization && (
                  <span>{profile.data.specialization}</span>
                )}
              </div>
            </div>
            <SignOutButton className={styles.signOut} />
          </aside>

          <header className={styles.top}>
            <Link
              href="/doctor-dashboard"
              className={styles.brand}
              aria-label="inrange clinician portal"
            >
              <Wordmark height={34} />
              <span className={styles.portal}>Clinician</span>
            </Link>
            <div className={styles.topMe}>
              <SignOutButton className={styles.signOut} />
              <Avatar name={name} src={profile.data?.photoUrl} size={36} />
            </div>
          </header>

          <div className={styles.main}>
            {!online && (
              <p className={styles.offline} role="status">
                You are offline. Check your connection.
              </p>
            )}
            {children}
          </div>

          <nav className={styles.dock} aria-label="Clinician">
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              const on = item.id === section;
              const count = countOf(item.counted);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={styles.dockTab}
                  aria-current={on ? "page" : undefined}
                >
                  <span className={styles.dockIcon}>
                    <Icon size={22} weight={on ? "fill" : "regular"} />
                    {count > 0 && <i className={styles.dockBadge}>{count}</i>}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </ToastProvider>
    </AppTheme>
  );
}
