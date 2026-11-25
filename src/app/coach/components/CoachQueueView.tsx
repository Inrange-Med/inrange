"use client";

/*
  /coach/queue: the tasks the medicine flow opens for a coach's own patients (a missed dose, a supply
  running out, a question), soonest due first. The same queue admin works, scoped by the API to this coach.
  A task's patient opens on the Patients page.
*/

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHead from "@/components/ui/PageHead";
import TasksPanel from "@/features/medicine-queue/TasksPanel";
import { useNow } from "@/hooks/useNow";
import surfaceStyles from "@/components/ui/styles/StaffSurfaces.module.css";

export default function CoachQueueView() {
  const router = useRouter();
  const now = useNow(60_000);
  const [version, setVersion] = useState(0);
  return (
    <main className={surfaceStyles.page}>
      <PageHead
        className={surfaceStyles.pageHead}
        title="Queue"
        sub="Patients who need a call."
      />
      <TasksPanel
        now={now}
        version={version}
        onOpenPatient={(id) => router.push(`/coach?patient=${id}`)}
        onChanged={() => setVersion((v) => v + 1)}
      />
    </main>
  );
}
