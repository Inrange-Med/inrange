/** Before joining: the camera and microphone check, then Join the call (or back home). */

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
}: {
  seenBy: string;
  joining: boolean;
  error: string | null;
  home: string;
  onJoin: () => void;
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
        <DeviceCheck seenBy={seenBy} />
      </section>
      {error && <ErrorNotice message={error} onRetry={onJoin} />}
      <button
        type="button"
        className={`btn ${formStyles.go}`}
        onClick={onJoin}
        disabled={joining}
        data-busy={joining}
        aria-busy={joining}
      >
        <span>{joining ? "Joining" : "Join the call"}</span>
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
