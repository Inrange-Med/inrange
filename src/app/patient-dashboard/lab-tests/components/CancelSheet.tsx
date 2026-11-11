"use client";

/**
 * Cancelling a booked home test, confirmed in a sheet. Redcliffe asks for a reason; an empty one is
 * sent as the backend's default. Not possible once a collector is assigned.
 */

import { useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import Sheet from "@/components/ui/Sheet";
import { errorMessage } from "@/lib/http/apiClient";
import { cancelLabBooking } from "@/services/labTestService";
import type { LabBooking } from "@/types/labTest";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import { collectionWindow } from "./labBookingFormat";
import styles from "../LabTestsPage.module.css";

export default function CancelSheet({
  booking,
  open,
  onClose,
  onCancelled,
}: {
  booking: LabBooking;
  open: boolean;
  onClose: () => void;
  onCancelled: (updated: LabBooking) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onCancelled(await cancelLabBooking(booking.id, reason.trim()));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Cancel this test">
      <div className={styles.actions}>
        <p className={styles.text}>
          {booking.packageName},{" "}
          <span className="num">{collectionWindow(booking)}</span>.
        </p>
        <label className={formStyles.field}>
          <span className={formStyles.label}>Reason (optional)</span>
          <input
            className={formStyles.input}
            value={reason}
            maxLength={200}
            onChange={(event) => setReason(event.target.value)}
            placeholder="For example, I will be away"
          />
        </label>
        {error && <ErrorNotice message={error} />}
        {/* keeping it comes first; cancelling is a plain solid pill, never the forward arrow
            (Arhaan Appointments test cancel) */}
        <div className={styles.pillRow}>
          <button
            type="button"
            className={`btn btn--ghost ${styles.pillSm} ${styles.confirmPill}`}
            onClick={onClose}
          >
            Keep it
          </button>
          <button
            type="button"
            className={`btn ${styles.pillSm} ${styles.confirmPill}`}
            onClick={cancel}
            data-busy={busy}
            aria-busy={busy}
          >
            {busy && <i className={formStyles.spin} aria-hidden="true" />}
            <span>{busy ? "Cancelling" : "Cancel the test"}</span>
          </button>
        </div>
      </div>
    </Sheet>
  );
}
