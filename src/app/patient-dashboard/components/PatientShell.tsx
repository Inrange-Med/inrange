"use client";

/*
  The signed-in patient app around every /patient-dashboard page (Arhaan's account/Shell.tsx): a thin bar
  with the wordmark, the four sections (centred pills on a laptop, a dock on a phone), an offline
  line and the toast. Only signed-in patients get past it: anyone signed out goes to /sign-in
  (?next= brings them back to this page) and a doctor goes to their own dashboard.

  The chat thread (/patient-dashboard/messages/<doctorId>) brings its own bar, so the shell draws neither
  the bar nor the dock there, as in Arhaan's design. A task that owns the screen (the checkout, the
  first-injection walk-through) turns on focus mode (shellFocus.tsx): the bar becomes a round close,
  the task's name centred and a spacer, and the dock goes, so the task is the one thing on screen.
*/

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenText,
  FirstAidKit,
  House,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import AppTheme from "@/components/ui/AppTheme";
import ToastProvider from "@/components/ui/ToastProvider";
import Wordmark from "@/components/ui/Wordmark";
import { useOnline } from "@/hooks/useOnline";
import { useSessionUser } from "@/hooks/useSessionUser";
import { signInHrefFor } from "@/lib/navigation/signInReturn";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import PageGhosts from "./PageGhosts";
import { ShellFocusContext, type ShellFocus } from "./shellFocus";
import styles from "./PatientShell.module.css";

type Section = "home" | "care" | "resources" | "profile";

const SECTIONS: {
  id: Section;
  href: string;
  label: string;
  icon: typeof House;
}[] = [
  { id: "home", href: "/patient-dashboard", label: "Home", icon: House },
  {
    id: "care",
    href: "/patient-dashboard/care",
    label: "Care",
    icon: FirstAidKit,
  },
  {
    id: "resources",
    href: "/patient-dashboard/resources",
    label: "Resources",
    icon: BookOpenText,
  },
  {
    id: "profile",
    href: "/patient-dashboard/profile",
    label: "Profile",
    icon: UserCircle,
  },
];

/** Which section lights up for a page: the four sections, and the pages that sit under them. */
const SECTION_OF_FOLDER: Record<string, Section> = {
  messages: "home",
  care: "care",
  appointments: "care",
  "lab-tests": "care",
  reports: "care",
  plans: "care",
  checkout: "care",
  resources: "resources",
  profile: "profile",
};

function sectionFor(pathname: string): Section | null {
  const folder = pathname.split("/")[2];
  if (!folder) return "home";
  return SECTION_OF_FOLDER[folder] ?? null;
}

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
  const { status: role } = useSessionUser();
  const online = useOnline();
  const [scrolled, setScrolled] = useState(false);
  const [registered, setRegistered] = useState<ShellFocus | null>(null);

  useEffect(() => {
    if (role === "OUT")
      router.replace(
        signInHrefFor(window.location.pathname + window.location.search),
      );
    if (role === "DOCTOR") router.replace("/doctor-dashboard");
    if (role === "ADMIN") router.replace("/admin");
  }, [role, router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const current = sectionFor(pathname);
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
        <ToastProvider
          className={bare ? styles.toastChat : tabs ? styles.toastUp : ""}
        >
          <div className={`${styles.app} ${tabs ? styles.withTabs : ""}`}>
            {focus && <FocusBar focus={focus} scrolled={scrolled} />}
            {tabs && (
              <header className={styles.bar} data-scrolled={scrolled}>
                <div className={`${styles.barInner} ${styles.barTabs}`}>
                  <Link
                    href="/patient-dashboard"
                    className={styles.brand}
                    aria-label="inrange, home"
                  >
                    <Wordmark height={34} />
                  </Link>
                  <nav className={styles.tabs} aria-label="Sections">
                    {SECTIONS.map((section) => (
                      <Link
                        key={section.id}
                        href={section.href}
                        className={styles.tab}
                        aria-current={
                          section.id === current ? "page" : undefined
                        }
                      >
                        {section.label}
                      </Link>
                    ))}
                  </nav>
                  {/* the bar's third column keeps the sections centred */}
                  <div className={styles.barEnd} />
                </div>
              </header>
            )}

            {!online && (
              <p className={styles.offline} role="status">
                You are offline. Check your connection.
              </p>
            )}

            {children}

            {tabs && (
              <nav className={styles.dock} aria-label="Sections">
                {SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const on = section.id === current;
                  return (
                    <Link
                      key={section.id}
                      href={section.href}
                      className={styles.dockTab}
                      aria-current={on ? "page" : undefined}
                    >
                      <Icon size={22} weight={on ? "fill" : "regular"} />
                      <span>{section.label}</span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        </ToastProvider>
      </ShellFocusContext.Provider>
    </AppTheme>
  );
}
