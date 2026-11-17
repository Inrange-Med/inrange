"use client";

/*
  WhatsApp alerts: the doctor's own opt-in (GET and PUT /api/doctor/whatsapp). On, inrange messages
  their mobile when a consultation is booked or moved, when it is about to start and when the patient
  is waiting, each with a link that opens the video room; and when a note waits to be signed or a
  patient writes. No patient names or health details go to WhatsApp. Off by default.
*/

import { useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { spacedMobile } from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import {
  getWhatsAppAlerts,
  setWhatsAppAlerts,
} from "@/services/doctorPortalService";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "../HoursPage.module.css";

export default function WhatsAppAlertsCard() {
  const toast = useToast();
  const alerts = useApiResource("doctor-whatsapp", getWhatsAppAlerts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flip = async () => {
    if (busy || !alerts.data) return;
    const on = !alerts.data.on;
    setBusy(true);
    setError(null);
    try {
      await setWhatsAppAlerts(on);
      alerts.setData({ ...alerts.data, on });
      toast(on ? "WhatsApp alerts on" : "WhatsApp alerts off");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={clinicStyles.panel} aria-labelledby="whatsapp-h">
      <div className={clinicStyles.panelHead}>
        <h2 id="whatsapp-h" className={clinicStyles.h2}>
          WhatsApp alerts
        </h2>
      </div>
      {alerts.error && !alerts.data && (
        <ErrorNotice message={alerts.error} onRetry={alerts.reload} />
      )}
      {alerts.data && (
        <>
          <p className={styles.alertsLine}>
            {alerts.data.on ? "On for " : "Off. Turn on to get them on "}
            <strong className="num">+91 {spacedMobile(alerts.data.mobile)}</strong>
            {alerts.data.on ? "." : ""}
          </p>
          <p className={formStyles.hint}>
            A message when a consultation is booked or moved, when it is about
            to start and when your patient is waiting, with a link that opens
            the video call. Also when a call note waits for your signature or a
            patient writes to you. No patient names or health details are sent.
          </p>
          {error && (
            <p className={formStyles.err} role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className={`btn ${alerts.data.on ? "btn--ghost" : ""} ${styles.alertsBtn}`}
            aria-pressed={alerts.data.on}
            aria-busy={busy}
            data-busy={busy}
            disabled={busy}
            onClick={flip}
          >
            {alerts.data.on ? "Turn off" : "Turn on WhatsApp alerts"}
          </button>
        </>
      )}
    </section>
  );
}
