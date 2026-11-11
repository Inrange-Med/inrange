"use client";

/*
  The doctor's reply box under an open chat: quick replies, a box that grows to 180px, Cmd/Ctrl+Enter
  to send, and, when the patient has a flagged symptom, a box (ticked by default) to also close it
  as "Advised by message". The box empties once the reply is handed to the chat socket.
*/

import { useRef, useState } from "react";
import { ArrowUp } from "@phosphor-icons/react";
import Avatar from "@/components/ui/Avatar";
import ErrorNotice from "@/components/ui/ErrorNotice";
import { shortDate } from "@/lib/format/dateTime";
import type { Symptom } from "@/types/patientRecord";
import QuickReplies from "./QuickReplies";
import conversationStyles from "@/app/doctor-dashboard/styles/ClinicConversations.module.css";
import styles from "../MessagesPage.module.css";

const MAX_BOX_HEIGHT = 180;

export default function ReplyComposer({
  patientName,
  firstName,
  doctorName,
  symptom,
  socketError,
  canSetAside,
  onSend,
  onSetAside,
}: {
  patientName: string;
  firstName: string;
  doctorName: string | null;
  /** the patient's open flagged symptom, if any */
  symptom?: Symptom;
  socketError: string | null;
  /** the chat is waiting on the doctor, so it can be set aside without a reply */
  canSetAside: boolean;
  /** false when the reply could not be sent (no connection), so the box keeps it */
  onSend: (text: string, acknowledge: boolean) => boolean;
  onSetAside: () => void;
}) {
  const [text, setText] = useState("");
  const [acknowledge, setAcknowledge] = useState(true);
  const field = useRef<HTMLTextAreaElement>(null);

  const grow = () => {
    const element = field.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_BOX_HEIGHT)}px`;
  };

  const send = () => {
    if (!text.trim() || !onSend(text.trim(), acknowledge)) return;
    setText("");
    requestAnimationFrame(grow);
  };

  const pickQuickReply = (reply: string) => {
    setText(reply);
    requestAnimationFrame(() => {
      grow();
      field.current?.focus();
    });
  };

  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      {socketError && <ErrorNotice message={socketError} />}
      <QuickReplies onPick={pickQuickReply} />
      <div className={conversationStyles.box}>
        <label htmlFor="doctor-reply" className="sr-only">
          Reply to {patientName}
        </label>
        <textarea
          id="doctor-reply"
          ref={field}
          rows={2}
          value={text}
          placeholder={`Reply to ${firstName}`}
          onChange={(event) => {
            setText(event.target.value);
            grow();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              send();
            }
          }}
        />
        {symptom && (
          <label className={styles.ack}>
            <input
              type="checkbox"
              checked={acknowledge}
              onChange={(event) => setAcknowledge(event.target.checked)}
            />
            <span>
              Also mark {symptom.label.toLowerCase()} as advised by message
              <em>
                {" "}
                · flagged {shortDate(symptom.at)},{" "}
                {symptom.severity.toLowerCase()}
              </em>
            </span>
          </label>
        )}
        <div className={styles.boxFoot}>
          <span className={styles.as}>
            <Avatar name={doctorName || "Doctor"} size={20} /> As{" "}
            {doctorName || "you"}. Arrives in the app.
          </span>
          <span className={styles.actions}>
            {canSetAside && (
              <button
                type="button"
                className={conversationStyles.linkBtn}
                onClick={onSetAside}
              >
                No reply needed
              </button>
            )}
            <button
              type="submit"
              className={`btn ${styles.send}`}
              disabled={!text.trim()}
            >
              Send <ArrowUp size={15} weight="bold" aria-hidden="true" />
            </button>
          </span>
        </div>
      </div>
    </form>
  );
}
