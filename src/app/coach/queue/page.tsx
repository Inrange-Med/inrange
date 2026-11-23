/* /coach/queue: the coach's tasks (who needs a call about their medicines), for their own patients. */

import type { Metadata } from "next";
import CoachQueueView from "../components/CoachQueueView";

export const metadata: Metadata = { title: "Queue | inrange" };

export default function CoachQueuePage() {
  return <CoachQueueView />;
}
