"use client";

/*
  The workspace around every page of a staff area (admin, the sales panel, the coach's panel), built like the
  doctor's shell: a quiet rail on a laptop, a top bar and a dock on a phone, and the toast. Each area passes the
  one role it is for, its name and its places; one place needs no navigation.
  Only someone signed in with that role gets past it: anyone signed out goes to /sign-in (?next= brings them
  back), anyone else to their own home. The API checks the same on every call; this only keeps the screens apart.
*/

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SignOut, type Icon } from "@phosphor-icons/react";
import AppTheme from "@/components/ui/AppTheme";
import Avatar from "@/components/ui/Avatar";
import Wordmark from "@/components/ui/Wordmark";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import ToastProvider from "@/components/ui/ToastProvider";
import { useOnline } from "@/hooks/useOnline";
import { useSessionUser } from "@/hooks/useSessionUser";
import { useSignOut } from "@/hooks/useSignOut";
import { signInHrefFor } from "@/lib/navigation/signInReturn";
import { homePathFor, type UserRole } from "@/lib/session/authSession";
import surfaceStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import styles from "./StaffShell.module.css";

export type StaffSection = { href: string; label: string; icon: Icon };

export default function StaffShell({
  role,
  portal,
  title,
  home,
  sections,
  children,
}: {
  /** the one role this area is for */
  role: Exclude<UserRole, "PATIENT" | "DOCTOR">;
  /** the word beside the wordmark: "Admin", "Sales", "Coach" */
  portal: string;
  /** under the person's name: "inrange team", "Sales team" */
  title: string;
  home: string;
  sections: StaffSection[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user } = useSessionUser();
  const online = useOnline();
  const { signOut, leaving } = useSignOut();

  useEffect(() => {
    if (status === "OUT")
      router.replace(
        signInHrefFor(window.location.pathname + window.location.search),
      );
    else if (status && status !== role) router.replace(homePathFor(status));
  }, [status, role, router, pathname]);

  if (status !== role) {
    return (
      <AppTheme>
        <main className={surfaceStyles.page}>
          <LoadingSkeleton />
        </main>
      </AppTheme>
    );
  }

  /** Which place lights up: the section the path is under, else the home. */
  const isCurrent = (href: string) =>
    href === home
      ? !sections.some((s) => s.href !== home && pathname.startsWith(s.href))
      : pathname.startsWith(href);
  const name = user?.fullName || title;
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
  const brand = (
    <Link
      href={home}
      className={styles.brand}
      aria-label={`inrange ${portal.toLowerCase()}`}
    >
      <Wordmark height={34} />
      <span className={styles.portal}>{portal}</span>
    </Link>
  );

  return (
    <AppTheme>
      <ToastProvider className={styles.toast}>
        <div className={styles.app}>
          <aside className={styles.rail}>
            {brand}
            {/* one place needs no navigation, and no empty landmark */}
            {sections.length > 1 && (
              <nav className={styles.nav} aria-label={portal}>
                {sections.map((item) => {
                  const on = isCurrent(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={styles.navItem}
                      aria-current={on ? "page" : undefined}
                    >
                      <item.icon size={19} weight={on ? "fill" : "regular"} />
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
                <span>{title}</span>
              </div>
            </div>
            {signOutButton}
          </aside>

          <header className={styles.top}>
            {brand}
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
            <nav className={styles.dock} aria-label={portal}>
              {sections.map((item) => {
                const on = isCurrent(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={styles.dockTab}
                    aria-current={on ? "page" : undefined}
                  >
                    <item.icon size={22} weight={on ? "fill" : "regular"} />
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
