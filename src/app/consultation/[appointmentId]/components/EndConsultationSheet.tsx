"use client";

/** The doctor's "End this consultation?" confirmation: it ends the call for both people. */

import { useState } from "react";
import { PhoneDisconnect } from "@phosphor-icons/react";
import { errorMessage } from "@/lib/http/apiClient";
import Sheet from "@/components/ui/Sheet";
import ErrorNotice from "@/components/ui/ErrorNotice";
import styles from "./ConsultationRoom.module.css";

export default function EndConsultationSheet({
  open,
  onClose,
  onEnd,
}: {
  open: boolean;
  onClose: () => void;
  onEnd: () => Promise<void>;
}) {
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const end = async () => {
    setEnding(true);
    setError(null);
    try {
      await onEnd();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setEnding(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="End this consultation?"
      size="compact"
    >
      <div className={styles.confirmSymbol} aria-hidden="true">
        <PhoneDisconnect size={25} />
      </div>
      <p className={styles.confirmText}>
        The call ends for you and your patient.
      </p>
      {error && <ErrorNotice message={error} />}
      <div className={styles.confirmActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onClose}
        >
          Stay on call
        </button>
        <button
          type="button"
          className={styles.confirmEnd}
          onClick={end}
          disabled={ending}
          aria-busy={ending}
        >
          {ending ? "Ending" : "End call"}
        </button>
      </div>
    </Sheet>
  );
}
