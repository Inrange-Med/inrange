"use client";

/*
  The "Help and support" sheet (Arhaan Profile.tsx Help): the emergency line first, the patient's
  appointments, two common questions, a message to support (POST /api/patient/support) and the way
  to the care team's chat.
*/

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CalendarBlank,
  CaretDown,
  CaretRight,
  ChatCircleText,
  Phone,
} from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import { useToast } from "@/components/ui/ToastProvider";
import { errorMessage } from "@/lib/http/apiClient";
import { contactSupport } from "@/services/patientProfileService";
import foldingStyles from "@/app/patient-dashboard/styles/FoldingSection.module.css";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import ProfileField from "./ProfileField";
import SaveButton from "./SaveButton";
import styles from "../ProfilePage.module.css";

/** The symptoms that never wait for the care team, said the same way as in the guides. */
const RED_FLAGS = "Chest pain, trouble breathing or severe tummy pain";

const FAQ = [
  {
    q: "How do I contact my care team?",
    a: "Tap Chat on Home, or Message your care team below or at the end of any guide. Your care team answers, and anything medical goes to your doctor.",
  },
  {
    q: "What if I miss a dose?",
    a: "For a tablet, skip the missed one and take the next at the usual time. Never take two together. For anything else, message your care team before taking it.",
  },
];

export default function HelpAndSupport() {
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (!subject.trim() || !message.trim()) return;
    setBusy(true);
    setSendError(null);
    try {
      await contactSupport(subject.trim(), message.trim());
      setSubject("");
      setMessage("");
      setTried(false);
      toast("Support request submitted.");
    } catch (error) {
      setSendError(errorMessage(error));
    }
    setBusy(false);
  };

  return (
    <div className={styles.acct}>
      <div className={styles.sos}>
        <p>
          {RED_FLAGS}: go to the nearest hospital. inrange is not an emergency
          service.
        </p>
        <a href="tel:112" className={styles.sosCall}>
          <Phone size={18} weight="fill" aria-hidden="true" />
          <span>
            Call <span className="num">112</span>
          </span>
        </a>
      </div>

      <ul className={styles.helpLinks}>
        <li>
          <Link href="/patient-dashboard/appointments" className={styles.row}>
            <span className={styles.rowIcon} aria-hidden="true">
              <CalendarBlank size={20} />
            </span>
            <span className={styles.rowText}>
              <strong>Your appointments</strong>
              <span>Visits and notes</span>
            </span>
            <CaretRight size={16} className={styles.rowGo} aria-hidden="true" />
          </Link>
        </li>
      </ul>

      <div className={styles.faq}>
        {FAQ.map((item) => (
          <details key={item.q} className={foldingStyles.section}>
            <summary>
              {item.q}
              <CaretDown
                size={16}
                className={foldingStyles.caret}
                aria-hidden="true"
              />
            </summary>
            <div className={foldingStyles.sectionBody}>
              <p>{item.a}</p>
            </div>
          </details>
        ))}
      </div>

      <section className={styles.acctGroup} aria-labelledby="support-heading">
        <h3 id="support-heading" className={styles.subHead}>
          Write to support
        </h3>
        <form className={styles.form} onSubmit={submit} noValidate>
          <ProfileField
            label="Subject"
            value={subject}
            onValueChange={setSubject}
            placeholder="How can we help?"
            error={tried && !subject.trim() ? "Add a subject." : ""}
          />
          <label className={formStyles.field}>
            <span className={formStyles.label}>Message</span>
            <textarea
              className={`${formStyles.input} ${styles.message}`}
              rows={4}
              value={message}
              placeholder="Describe your issue"
              aria-invalid={tried && !message.trim()}
              onChange={(event) => setMessage(event.target.value)}
            />
            {tried && !message.trim() && (
              <span className={formStyles.hint} role="alert">
                Add a message.
              </span>
            )}
          </label>
          {sendError && <ErrorNotice message={sendError} />}
          <SaveButton
            busy={busy}
            label="Send message"
            busyLabel="Sending"
            quiet
          />
        </form>
      </section>

      <div className={styles.chat}>
        <Link
          href="/patient-dashboard/messages"
          className={`btn ${formStyles.go}`}
        >
          <span>Message your care team</span>
          <span className="well" aria-hidden="true">
            <ChatCircleText size={18} />
          </span>
        </Link>
      </div>
    </div>
  );
}
