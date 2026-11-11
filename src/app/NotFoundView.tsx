"use client";

/**
 * The app-wide 404 screen (rendered by not-found.tsx): shown for any address the app does not have. It says plainly that the page
 * does not exist, shows the address that was asked for, and offers the right way out: a signed-in
 * doctor or patient goes to their dashboard, anyone else to the homepage. Dashboard design kit.
 */

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import AppTheme from "@/components/ui/AppTheme";
import ContourField from "@/components/ui/ContourField";
import Wordmark from "@/components/ui/Wordmark";
import { useSignedInHome } from "@/hooks/useSignedInHome";
import styles from "./NotFoundView.module.css";

const subscribeToNothing = () => () => {};

/** True when there is a page to go back to in this tab; false on the server. */
function useHasHistory() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => window.history.length > 1,
    () => false,
  );
}

/** The address asked for. Empty on the server: the 404 page is prerendered once for every address. */
function useRequestedPath() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => window.location.pathname,
    () => "",
  );
}

export default function NotFoundView() {
  const router = useRouter();
  const pathname = useRequestedPath();
  const signedInHome = useSignedInHome();
  const hasHistory = useHasHistory();
  const shownPath =
    pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;

  return (
    <AppTheme>
      <main className={styles.page}>
        <ContourField
          className={styles.field}
          density={10}
          lineAlpha={0.12}
          signalAlpha={0.5}
        />
        <Link href="/" className={styles.brand} aria-label="inrange home">
          <Wordmark />
        </Link>

        <section className={styles.panel} aria-labelledby="not-found-title">
          <p className={styles.code}>Error 404</p>
          <h1 id="not-found-title" className={styles.title}>
            There is no page at this address.
          </h1>
          <code className={styles.path}>{shownPath}</code>
          <p className={styles.lede}>
            The link may be mistyped or out of date.
          </p>
          <div className={styles.actions}>
            <Link href={signedInHome ?? "/"} className="btn btn--signal">
              <span>
                {signedInHome ? "Go to my account" : "Go to the homepage"}
              </span>
              <span className="well" aria-hidden="true">
                <ArrowRight size={18} />
              </span>
            </Link>
            {hasHistory && (
              <button
                type="button"
                className={`btn btn--ghost-dark ${styles.back}`}
                onClick={() => router.back()}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span>Go back</span>
              </button>
            )}
          </div>
        </section>
      </main>
    </AppTheme>
  );
}
