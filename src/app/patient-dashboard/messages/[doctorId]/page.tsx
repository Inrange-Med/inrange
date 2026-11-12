/**
 * The chat with one doctor, /patient-dashboard/messages/[doctorId]. The screen is a client component;
 * this server page only reads the doctor's id from the URL.
 */

import type { Metadata } from "next";
import ChatScreen from "./components/ChatScreen";

export const metadata: Metadata = { title: "Chat | inrange" };

export default async function ChatPage({
  params,
}: {
  params: Promise<{ doctorId: string }>;
}) {
  const { doctorId } = await params;
  return <ChatScreen doctorId={doctorId} />;
}
