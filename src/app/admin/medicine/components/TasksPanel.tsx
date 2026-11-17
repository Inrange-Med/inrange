"use client";

/*
  The queue: open tasks soonest due first (an overdue one says by how much, in the alert colour), the
  person's own filter, and the done ones folded away below. A row opens the task sheet.
*/

import { useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useApiResource } from "@/hooks/useApiResource";
import { useSessionUser } from "@/hooks/useSessionUser";
import { listTasks } from "@/services/medicineOpsService";
import type { OpsTask } from "@/types/medicineOps";
import TaskSheet from "./TaskSheet";
import { dueWords, KIND_WORDS, OUTCOME_WORDS, when } from "./words";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";
import s from "./Medicine.module.css";

function TaskRow({
  task,
  now,
  onOpen,
}: {
  task: OpsTask;
  now: number;
  onOpen: () => void;
}) {
  const due = dueWords(task.dueAt, now);
  return (
    <li>
      <div className={s.row}>
        <button type="button" className={s.open} onClick={onOpen}>
          <span className={s.what}>
            {task.status === "OPEN" && task.priority === "CRITICAL" && (
              <span className={s.urgent}>Urgent</span>
            )}
            {task.title}
          </span>
          <span className={s.sub}>
            {task.patientName && <span>{task.patientName}</span>}
            <span>{KIND_WORDS[task.kind]}</span>
            {task.orderNumber && (
              <span className="num">{task.orderNumber}</span>
            )}
          </span>
        </button>
        <span className={s.side}>
          {task.status === "OPEN" ? (
            <>
              {task.assignedName && (
                <span className={adminStyles.muted}>{task.assignedName}</span>
              )}
              <span className={`${s.due} num`} data-late={due.late}>
                {due.text}
              </span>
            </>
          ) : (
            <span className={adminStyles.muted}>
              {task.outcome ? OUTCOME_WORDS[task.outcome] : "Done"}
              {task.doneAt ? `, ${when(task.doneAt)}` : ""}
            </span>
          )}
        </span>
      </div>
    </li>
  );
}

export default function TasksPanel({
  now,
  version,
  onOpenPatient,
  onChanged,
}: {
  now: number;
  /** bumped by the page after a change anywhere (a sheet here or the patient sheet), so the lists reload */
  version: number;
  onOpenPatient: (id: string) => void;
  onChanged: () => void;
}) {
  const open = useApiResource(`medicine-tasks-open-${version}`, () =>
    listTasks("OPEN"),
  );
  const done = useApiResource(`medicine-tasks-done-${version}`, () =>
    listTasks("DONE"),
  );
  const { user } = useSessionUser();
  const [who, setWho] = useState<"all" | "mine">("all");
  const [openTask, setOpenTask] = useState<OpsTask | null>(null);

  const mine = (open.data ?? []).filter(
    (t) => t.assignedTo === String(user?.userId),
  );
  const shown = who === "mine" ? mine : (open.data ?? []);

  return (
    <div className={s.stack}>
      <section className={adminStyles.panel} aria-labelledby="queue-h">
        <div className={`${adminStyles.panelHead} ${s.headWrap}`}>
          <h2 id="queue-h" className={adminStyles.h2}>
            To do
          </h2>
          {/* shown while chosen too, so finishing the last of one's own tasks never strands the filter */}
          {(mine.length > 0 || who === "mine") && (
            <span className={s.seg}>
              <SegmentedControl
                label="Whose tasks"
                value={who}
                options={[
                  { value: "all", label: "Everyone" },
                  {
                    value: "mine",
                    label: (
                      <>
                        Mine <span className="num">{mine.length}</span>
                      </>
                    ),
                  },
                ]}
                onChange={setWho}
              />
            </span>
          )}
        </div>
        {open.error && !open.data ? (
          <ErrorNotice message={open.error} onRetry={open.reload} />
        ) : !open.data ? (
          <LoadingSkeleton />
        ) : shown.length === 0 ? (
          <p className={adminStyles.empty}>
            {who === "mine"
              ? "Nothing assigned to you."
              : "Nothing to do. Calls, delivery checks and dose alerts appear here as they come up, soonest due first."}
          </p>
        ) : (
          <ul className={s.rows}>
            {shown.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                now={now}
                onOpen={() => setOpenTask(task)}
              />
            ))}
          </ul>
        )}
      </section>

      {(done.data?.length ?? 0) > 0 && (
        <section className={adminStyles.panel} aria-labelledby="done-h">
          <div className={adminStyles.panelHead}>
            <h2 id="done-h" className={adminStyles.h2}>
              Done
            </h2>
            <span className={`${adminStyles.count} num`}>
              {done.data!.length}
            </span>
          </div>
          <details className={adminStyles.history}>
            <summary className="num">Show {done.data!.length} done</summary>
            <ul className={s.rows}>
              {done.data!.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  now={now}
                  onOpen={() => setOpenTask(task)}
                />
              ))}
            </ul>
          </details>
        </section>
      )}

      <TaskSheet
        task={openTask}
        now={now}
        onClose={() => setOpenTask(null)}
        onOpenPatient={(id) => {
          setOpenTask(null);
          onOpenPatient(id);
        }}
        onChanged={onChanged}
      />
    </div>
  );
}
