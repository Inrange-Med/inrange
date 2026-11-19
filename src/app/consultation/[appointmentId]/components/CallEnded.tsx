/*
  After the call. The doctor's call runs in its own tab (doctor portal v2): the consultation page with the
  prescription is still open in the other one, so this tab says so and offers to close itself (a tab the
  app opened can close itself; one the doctor opened by hand cannot, so the consultation link stays).
  The patient goes back to Home, where the next step is "Your doctor is writing your prescription".
*/

import Link from "next/link";
import { Check } from "@phosphor-icons/react";
import styles from "./ConsultationRoom.module.css";

export default function CallEnded({
  home,
  homeLabel,
  doctorPage,
  left = false,
}: {
  home: string;
  homeLabel: string;
  /** the doctor's consultation page; set only for the doctor */
  doctorPage?: string;
  /** the doctor left without ending the call for everyone */
  left?: boolean;
}) {
  if (doctorPage) {
    return (
      <section className={styles.ended} aria-live="polite">
        <div className={styles.endedIcon}>
          <Check size={30} weight="light" />
        </div>
        <span className={styles.endedLabel}>
          {left ? "You left the call" : "Call ended"}
        </span>
        <h1>Finish the prescription in your other tab.</h1>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => window.close()}
        >
          Close this tab
        </button>
        <Link href={doctorPage} className={styles.quietLink}>
          Or open the consultation here
        </Link>
      </section>
    );
  }
  return (
    <section className={styles.ended} aria-live="polite">
      <div className={styles.endedIcon}>
        <Check size={30} weight="light" />
      </div>
      <span className={styles.endedLabel}>Consultation complete</span>
      <h1>The call has ended.</h1>
      <p>
        Your doctor is writing your prescription. It comes to you on WhatsApp
        and in the app.
      </p>
      <Link href={home} className={styles.secondaryButton}>
        Back to {homeLabel}
      </Link>
    </section>
  );
}
