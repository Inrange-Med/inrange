/**
 * Before joining: the camera and microphone check, then Join the call (or back home). The patient is also
 * asked, each call, whether it may be recorded (19 Nov 2026 call: only if the patient is ready for it): one
 * box, not ticked, on the screen they are already on. Not ticked, nothing is recorded.
 */

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import DeviceCheck from "@/components/ui/DeviceCheck";
import ErrorNotice from "@/components/ui/ErrorNotice";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import surfaceStyles from "@/components/ui/styles/CardSurface.module.css";
import styles from "./ConsultationRoom.module.css";

export default function PreJoin({
  seenBy,
  joining,
  error,
  home,
  onJoin,
  record,
  onRecord,
}: {
  seenBy: string;
  joining: boolean;
  error: string | null;
  home: string;
  onJoin: () => void;
  /** the patient's choice about recording; undefined for the doctor, who is not asked */
  record?: boolean;
  onRecord?: (yes: boolean) => void;
}) {
  return (
    <div className={styles.prejoin}>
      <h1 className="sr-only">Join your consultation</h1>
      <section
        className={`${surfaceStyles.card} ${styles.prejoinCard}`}
        aria-labelledby="prejoin-check-title"
      >
        <h2 id="prejoin-check-title" className={styles.prejoinTitle}>
          Camera and microphone
        </h2>
        <DeviceCheck seenBy={seenBy} quiet />
      </section>
      {record !== undefined && (
        <label className={styles.recordChoice}>
          <input
            type="checkbox"
            checked={record}
            onChange={(event) => onRecord?.(event.target.checked)}
          />
          <span>
            <strong>Record this call</strong>
            <span>Only your care team can watch it. It is your choice.</span>
          </span>
        </label>
      )}
      {error && <ErrorNotice message={error} onRetry={onJoin} />}
      <button
        type="button"
        className={`btn ${formStyles.go}`}
        onClick={onJoin}
        data-busy={joining}
        aria-busy={joining}
      >
        <span>{joining ? "Joining" : "Join now"}</span>
        <span className="well" aria-hidden="true">
          {joining ? (
            <i className={formStyles.spin} />
          ) : (
            <ArrowRight size={18} />
          )}
        </span>
      </button>
      <Link href={home} className={formStyles.link}>
        Not now
      </Link>
    </div>
  );
}
