/** The consultation chat: its messages, and the doctor's list of patient chats. */

export type ChatRole = "PATIENT" | "DOCTOR";

/** One consultation chat message. */
export type ChatMessage = {
  /** the server's id, used to skip repeats */
  id?: number;
  sessionId: number;
  senderUserId: number;
  senderRole: ChatRole;
  messageType: "TEXT" | "FILE";
  messageText: string;
  fileUrl: string | null;
  sentAt: string; // ISO; the client stamps it if the server does not
};

/** One patient's chat with the signed-in doctor, as the doctor's Messages list shows it. */
export type DoctorChatSession = {
  sessionId: number;
  patientId: string;
  patientName: string;
  lastMessage: {
    text: string;
    fromDoctor: boolean;
    sentAt: string;
    hasFile: boolean;
  } | null;
  /** the patient's messages since the doctor last replied, if any: they need the doctor */
  waitingSince: string | null;
  /** the backend found urgent words in a waiting message */
  urgent: boolean;
  /** a message arrived after the doctor last opened the chat */
  unread: boolean;
};
