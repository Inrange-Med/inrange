"use client";

/*
  The signed-in patient app around every /patient-dashboard page. One place only (doctor portal v2 PRD,
  17 Nov 2026 call: patients are not comfortable with software): Home, with the one next step and three
  rows (Prescriptions, Lab reports, Payments). The bar holds the wordmark, which always leads Home, and the
  patient's name, which opens their profile. No section tabs and no dock: every other page is reached from
  Home and comes back to it. Care, Resources and Messages are off the patient's way (their code stays).
  Only signed-in patients get past it: anyone signed out goes to /sign-in (?next= brings them back to
  this page) and anyone else (a doctor, an admin, a coach) to their own home.

  The chat thread (/patient-dashboard/messages/<doctorId>) brings its own bar. A task that owns the screen
  (the checkout, the first-injection walk-through) turns on focus mode (shellFocus.tsx): the bar becomes a
  round close, the task's name centred and a spacer, so the task is the one thing on screen.
*/

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X } from "@phosphor-icons/react";
import Avatar from "@/components/ui/Avatar";
import AppTheme from "@/components/ui/AppTheme";
import ToastProvider from "@/components/ui/ToastProvider";
import Wordmark from "@/components/ui/Wordmark";
import { useOnline } from "@/hooks/useOnline";
import { useSessionUser } from "@/hooks/useSessionUser";
import { signInHrefFor } from "@/lib/navigation/signInReturn";
import { homePathFor } from "@/lib/session/authSession";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import PageGhosts from "./PageGhosts";
import { ShellFocusContext, type ShellFocus } from "./shellFocus";
import styles from "./PatientShell.module.css";

/** Focus mode's bar: the close (or an empty slot), the task's name centred, a 44px spacer. */
function FocusBar({
  focus,
  scrolled,
}: {
  focus: ShellFocus;
  scrolled: boolean;
}) {
  return (
    <header
      className={`${styles.bar} ${styles.focusBar}`}
      data-scrolled={scrolled}
    >
      <div className={styles.barInner}>
        {focus.onClose ? (
          <button
            type="button"
            className={formStyles.round}
            onClick={focus.onClose}
            aria-label={focus.closeLabel ?? "Close"}
          >
            <X size={18} />
          </button>
        ) : focus.closeHref ? (
          <Link
            href={focus.closeHref}
            className={formStyles.round}
            aria-label={focus.closeLabel ?? "Close"}
          >
            <X size={18} />
          </Link>
        ) : (
          <span aria-hidden="true" className={styles.focusSpacer} />
        )}
        <p className={styles.focusTitle}>{focus.title}</p>
        <span aria-hidden="true" className={styles.focusSpacer} />
      </div>
    </header>
  );
}

export default function PatientShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status: role, user } = useSessionUser();
  const online = useOnline();
  const [scrolled, setScrolled] = useState(false);
  const [registered, setRegistered] = useState<ShellFocus | null>(null);

  useEffect(() => {
    if (role === "OUT")
      router.replace(
        signInHrefFor(window.location.pathname + window.location.search),
      );
    else if (role && role !== "PATIENT") router.replace(homePathFor(role));
  }, [role, router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const firstName = (user?.fullName ?? "").trim().split(/\s+/)[0] || "Profile";
  const onProfile = pathname.startsWith("/patient-dashboard/profile");
  const bare = /^\/patient-dashboard\/messages\/[^/]+/.test(pathname);
  // the checkout is a focused page from its first frame; the page fills in where Close goes
  const onCheckout = pathname.startsWith("/patient-dashboard/checkout");
  const focus: ShellFocus | null = bare
    ? null
    : (registered ?? (onCheckout ? { title: "Checkout" } : null));
  const tabs = !bare && !focus;

  // while the session is checked: the bar as it will be (wordmark only, or the focus bar), and the
  // page's ghosts under it, so nothing moves when the page lands
  if (role !== "PATIENT") {
    return (
      <AppTheme>
        <div className={styles.app}>
          {focus ? (
            <FocusBar focus={focus} scrolled={false} />
          ) : (
            !bare && (
              <header className={styles.bar}>
                <div className={styles.barInner}>
                  <span className={styles.brand}>
                    <Wordmark height={34} />
                  </span>
                </div>
              </header>
            )
          )}
          <main className={layoutStyles.page} aria-busy="true">
            <PageGhosts title heights={[120, 180]} />
          </main>
        </div>
      </AppTheme>
    );
  }

  return (
    <AppTheme>
      <ShellFocusContext.Provider value={setRegistered}>
        <ToastProvider className={bare ? styles.toastChat : ""}>
          <div className={styles.app}>
            {focus && <FocusBar focus={focus} scrolled={scrolled} />}
            {tabs && (
              <header className={styles.bar} data-scrolled={scrolled}>
                <div className={styles.barInner}>
                  <Link
                    href="/patient-dashboard"
                    className={styles.brand}
                    aria-label="inrange, home"
                  >
                    <Wordmark height={34} />
                  </Link>
                  <Link
                    href="/patient-dashboard/profile"
                    className={styles.me}
                    aria-current={onProfile ? "page" : undefined}
                    aria-label={`${firstName}: your profile`}
                  >
                    <span>{firstName}</span>
                    <Avatar name={user?.fullName ?? firstName} size={32} />
                  </Link>
                </div>
              </header>
            )}

            {!online && (
              <p className={styles.offline} role="status">
                You are offline. Check your connection.
              </p>
            )}

            {children}
          </div>
        </ToastProvider>
      </ShellFocusContext.Provider>
    </AppTheme>
  );
}
