/* /patient-dashboard/messages: a conversation with each care-team doctor (MessagesView). */

import type { Metadata } from "next";
import MessagesView from "./components/MessagesView";

export const metadata: Metadata = { title: "Messages | InRange" };

export default function MessagesPage() {
  return <MessagesView />;
}
