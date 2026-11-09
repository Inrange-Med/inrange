"use client";

/*
  The doctor's workspace around every /doctor-dashboard page (Arhaan's clinician ClinicShell): a
  quiet rail of five places on a laptop, a top bar and a dock on a phone, and the toast. The places
  lead (Today, Schedule, Patients); the two queues with counts (Notes, Messages) close the list.
  Sign out sits under the doctor's name on the rail and beside the avatar in the phone top bar.
  Only signed-in doctors get past it: anyone signed out goes to /sign-in (?next= brings them back to
  this page), a patient to /patient-dashboard. Offline, a line above the page says so.

  A loaded call note (/doctor-dashboard/notes/<id>) is a pushed screen: below a laptop it brings its
  own top and bottom bars and marks itself data-own-bars, so the shell's phone chrome steps aside
  (DoctorShell.module.css). Its loading and error states keep the shell's bars.
*/

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarBlank,
  ChatsCircle,
  Notepad,
  SquaresFour,
  Users,
} from "@phosphor-icons/react";
import AppTheme from "@/components/ui/AppTheme";
import Avatar from "@/components/ui/Avatar";
import Wordmark from "@/components/ui/Wordmark";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import ToastProvider from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { useOnline } from "@/hooks/useOnline";
import { useSessionUser } from "@/hooks/useSessionUser";
import { DATA_CHANGED_EVENT } from "@/lib/http/apiClient";
import { signInHrefFor } from "@/lib/navigation/signInReturn";
import { getMyDoctorProfile } from "@/services/doctorPortalService";
import { getWorkCounts } from "@/services/patientRecordService";
import type { DoctorWorkCounts } from "@/types/patientRecord";
import SignOutButton from "./SignOutButton";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "./DoctorShell.module.css";

type Section = "today" | "schedule" | "patients" | "notes" | "messages";

const SECTIONS: {
  id: Section;
  href: string;
  label: string;
  icon: typeof Users;
  count?: keyof DoctorWorkCounts;
}[] = [
  {
    id: "today",
    href: "/doctor-dashboard",
    label: "Today",
    icon: SquaresFour,
    count: "waitingOnYou",
  },
  {
    id: "schedule",
    href: "/doctor-dashboard/schedule",
    label: "Schedule",
    icon: CalendarBlank,
  },
  {
    id: "patients",
    href: "/doctor-dashboard/patients",
    label: "Patients",
    icon: Users,
  },
  {
    id: "notes",
    href: "/doctor-dashboard/notes",
    label: "Notes",
    icon: Notepad,
    count: "notesToSign",
  },
  {
    id: "messages",
    href: "/doctor-dashboard/messages",
    label: "Messages",
    icon: ChatsCircle,
    count: "messagesForYou",
  },
];

/** Which section lights up for a page: its first folder (a patient's record sits under Patients, a note under Notes). */
function sectionFor(pathname: string): Section | null {
  const folder = pathname.split("/")[2];
  if (!folder) return "today";
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
  // the badges refresh on every move between places and after every change the doctor makes
  // (an answered message, a reviewed report, a signed note), so done work drops off at once
  const counts = useApiResource(
    isDoctor ? `work-counts-${pathname}` : null,
    getWorkCounts,
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
    if (role === "PATIENT") router.replace("/patient-dashboard");
  }, [role, router]);

  if (!isDoctor) {
    return (
      <AppTheme>
        <main className={clinicStyles.page}>
          <LoadingSkeleton />
        </main>
      </AppTheme>
    );
  }

  const section = sectionFor(pathname);
  const name = profile.data?.fullName ?? user?.fullName ?? "Doctor";
  const countOf = (key?: keyof DoctorWorkCounts) =>
    key && counts.data ? counts.data[key] : 0;

  return (
    <AppTheme>
      <ToastProvider className={styles.toast}>
        <div className={styles.app}>
          <aside className={styles.rail}>
            <Link
              href="/doctor-dashboard"
              className={styles.brand}
              aria-label="InRange clinician portal"
            >
              <Wordmark height={24} />
              <span className={styles.portal}>Clinician</span>
            </Link>
            <nav className={styles.nav} aria-label="Clinician">
              {SECTIONS.map((item) => {
                const Icon = item.icon;
                const count = countOf(item.count);
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
              aria-label="InRange clinician portal"
            >
              <Wordmark height={22} />
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
              const count = countOf(item.count);
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
