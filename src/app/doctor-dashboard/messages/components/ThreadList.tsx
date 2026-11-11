/*
  The doctor's list of patient chats (Arhaan's Messages list pane): "Needs you" holds only chats
  where the patient is waiting on the doctor; "All" holds every chat. Each row shows the last
  message, how long the patient has waited, and their care week or programme.
*/

import {
  ChatsCircle,
  Check,
  Paperclip,
  WarningCircle,
} from "@phosphor-icons/react";
import Avatar from "@/components/ui/Avatar";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { clockTime, shortDate } from "@/lib/format/dateTime";
import type { DoctorChatSession } from "@/types/chat";
import type { PatientSnapshot } from "@/types/patientRecord";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import conversationStyles from "@/app/doctor-dashboard/styles/ClinicConversations.module.css";
import styles from "../MessagesPage.module.css";

export type ThreadFilter = "you" | "all";

const sameDay = (a: number, b: number) =>
  new Date(a).toDateString() === new Date(b).toDateString();

function when(iso: string, now: number) {
  const at = Date.parse(iso);
  if (sameDay(at, now)) return clockTime(new Date(at));
  if (sameDay(at, now - 864e5)) return "Yesterday";
  return shortDate(iso);
}

function waited(iso: string, now: number) {
  const minutes = Math.max(1, Math.round((now - Date.parse(iso)) / 6e4));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h` : `${Math.round(hours / 24)} d`;
}

export default function ThreadList({
  sessions,
  needsYou,
  show,
  onShow,
  currentId,
  onChoose,
  snapshotOf,
  now,
}: {
  /** null while the backend has no list of the doctor's chats */
  sessions: DoctorChatSession[] | null;
  needsYou: number;
  show: ThreadFilter;
  onShow: (value: ThreadFilter) => void;
  currentId?: number;
  onChoose: (session: DoctorChatSession) => void;
  snapshotOf: (patientId: string) => PatientSnapshot | undefined;
  now: number;
}) {
  return (
    <section className={styles.listPane} aria-labelledby="messages-heading">
      <div className={styles.listHead}>
        <h1 id="messages-heading" className={clinicStyles.h1}>
          Messages
        </h1>
        <p className={clinicStyles.sub}>Every patient chat in one place.</p>
        {sessions && (
          <SegmentedControl
            label="Show"
            value={show}
            onChange={onShow}
            options={[
              {
                value: "you",
                label: (
                  <>
                    Needs you<span className="num">&nbsp;{needsYou}</span>
                  </>
                ),
              },
              { value: "all", label: "All" },
            ]}
          />
        )}
      </div>
      {sessions === null ? (
        <div className={conversationStyles.empty}>
          <ChatsCircle size={22} aria-hidden="true" />
          <p>Your patient chats are not available here yet.</p>
        </div>
      ) : sessions.length ? (
        <ul className={styles.list}>
          {sessions.map((session) => {
            const last = session.lastMessage;
            const snapshot = snapshotOf(session.patientId);
            const care = snapshot
              ? snapshot.careWeek
                ? `Week ${snapshot.careWeek}`
                : snapshot.programme
              : "";
            return (
              <li key={session.sessionId}>
                <button
                  type="button"
                  className={conversationStyles.item}
                  aria-current={
                    currentId === session.sessionId ? "true" : undefined
                  }
                  data-new={session.unread}
                  onClick={() => onChoose(session)}
                >
                  <Avatar name={session.patientName} size={40} />
                  <span className={conversationStyles.itemText}>
                    <span className={conversationStyles.itemTop}>
                      <strong>{session.patientName}</strong>
                      {last && (
                        <span className={`${conversationStyles.itemWhen} num`}>
                          {when(last.sentAt, now)}
                        </span>
                      )}
                    </span>
                    <span className={conversationStyles.snippet}>
                      {last?.hasFile && (
                        <Paperclip size={14} aria-hidden="true" />
                      )}
                      <span>
                        {last
                          ? `${last.fromDoctor ? "You: " : ""}${last.text || (last.hasFile ? "Attachment" : "")}`
                          : "No messages yet"}
                      </span>
                    </span>
                    {(session.waitingSince || care) && (
                      <span className={conversationStyles.tags}>
                        {session.urgent && (
                          <span
                            className={conversationStyles.tag}
                            data-kind="urgent"
                          >
                            <WarningCircle
                              size={13}
                              weight="fill"
                              aria-hidden="true"
                            />{" "}
                            Urgent
                          </span>
                        )}
                        {session.waitingSince && !session.urgent && (
                          <span
                            className={conversationStyles.tag}
                            data-kind="you"
                          >
                            For you, {waited(session.waitingSince, now)}
                          </span>
                        )}
                        {care && (
                          <span className={conversationStyles.tagQuiet}>
                            {care}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  {session.unread && (
                    <i className={conversationStyles.dot} aria-label="New" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : show === "you" ? (
        <div className={conversationStyles.empty}>
          <Check size={22} aria-hidden="true" />
          <p>Nothing needs you.</p>
          <button
            type="button"
            className={conversationStyles.linkBtn}
            onClick={() => onShow("all")}
          >
            See all messages
          </button>
        </div>
      ) : (
        <div className={conversationStyles.empty}>
          <ChatsCircle size={22} aria-hidden="true" />
          <p>No patient has written yet.</p>
        </div>
      )}
    </section>
  );
}
