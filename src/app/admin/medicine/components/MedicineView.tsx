"use client";

/*
  /admin/medicine: the care team's one place for medicine work (PRD 9.1).
    Queue     tasks the follow-up, deliveries and doses open, soonest due first; each opens with its
              patient, what happened, and the outcome to record
    Orders    the pharmacy's deliveries by step, one next step per row (admin)
    Patients  everyone: last order, run-out, doses, coach; the plans, the sales team and the coaches
    To call   who is stuck and needs a call: no blood test, a test to rebook, no consultation, no plan, no coach
    Calls     the consultations coming up with their video links, and who is due a follow-up
    Payments  every payment link and who paid, and payments that matched no link
    Messages  every WhatsApp message, sent or not, and why (admin)
    Numbers   the PRD's measures against their targets (admin)
  Admins only (AdminShell): a coach has their own panel at /coach. The tab is in the address (?tab=), so a
  link and Back land on the same view.
*/

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ErrorNotice from "@/components/ui/ErrorNotice";
import PageHead from "@/components/ui/PageHead";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useApiResource } from "@/hooks/useApiResource";
import { useNow } from "@/hooks/useNow";
import { useSessionUser } from "@/hooks/useSessionUser";
import { timeAgo } from "@/lib/format/dateTime";
import { getSummary } from "@/services/medicineOpsService";
import CallsPanel from "./CallsPanel";
import MessagesPanel from "./MessagesPanel";
import PaymentsPanel from "./PaymentsPanel";
import NumbersPanel from "./NumbersPanel";
import OrdersPanel from "./OrdersPanel";
import PatientSheet from "./PatientSheet";
import PatientsPanel from "./PatientsPanel";
import ToCallPanel from "./ToCallPanel";
import TasksPanel from "@/features/medicine-queue/TasksPanel";
import adminStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

type Tab =
  | "queue"
  | "orders"
  | "patients"
  | "tocall"
  | "calls"
  | "payments"
  | "messages"
  | "numbers";
const TABS: Tab[] = [
  "queue",
  "orders",
  "patients",
  "tocall",
  "calls",
  "payments",
  "messages",
  "numbers",
];

export default function MedicineView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const summary = useApiResource("medicine-summary", getSummary);
  const now = useNow(60_000);
  const [patientId, setPatientId] = useState<string | null>(null);
  // bumped by any change in a sheet, so every panel's list reloads with the counts
  const [version, setVersion] = useState(0);

  // AdminShell lets only an admin in; a coach works in /coach and a salesperson in /sales
  const { status } = useSessionUser();
  const role = status === "ADMIN" ? status : null;
  const tabs = TABS;
  const asked = params.get("tab") as Tab | null;
  const tab: Tab = asked && tabs.includes(asked) ? asked : "queue";

  const go = (next: Tab) =>
    router.replace(next === "queue" ? pathname : `${pathname}?tab=${next}`, {
      scroll: false,
    });

  // anything done in a sheet refreshes the counts and the panels' lists
  const { reload } = summary;
  const changed = useCallback(() => {
    reload();
    setVersion((current) => current + 1);
  }, [reload]);

  // a patient can be opened from a link (?patient=)
  useEffect(() => {
    const fromLink = params.get("patient");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of the address on arrival
    if (fromLink) setPatientId(fromLink);
  }, [params]);

  const t = summary.data?.tasks;
  const o = summary.data?.orders;
  const label = (text: string, n?: number) => (
    <>
      {text}
      {n ? <span className="num"> {n}</span> : null}
    </>
  );
  const LABELS: Record<Tab, React.ReactNode> = {
    queue: label("Queue", t?.open),
    orders: label("Orders", o?.toDispatch),
    patients: "Patients",
    tocall: "To call",
    calls: "Calls",
    payments: "Payments",
    messages: "Messages",
    numbers: "Numbers",
  };

  return (
    <main className={adminStyles.page}>
      <PageHead
        className={adminStyles.pageHead}
        title="Medicine"
        sub="Everything around a patient: who needs a call, what to pack and dispatch, the consultations coming up, who has paid, and what patients were told."
      />
      <div className={s.bar}>
        {role && (
          <div className={s.tabs}>
            <SegmentedControl
              label="Medicine views"
              value={tab}
              options={tabs.map((value) => ({ value, label: LABELS[value] }))}
              onChange={go}
            />
          </div>
        )}
        {summary.data && (
          <p className={s.status}>
            {summary.data.messages.whatsapp === "mock" && (
              <span className={adminStyles.pill} data-tone="new">
                WhatsApp in test mode
              </span>
            )}
            <span>
              {summary.data.lastTickAt
                ? `Checked ${timeAgo(summary.data.lastTickAt, now).toLowerCase()}`
                : "The scheduler has not run yet"}
            </span>
          </p>
        )}
      </div>
      {summary.error && (
        <ErrorNotice message={summary.error} onRetry={summary.reload} />
      )}

      {role && tab === "queue" && (
        <TasksPanel
          now={now}
          version={version}
          onOpenPatient={setPatientId}
          onChanged={changed}
        />
      )}
      {role === "ADMIN" && tab === "orders" && (
        <OrdersPanel
          now={now}
          version={version}
          onOpenPatient={setPatientId}
          onChanged={changed}
        />
      )}
      {role && tab === "patients" && (
        <PatientsPanel
          isAdmin={role === "ADMIN"}
          version={version}
          onOpenPatient={setPatientId}
          onChanged={changed}
        />
      )}
      {role === "ADMIN" && tab === "tocall" && (
        <ToCallPanel version={version} onOpenPatient={setPatientId} />
      )}
      {role === "ADMIN" && tab === "calls" && (
        <CallsPanel version={version} onOpenPatient={setPatientId} />
      )}
      {role === "ADMIN" && tab === "payments" && (
        <PaymentsPanel
          version={version}
          onOpenPatient={setPatientId}
          onChanged={changed}
        />
      )}
      {role === "ADMIN" && tab === "messages" && (
        <MessagesPanel
          version={version}
          now={now}
          mock={summary.data?.messages.whatsapp === "mock"}
          onOpenPatient={setPatientId}
        />
      )}
      {role === "ADMIN" && tab === "numbers" && <NumbersPanel />}

      <PatientSheet
        patientId={patientId}
        isAdmin={role === "ADMIN"}
        mock={summary.data?.messages.whatsapp === "mock"}
        onClose={() => {
          setPatientId(null);
          if (params.get("patient"))
            router.replace(
              tab === "queue" ? pathname : `${pathname}?tab=${tab}`,
              { scroll: false },
            );
        }}
        onChanged={changed}
      />
    </main>
  );
}
