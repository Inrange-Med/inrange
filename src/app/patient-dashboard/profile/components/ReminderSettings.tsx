"use client";

/*
  The "Reminders" sheet (Arhaan AccountSheet.tsx ReminderSettings): switches that save as they are
  flipped, through PATCH /api/patient/reminders. The channel switches only apply while reminders
  are on. A failed save puts the switch back and says why. While a save runs, its knob dims.
*/

import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { errorMessage } from "@/lib/http/apiClient";
import { updateReminderSettings } from "@/services/patientProfileService";
import type { PatientProfile } from "@/types/patientProfile";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "../ProfilePage.module.css";

type Settings = Pick<
  PatientProfile,
  "remindersEnabled" | "whatsappReminders" | "emailReminders"
>;

const SWITCHES: { key: keyof Settings; label: string }[] = [
  { key: "remindersEnabled", label: "Enable reminders" },
  { key: "whatsappReminders", label: "WhatsApp reminders" },
  { key: "emailReminders", label: "Email reminders" },
];

export default function ReminderSettings({
  profile,
  onSaved,
}: {
  profile: PatientProfile;
  onSaved: (changes: Partial<PatientProfile>) => void;
}) {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings>({
    remindersEnabled: profile.remindersEnabled,
    whatsappReminders: profile.whatsappReminders,
    emailReminders: profile.emailReminders,
  });
  // the switches whose save is still running, for the row's busy look only
  const [saving, setSaving] = useState<ReadonlySet<keyof Settings>>(
    () => new Set(),
  );
  const markSaving = (key: keyof Settings, on: boolean) =>
    setSaving((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const flip = async (key: keyof Settings) => {
    const before = settings;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    markSaving(key, true);
    try {
      await updateReminderSettings(next);
      onSaved(next);
    } catch (error) {
      setSettings(before);
      toast(errorMessage(error));
    } finally {
      markSaving(key, false);
    }
  };

  return (
    <div className={styles.acct}>
      <section className={styles.acctGroup} aria-labelledby="reminders-heading">
        <h3 id="reminders-heading" className={styles.subHead}>
          Remind me
        </h3>
        <ul className={styles.toggles}>
          {SWITCHES.map((item) => (
            <li key={item.key}>
              <label
                className={styles.toggleRow}
                data-busy={saving.has(item.key) || undefined}
              >
                <span>
                  <strong>{item.label}</strong>
                </span>
                <span className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={settings[item.key]}
                    disabled={
                      item.key !== "remindersEnabled" &&
                      !settings.remindersEnabled
                    }
                    onChange={() => flip(item.key)}
                  />
                  <i aria-hidden="true" />
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className={formStyles.hint}>
          Nobody from inrange will ever ask you for a one-time code.
        </p>
      </section>
    </div>
  );
}
