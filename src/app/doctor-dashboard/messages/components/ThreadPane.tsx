"use client";

/*
  One open chat (Arhaan's ThreadPane): who the patient is, their messages and the doctor's replies
  (ThreadMessages), and the reply box (ReplyComposer). Earlier messages come from the history
  endpoint; new ones arrive on the consultation chat socket (the server echoes each sent message
  back, so a reply appears once it is delivered). A reply can also close the patient's flagged
  symptom as "Advised by message".
*/

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import Avatar from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { errorMessage } from "@/lib/http/apiClient";
import { getSessionUser } from "@/lib/session/authSession";
import {
  connectToChatSession,
  listChatHistory,
  uniqueMessages,
} from "@/services/chatService";
import { markChatRead } from "@/services/doctorChatService";
import {
  acknowledgeSymptom,
  getPatientRecord,
  undoSymptomAcknowledgement,
} from "@/services/patientRecordService";
import type { ChatMessage, DoctorChatSession } from "@/types/chat";
import type { DoctorPatient } from "@/types/doctor";
import type { PatientSnapshot, Symptom } from "@/types/patientRecord";
import ReplyComposer from "./ReplyComposer";
import ThreadMessages from "./ThreadMessages";
import conversationStyles from "@/app/doctor-dashboard/styles/ClinicConversations.module.css";
import styles from "../MessagesPage.module.css";

type Connection = ReturnType<typeof connectToChatSession>;

function sexLetter(sex: string) {
  if (/^f/i.test(sex)) return "F";
  if (/^m/i.test(sex)) return "M";
  return "";
}

export default function ThreadPane({
  session,
  patient,
  snapshot,
  now,
  onBack,
  onSetAside,
}: {
  session: DoctorChatSession;
  patient?: DoctorPatient;
  snapshot?: PatientSnapshot;
  now: number;
  onBack: () => void;
  onSetAside: () => void;
}) {
  const toast = useToast();
  const [user] = useState(getSessionUser);
  const history = useApiResource(`chat-history-${session.sessionId}`, () =>
    listChatHistory(session.sessionId),
  );
  const record = useApiResource(`record-${session.patientId}`, () =>
    getPatientRecord(session.patientId),
  );
  const [live, setLive] = useState<ChatMessage[]>([]);
  const [socketError, setSocketError] = useState<string | null>(null);
  const connection = useRef<Connection | null>(null);

  const messages = uniqueMessages([...(history.data ?? []), ...live]);
  const symptom = record.data?.symptoms.find(
    (entry) => entry.requiresReview && !entry.acknowledged,
  );
  const firstName = session.patientName.split(" ")[0];

  useEffect(() => {
    const opened = connectToChatSession(session.sessionId, {
      onMessage: (message) => setLive((current) => [...current, message]),
      onError: setSocketError,
    });
    connection.current = opened;
    // reading the chat clears its "new" dot; a failure here only leaves the dot on
    markChatRead(session.sessionId).catch(() => undefined);
    return () => {
      opened.close();
      connection.current = null;
    };
  }, [session.sessionId]);

  const acknowledgeByMessage = async (advised: Symptom) => {
    try {
      await acknowledgeSymptom(
        session.patientId,
        advised.id,
        "Advised by message",
      );
      record.reload();
      toast(`Sent. ${advised.label} marked as advised by message`, () => {
        undoSymptomAcknowledgement(session.patientId, advised.id)
          .then(record.reload)
          .catch((caught) => toast(errorMessage(caught)));
      });
    } catch (caught) {
      toast(errorMessage(caught));
    }
  };

  const send = (text: string, acknowledge: boolean) => {
    if (!connection.current || !user?.userId) return false;
    setSocketError(null);
    connection.current.send({
      senderUserId: user.userId,
      senderRole: "DOCTOR",
      messageType: "TEXT",
      messageText: text,
      fileUrl: null,
    });
    if (symptom && acknowledge) acknowledgeByMessage(symptom);
    return true;
  };

  const who = patient
    ? [
        [patient.age, sexLetter(patient.sex)].filter(Boolean).join(" "),
        snapshot
          ? snapshot.careWeek
            ? `week ${snapshot.careWeek}`
            : snapshot.programme
          : "",
        snapshot?.conditions.slice(0, 2).join(", "),
      ]
    : [];

  return (
    <section
      className={styles.threadPane}
      aria-label={`Messages with ${session.patientName}`}
    >
      <header className={styles.threadHead}>
        <button
          type="button"
          className={conversationStyles.back}
          aria-label="Back to messages"
          onClick={onBack}
        >
          <ArrowLeft size={18} />
        </button>
        <Avatar name={session.patientName} size={36} />
        <div className={styles.threadWho}>
          <strong>{session.patientName}</strong>
          <span>{who.filter(Boolean).join(" · ") || "Patient"}</span>
        </div>
        <Link
          href={`/doctor-dashboard/patients/${session.patientId}?from=messages`}
          className={`btn btn--ghost ${styles.record}`}
        >
          Open record
        </Link>
      </header>

      <ThreadMessages
        messages={messages}
        historyError={history.error}
        historyMissing={history.data === null}
        onRetryHistory={history.reload}
        firstName={firstName}
        waitingSince={
          session.waitingSince ? Date.parse(session.waitingSince) : null
        }
        urgent={session.urgent}
        now={now}
      />

      <ReplyComposer
        patientName={session.patientName}
        firstName={firstName}
        doctorName={user?.fullName || null}
        symptom={symptom}
        socketError={socketError}
        canSetAside={!!session.waitingSince}
        onSend={send}
        onSetAside={onSetAside}
      />
    </section>
  );
}
