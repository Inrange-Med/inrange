"use client";

/*
  One consultation, laid out on the plate (doctor portal v2 PRD): when, who, its state in one sentence and
  the one thing to press. The name opens the consultation page. Used by Today ("Do this now" and the day)
  and History. Join opens the call in its own tab; Send sends the PDF the doctor made, no "are you sure"
  (they saw it when they created it); View PDF opens the sent prescription. Only start times show.
*/

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import FileOpenButton from "@/components/ui/FileOpenButton";
import { useToast } from "@/components/ui/ToastProvider";
import { openCallTab } from "@/lib/consultations/callTab";
import { clockTime } from "@/lib/format/dateTime";
import { errorMessage } from "@/lib/http/apiClient";
import { sendPrescription } from "@/services/consultationService";
import { getFile } from "@/services/fileService";
import type { ConsultationRow as Row } from "@/types/consultation";
import {
  ACTION_LABEL,
  ACTION_OF,
  consultationHref,
  factsLine,
  statusWords,
  whenWords,
} from "./consultationWords";
import styles from "./ConsultationRow.module.css";

/** The <ol> class a list of rows takes: hairlines between rows, none above the first. */
export const consultationListClass = styles.list;

export default function ConsultationRow({
  row,
  withDay = false,
  lead = false,
  onChanged,
}: {
  row: Row;
  /** "Yesterday 6:30 pm" instead of the time alone (Do this now, History) */
  withDay?: boolean;
  /** the first thing to do: a filled button (and the open call's second one) */
  lead?: boolean;
  onChanged?: () => void;
}) {
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const action = ACTION_OF[row.state];
  const href = consultationHref(row.id);
  const filled = lead || row.state === "CALL_OPEN";
  const buttonClass = `btn ${filled ? "" : "btn--ghost"} ${styles.act}`;

  const send = async () => {
    if (sending) return;
    setSending(true);
    try {
      const sent = await sendPrescription(row.id);
      toast(`Sent to patient, ${clockTime(new Date(sent.sentAt ?? Date.now()))}`);
      onChanged?.();
    } catch (caught) {
      toast(errorMessage(caught, "The prescription was not sent. Try again."));
    } finally {
      setSending(false);
    }
  };

  const arrow = filled ? (
    <span className="well" aria-hidden="true">
      <ArrowRight size={16} />
    </span>
  ) : null;

  return (
    <div className={styles.row} data-state={row.state}>
      <span className={`${styles.when} num`}>
        {withDay ? whenWords(row.startsAt) : clockTime(new Date(row.startsAt))}
      </span>
      <span className={styles.who}>
        <Link href={href} className={styles.name}>
          {row.patientName}
        </Link>
        <span className={styles.facts}>{factsLine(row)}</span>
        <span className={styles.status} data-state={row.state}>
          {statusWords(row)}
        </span>
      </span>
      <span className={styles.actions}>
        {action === "JOIN" && (
          <>
            <button
              type="button"
              className={buttonClass}
              onClick={() => openCallTab(row.id)}
            >
              <span>{ACTION_LABEL.JOIN}</span>
              {arrow}
            </button>
            {lead && (
              <Link href={href} className={`btn btn--ghost ${styles.act}`}>
                {ACTION_LABEL.WRITE}
              </Link>
            )}
          </>
        )}
        {(action === "OPEN" || action === "WRITE") && (
          <Link href={href} className={buttonClass}>
            <span>{ACTION_LABEL[action]}</span>
            {arrow}
          </Link>
        )}
        {action === "SEND" && (
          <button
            type="button"
            className={buttonClass}
            onClick={send}
            data-busy={sending}
            aria-busy={sending}
          >
            <span>{sending ? "Sending" : ACTION_LABEL.SEND}</span>
            {arrow}
          </button>
        )}
        {action === "VIEW_PDF" && row.pdf && (
          <FileOpenButton
            load={() => getFile(row.pdf ?? "")}
            className={buttonClass}
          >
            {(opening) => <span>{opening ? "Opening" : ACTION_LABEL.VIEW_PDF}</span>}
          </FileOpenButton>
        )}
      </span>
    </div>
  );
}
