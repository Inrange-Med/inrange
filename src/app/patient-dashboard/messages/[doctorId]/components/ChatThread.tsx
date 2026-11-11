/**
 * The messages in a chat, grouped the way people read them: a day label when the day changes, and
 * one turn per sender (the name on the first bubble, the face beside the last).
 */

import { Fragment } from "react";
import Avatar from "@/components/ui/Avatar";
import { clockTime, weekdayDayMonth } from "@/lib/format/dateTime";
import type { ChatMessage } from "@/types/chat";
import styles from "./ChatScreen.module.css";

const GROUP_GAP_MS = 10 * 6e4;
const DAY_MS = 864e5;
const sameDay = (a: number, b: number) =>
  new Date(a).toDateString() === new Date(b).toDateString();

function dayLabel(at: number, now: number) {
  if (sameDay(at, now)) return "Today";
  if (sameDay(at, now - DAY_MS)) return "Yesterday";
  return weekdayDayMonth.format(at);
}

export default function ChatThread({
  messages,
  isMine,
  other,
  now,
}: {
  messages: ChatMessage[];
  isMine: (message: ChatMessage) => boolean;
  other: { name: string; role: string; photoUrl: string | null };
  now: number;
}) {
  return messages.map((message, i) => {
    const at = new Date(message.sentAt).getTime();
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const prevAt = prev ? new Date(prev.sentAt).getTime() : 0;
    const nextAt = next ? new Date(next.sentAt).getTime() : 0;
    const mine = isMine(message);
    const newDay = !prev || !sameDay(prevAt, at);
    const opens = newDay || isMine(prev) !== mine || at - prevAt > GROUP_GAP_MS;
    const closes =
      !next ||
      isMine(next) !== mine ||
      nextAt - at > GROUP_GAP_MS ||
      !sameDay(nextAt, at);
    return (
      // stable keys (as uniqueMessages dedupes), so rows never remount and replay their arrival
      <Fragment
        key={
          message.id != null
            ? `id:${message.id}`
            : `${message.senderUserId}:${message.sentAt}:${message.messageText}`
        }
      >
        {newDay && <p className={styles.day}>{dayLabel(at, now)}</p>}
        <div
          className={styles.row}
          data-me={mine}
          data-opens={opens}
          data-closes={closes}
        >
          {!mine && (
            <span className={styles.face}>
              {closes && (
                <Avatar name={other.name} src={other.photoUrl} size={28} />
              )}
            </span>
          )}
          <div className={styles.stack}>
            {!mine && opens && (
              <p className={styles.name}>
                {other.name} <span>{other.role}</span>
              </p>
            )}
            <div className={styles.bubble}>
              <p>
                {message.messageText}
                <span className={styles.time}>{clockTime(new Date(at))}</span>
              </p>
            </div>
          </div>
        </div>
      </Fragment>
    );
  });
}
