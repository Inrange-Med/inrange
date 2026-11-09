/**
 * Consultation chat between a patient and their doctor (both dashboards).
 * Doc: docs/backend/consultations-and-care.md
 *   POST /api/chat/init                                     starts a session { doctorId } -> { sessionId }
 *   GET  /api/chat/sessions/:sessionId/messages?afterId=    messages, oldest first (only those after afterId) -> { data: ChatMessage[] }
 *   POST /api/chat/sessions/:sessionId/messages             sends one { messageType, messageText, fileUrl } -> { data: ChatMessage }
 * New messages arrive by polling every 3 seconds while the page is visible (connectToChatSession).
 * Screens merge history and live messages with uniqueMessages(), since both may carry the same one.
 */

import {
  ApiError,
  apiRequest,
  errorMessage,
  listFrom,
} from "@/lib/http/apiClient";
import type { ChatMessage } from "@/types/chat";

const POLL_MS = 3000;

/** The server may leave out sentAt; the arrival time stands in. */
const withSentAt = (message: ChatMessage): ChatMessage => ({
  ...message,
  sentAt: message.sentAt ?? new Date().toISOString(),
});

export async function startChatSession(doctorId: number): Promise<number> {
  const body = await apiRequest<{
    sessionId?: number;
    data?: { sessionId?: number };
  }>("/api/chat/init", { method: "POST", body: { doctorId } });
  const sessionId = body.sessionId ?? body.data?.sessionId;
  if (!sessionId) throw new Error("Chat could not start. Please try again.");
  return sessionId;
}

/** null while the backend does not offer it (404), so the chat can say so. */
export async function listChatHistory(
  sessionId: number,
): Promise<ChatMessage[] | null> {
  try {
    const body = await apiRequest(`/api/chat/sessions/${sessionId}/messages`);
    return listFrom<ChatMessage>(body, "messages").map(withSentAt);
  } catch (caught) {
    if (caught instanceof ApiError && caught.isMissingEndpoint) return null;
    throw caught;
  }
}

/** History and live messages without repeats (a message may arrive both ways). */
export function uniqueMessages(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    const key =
      message.id != null
        ? `id:${message.id}`
        : `${message.senderUserId}:${message.sentAt}:${message.messageText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** A live connection to one chat session (polling). Call close() when the screen unmounts. */
export function connectToChatSession(
  sessionId: number,
  handlers: {
    onMessage: (message: ChatMessage) => void;
    onError: (message: string) => void;
  },
) {
  let lastId = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  const seen = new Set<number>();

  const deliver = (message: ChatMessage) => {
    if (message.id != null) {
      if (seen.has(message.id)) return;
      seen.add(message.id);
      lastId = Math.max(lastId, message.id);
    }
    handlers.onMessage(withSentAt(message));
  };

  const poll = async () => {
    timer = null;
    if (closed) return;
    if (document.visibilityState === "visible") {
      try {
        const body = await apiRequest(
          `/api/chat/sessions/${sessionId}/messages`,
          {
            query: { afterId: lastId || undefined },
          },
        );
        if (!closed) listFrom<ChatMessage>(body, "messages").forEach(deliver);
      } catch {
        // a missed poll is retried on the next tick
      }
    }
    if (!closed) timer = setTimeout(poll, POLL_MS);
  };
  const onVisible = () => {
    if (document.visibilityState === "visible" && timer) {
      clearTimeout(timer);
      poll();
    }
  };
  document.addEventListener("visibilitychange", onVisible);
  poll();

  return {
    send: async (message: Omit<ChatMessage, "sessionId" | "sentAt">) => {
      try {
        const body = await apiRequest<{ data?: ChatMessage }>(
          `/api/chat/sessions/${sessionId}/messages`,
          {
            method: "POST",
            body: {
              messageType: message.messageType,
              messageText: message.messageText,
              fileUrl: message.fileUrl,
            },
          },
        );
        if (body.data && !closed) deliver(body.data);
      } catch (caught) {
        handlers.onError(errorMessage(caught, "The message was not sent."));
      }
    },
    close: () => {
      closed = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    },
  };
}
