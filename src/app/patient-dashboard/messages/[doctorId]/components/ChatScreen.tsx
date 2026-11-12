"use client";

/**
 * The chat with one doctor (the design's Chat.tsx). Starts or resumes the session
 * (POST /api/chat/init), loads earlier messages (PROPOSED GET /api/chat/sessions/:id/messages), then
 * sends and receives over the chat socket. The sender's id and role come from the signed-in session.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Phone } from "@phosphor-icons/react";
import { loadCareTeamDoctors } from "@/app/patient-dashboard/components/careTeamDoctors";
import Avatar from "@/components/ui/Avatar";
import { useApiResource } from "@/hooks/useApiResource";
import { getSessionUser } from "@/lib/session/authSession";
import {
  connectToChatSession,
  listChatHistory,
  startChatSession,
  uniqueMessages,
} from "@/services/chatService";
import type { ChatMessage } from "@/types/chat";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import ChatComposer from "./ChatComposer";
import ChatThread from "./ChatThread";
import styles from "./ChatScreen.module.css";

type Connection = ReturnType<typeof connectToChatSession>;

/** The symptoms that never wait for a reply: said the same way on every screen. */
const RED_FLAGS = "Chest pain, trouble breathing or severe tummy pain";

export default function ChatScreen({ doctorId }: { doctorId: string }) {
  const [user] = useState(getSessionUser);
  const [now] = useState(() => Date.now());
  const team = useApiResource("care-team", loadCareTeamDoctors);
  const session = useApiResource(`chat-session-${doctorId}`, () =>
    startChatSession(Number(doctorId)),
  );
  const sessionId = session.data;
  const history = useApiResource(
    sessionId ? `chat-history-${sessionId}` : null,
    () => listChatHistory(sessionId ?? 0),
  );
  const [live, setLive] = useState<ChatMessage[]>([]);
  const [socketError, setSocketError] = useState<string | null>(null);
  const connection = useRef<Connection | null>(null);

  const doctor = team.data?.find((member) => member.doctorId === doctorId);
  const doctorName = doctor?.name ?? "Your doctor";
  // while the care team loads, the bar holds soft placeholders instead of a stand-in person
  const teamWaiting = team.loading && !team.data;
  const messages = uniqueMessages([...(history.data ?? []), ...live]);
  const isMine = (message: ChatMessage) => message.senderRole === user?.role;

  useEffect(() => {
    if (!sessionId) return;
    const opened = connectToChatSession(sessionId, {
      onMessage: (message) => setLive((current) => [...current, message]),
      onError: setSocketError,
    });
    connection.current = opened;
    return () => {
      opened.close();
      connection.current = null;
    };
  }, [sessionId]);

  // follow new messages only when the reader is already at the bottom; otherwise offer a way down
  const scroller = useRef<HTMLDivElement>(null);
  const atEnd = useRef(true);
  const [newBelow, setNewBelow] = useState(false);
  const toEnd = () => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  useLayoutEffect(() => {
    if (atEnd.current) toEnd();
    else setNewBelow(true);
  }, [messages.length]);
  // the thread shrinks when the composer grows (more lines, the 112 warning), or its content grows
  // (a notice, a longer intro): a reader at the end stays at the end
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (atEnd.current) toEnd();
    });
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);

  // keep the composer above the on-screen keyboard: iOS keeps the layout viewport tall and scrolls it
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    if (!viewport) return;
    const fit = () => {
      root.style.setProperty("--chat-h", `${viewport.height}px`);
      root.toggleAttribute(
        "data-kb",
        viewport.height < window.innerHeight - 120,
      );
      if (viewport.offsetTop) window.scrollTo(0, 0);
      if (atEnd.current) toEnd();
    };
    fit();
    viewport.addEventListener("resize", fit);
    viewport.addEventListener("scroll", fit);
    return () => {
      viewport.removeEventListener("resize", fit);
      viewport.removeEventListener("scroll", fit);
      root.style.removeProperty("--chat-h");
      root.removeAttribute("data-kb");
    };
  }, []);

  const send = (text: string) => {
    if (!connection.current || !user?.userId) return;
    atEnd.current = true;
    setSocketError(null);
    connection.current.send({
      senderUserId: user.userId,
      senderRole: "PATIENT", // PatientShell lets only patients reach this screen
      messageType: "TEXT",
      messageText: text,
      fileUrl: null,
    });
  };

  return (
    <main className={styles.chat}>
      <header className={styles.bar}>
        <Link
          href="/patient-dashboard/messages"
          className={`${formStyles.round} ${styles.back}`}
          aria-label="Back to messages"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className={styles.who}>
          <span className={styles.faces} aria-hidden="true">
            {teamWaiting ? (
              <span className={styles.ghostFace} />
            ) : (
              <Avatar name={doctorName} src={doctor?.photoUrl} size={30} />
            )}
          </span>
          <span className={styles.whoText}>
            <h1 className={styles.title}>
              {teamWaiting ? (
                <span className={styles.ghostTitle}>
                  <span className="sr-only">Loading</span>
                </span>
              ) : (
                doctorName
              )}
            </h1>
            {doctor?.specialization && (
              <span className={styles.sub}>{doctor.specialization}</span>
            )}
          </span>
        </div>
      </header>

      <div
        ref={scroller}
        className={styles.thread}
        role="log"
        aria-live="polite"
        aria-label={`Messages with ${doctorName}`}
        onScroll={(event) => {
          const el = event.currentTarget;
          atEnd.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          if (atEnd.current && newBelow) setNewBelow(false);
        }}
      >
        <div className={styles.inner}>
          <aside className={styles.intro}>
            <p>Messages here go to {doctorName}.</p>
            {history.data === null && !history.loading && sessionId && (
              <p className={styles.introQuiet}>
                Earlier messages are not shown here yet.
              </p>
            )}
            <p className={styles.introQuiet}>
              <Phone size={14} aria-hidden="true" />
              Not for emergencies. {RED_FLAGS}: call <a href="tel:112">112</a>.
            </p>
          </aside>

          <ChatThread
            messages={messages}
            isMine={isMine}
            other={{
              name: doctorName,
              role: "Your doctor",
              photoUrl: doctor?.photoUrl ?? null,
            }}
            now={now}
          />

          {[session.error, history.error, socketError]
            .filter(Boolean)
            .map((message) => (
              <p key={message} className={styles.notice} role="alert">
                <span>{message}</span>
              </p>
            ))}
        </div>
      </div>

      <ChatComposer
        disabled={!sessionId || !user?.userId}
        placeholder={`Message ${doctorName}`}
        showNewBelow={newBelow}
        onJumpDown={() => {
          atEnd.current = true;
          setNewBelow(false);
          toEnd();
        }}
        onSend={send}
      />
    </main>
  );
}
