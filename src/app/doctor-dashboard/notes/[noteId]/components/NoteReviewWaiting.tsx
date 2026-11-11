/*
  The call note before it has loaded, and when it cannot. Below a laptop the note is a pushed screen,
  so these states bring the same top bar (Back only, to the same place) and the shell's bars never
  flash in and out. While loading, the page shows the note's own frame breathing, so nothing jumps
  when the note fills it.
*/

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import type { BackDestination } from "@/lib/navigation/backDestination";
import conversationStyles from "@/app/doctor-dashboard/styles/ClinicConversations.module.css";
import sectionStyles from "./NoteSections.module.css";
import styles from "../NoteReviewPage.module.css";

/** The phone's top bar with Back alone (a laptop shows the page's own back link instead). */
export function PhoneBackBar({ back }: { back: BackDestination }) {
  return (
    <div className={`${styles.topBar} ${styles.topBarBare}`}>
      <Link
        href={back.href}
        className={conversationStyles.back}
        aria-label={`Back to ${back.label}`}
      >
        <ArrowLeft size={18} />
      </Link>
    </div>
  );
}

/** The note's frame as placeholders: the back link, the header and three sections. */
export function NoteReviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className={styles.backLink} aria-hidden="true">
        <span className={`${styles.ghost} ${styles.ghostBack}`} />
      </div>
      <div className={styles.grid} aria-hidden="true">
        <div className={styles.note}>
          <div className={styles.head}>
            <div className={styles.who}>
              <span className={`${styles.ghost} ${styles.ghostFace}`} />
              <span className={`${styles.ghost} ${styles.ghostTitle}`} />
            </div>
            <div className={`${styles.safety} ${styles.ghostSafety}`}>
              <div />
              <div />
            </div>
          </div>
          {[0, 1, 2].map((band) => (
            <div key={band} className={sectionStyles.sec}>
              <div className={sectionStyles.skel}>
                <span style={{ width: "92%" }} />
                <span style={{ width: "80%" }} />
                <span style={{ width: "64%" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
