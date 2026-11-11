"use client";

/**
 * The consultation room for both roles. Before joining: a camera and microphone check, then Join,
 * which asks the backend for the 100ms room (GET /api/video/appointments/:id/join) and embeds it
 * full screen. Leave goes back to the person's home (the doctor's Today, the patient's Home); a
 * doctor can also end the consultation for everyone (POST /api/video/appointments/:id/end),
 * confirmed in a sheet. Signed out, it sends the person to sign in and back here; a failed join and the
 * ended call each offer a way out.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhoneDisconnect, SignOut } from "@phosphor-icons/react";
import {
  endVideoConsultation,
  joinVideoConsultation,
} from "@/services/videoConsultationService";
import type { VideoRoom } from "@/types/appointment";
import { errorMessage } from "@/lib/http/apiClient";
import { useSessionUser } from "@/hooks/useSessionUser";
import { signInHrefFor } from "@/lib/navigation/signInReturn";
import { homePathFor } from "@/lib/session/authSession";
import Wordmark from "@/components/ui/Wordmark";
import ErrorNotice from "@/components/ui/ErrorNotice";
import PreJoin from "./PreJoin";
import EndConsultationSheet from "./EndConsultationSheet";
import CallEnded from "./CallEnded";
import styles from "./ConsultationRoom.module.css";

type Stage =
  | { name: "before" }
  | { name: "live"; room: VideoRoom }
  | { name: "ended" };

export default function ConsultationRoom({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const router = useRouter();
  const { status } = useSessionUser();
  const isDoctor = status === "DOCTOR";
  const signedOut = status === "OUT";
  const signInHref = signInHrefFor(`/consultation/${appointmentId}`);
  const [stage, setStage] = useState<Stage>({ name: "before" });
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [loadedLink, setLoadedLink] = useState<string | null>(null);
  const home = homePathFor(isDoctor ? "DOCTOR" : "PATIENT");
  // each dashboard's first section: the doctor's Today, the patient's Home
  const homeLabel = isDoctor ? "Today" : "Home";

  // signed out: sign in, then come straight back to this call (replace, so Back skips the guard)
  useEffect(() => {
    if (signedOut) router.replace(signInHref);
  }, [signedOut, signInHref, router]);

  const join = async () => {
    setJoining(true);
    setJoinError(null);
    try {
      setStage({
        name: "live",
        room: await joinVideoConsultation(appointmentId),
      });
    } catch (caught) {
      setJoinError(errorMessage(caught));
    } finally {
      setJoining(false);
    }
  };

  const endForEveryone = async () => {
    await endVideoConsultation(appointmentId);
    setConfirmingEnd(false);
    setStage({ name: "ended" });
  };

  const live = stage.name === "live";

  return (
    <main className={styles.room} data-live={live}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Wordmark height={23} />
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.headerTitle}>Consultation</span>
        </div>
        {live && (
          <div className={styles.headerActions}>
            {stage.room.role === "doctor" && (
              <button
                type="button"
                className={styles.endButton}
                onClick={() => setConfirmingEnd(true)}
              >
                <PhoneDisconnect size={18} aria-hidden="true" /> End
                consultation
              </button>
            )}
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => router.push(home)}
            >
              <SignOut size={18} aria-hidden="true" /> Leave
            </button>
          </div>
        )}
      </header>

      {signedOut && (
        <div className={styles.prejoin}>
          <h1 className="sr-only">Sign in to join your consultation</h1>
          <ErrorNotice message="Sign in to join your consultation." />
          <Link href={signInHref} className={styles.secondaryButton}>
            Sign in
          </Link>
        </div>
      )}

      {status && !signedOut && stage.name === "before" && (
        <PreJoin
          seenBy={isDoctor ? "your patient" : "your doctor"}
          joining={joining}
          error={joinError}
          home={home}
          onJoin={join}
        />
      )}

      {live && (
        <div className={styles.stage}>
          {loadedLink !== stage.room.joinLink && (
            <p className={styles.frameWait} role="status">
              Opening the video room. This can take a few seconds.
            </p>
          )}
          <iframe
            className={styles.frame}
            title="Video consultation"
            src={stage.room.joinLink}
            onLoad={() => setLoadedLink(stage.room.joinLink)}
            allow="camera; microphone; display-capture; autoplay; fullscreen; clipboard-write"
          />
        </div>
      )}

      {stage.name === "ended" && (
        <CallEnded home={home} homeLabel={homeLabel} />
      )}

      <EndConsultationSheet
        open={confirmingEnd}
        onClose={() => setConfirmingEnd(false)}
        onEnd={endForEveryone}
      />
    </main>
  );
}
