"use client";

/*
  The inrange team's workspace around every /admin page, built like the doctor's shell: a quiet rail
  of three places on a laptop (Reviews, Medicine, Doctors), a top bar and a dock on a phone, and the
  toast. A health coach (role COACH) gets the Medicine queue only, scoped to their own patients. Sign
  out sits under the admin's name on the rail and beside the avatar in the phone top bar.
  Only signed-in admins get past it: anyone signed out goes to /sign-in (?next= brings them back to
  this page), a patient to /patient-dashboard, a doctor to /doctor-dashboard. Offline, a line above
  the page says so.
*/

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardText,
  Package,
  SignOut,
  Stethoscope,
} from "@phosphor-icons/react";
import AppTheme from "@/components/ui/AppTheme";
import Avatar from "@/components/ui/Avatar";
import Wordmark from "@/components/ui/Wordmark";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import ToastProvider from "@/components/ui/ToastProvider";
import { useOnline } from "@/hooks/useOnline";
import { useSessionUser } from "@/hooks/useSessionUser";
import { useSignOut } from "@/hooks/useSignOut";
import { signInHrefFor } from "@/lib/navigation/signInReturn";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";
import styles from "./AdminShell.module.css";

const SECTIONS = [
  { href: "/admin", label: "Reviews", icon: ClipboardText, coach: false },
  { href: "/admin/medicine", label: "Medicine", icon: Package, coach: true },
  { href: "/admin/doctors", label: "Doctors", icon: Stethoscope, coach: false },
];
const MEDICINE = "/admin/medicine";

/** Which place lights up: the section the path is under, else Reviews. */
const isCurrent = (href: string, pathname: string) =>
  href === "/admin"
    ? !SECTIONS.some((s) => s.href !== "/admin" && pathname.startsWith(s.href))
    : pathname.startsWith(href);

export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status: role, user } = useSessionUser();
  const online = useOnline();
  const { signOut, leaving } = useSignOut();

  useEffect(() => {
    if (role === "OUT")
      router.replace(
        signInHrefFor(window.location.pathname + window.location.search),
      );
    if (role === "PATIENT") router.replace("/patient-dashboard");
    if (role === "DOCTOR") router.replace("/doctor-dashboard");
    // a coach works only the medicine queue
    if (role === "COACH" && !window.location.pathname.startsWith(MEDICINE))
      router.replace(MEDICINE);
  }, [role, router, pathname]);

  const coachAway = role === "COACH" && !pathname.startsWith(MEDICINE);
  if ((role !== "ADMIN" && role !== "COACH") || coachAway) {
    return (
      <AppTheme>
        <main className={adminStyles.page}>
          <LoadingSkeleton />
        </main>
      </AppTheme>
    );
  }

  const name = user?.fullName || "inrange team";
  const sections = SECTIONS.filter((s) => role === "ADMIN" || s.coach);
  const home = role === "COACH" ? MEDICINE : "/admin";
  const signOutButton = (
    <button
      type="button"
      className={styles.signOut}
      disabled={leaving}
      onClick={signOut}
    >
      <SignOut size={16} aria-hidden="true" />
      {leaving ? "Signing out" : "Sign out"}
    </button>
  );

  return (
    <AppTheme>
      <ToastProvider className={styles.toast}>
        <div className={styles.app}>
          <aside className={styles.rail}>
            <Link
              href={home}
              className={styles.brand}
              aria-label="inrange admin"
            >
              <Wordmark height={34} />
              <span className={styles.portal}>
                {role === "COACH" ? "Coach" : "Admin"}
              </span>
            </Link>
            {/* one place (a coach) needs no navigation, and no empty landmark */}
            {sections.length > 1 && (
              <nav className={styles.nav} aria-label="Admin">
                {sections.map((item) => {
                  const Icon = item.icon;
                  const on = isCurrent(item.href, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={styles.navItem}
                      aria-current={on ? "page" : undefined}
                    >
                      <Icon size={19} weight={on ? "fill" : "regular"} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}
            <div className={styles.me}>
              <Avatar name={name} size={36} />
              <div>
                <strong>{name}</strong>
                <span>
                  {role === "COACH" ? "Health coach" : "inrange team"}
                </span>
              </div>
            </div>
            {signOutButton}
          </aside>

          <header className={styles.top}>
            <Link
              href={home}
              className={styles.brand}
              aria-label="inrange admin"
            >
              <Wordmark height={34} />
              <span className={styles.portal}>
                {role === "COACH" ? "Coach" : "Admin"}
              </span>
            </Link>
            <div className={styles.topMe}>
              {signOutButton}
              <Avatar name={name} size={36} />
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

          {sections.length > 1 && (
            <nav className={styles.dock} aria-label="Admin">
              {sections.map((item) => {
                const Icon = item.icon;
                const on = isCurrent(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={styles.dockTab}
                    aria-current={on ? "page" : undefined}
                  >
                    <Icon size={22} weight={on ? "fill" : "regular"} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </ToastProvider>
    </AppTheme>
  );
}
