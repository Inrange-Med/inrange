"use client";

/*
  /admin/medicine: the care team's one place for medicine work (PRD 9.1).
    Sales     every lead, end to end, as each salesperson sees their own (features/sales/LeadsBoard)
    Queue     tasks the follow-up, deliveries and doses open, soonest due first; each opens with its
              patient, what happened, and the outcome to record
    Orders    the pharmacy's deliveries by step, one next step per row (admin)
    Patients  everyone: last order, run-out, doses, coach; the plans, the sales team and the coaches
    To call   who is stuck and needs a call: no blood test, a test to rebook, no consultation, no plan, no coach
    Calls     the consultations coming up with their video links, and who is due a follow-up
    Payments  every payment link and who paid, and payments that matched no link
    Messages  every WhatsApp message, sent or not, and why (admin)
    Numbers   the PRD's measures against their targets (admin)
  An admin has every tab. Someone on the operations team (role OPS) has the tabs of their desks only: blood
  tests (To call, Patients), consultations (To call, Calls, Patients), the pharmacy (Queue, Orders, Patients);
  the API checks the same. The tab is in the address (?tab=), so a link and Back land on the same view.
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
import LeadsBoard from "@/features/sales/LeadsBoard";
import type { Desk } from "@/lib/session/authSession";
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
  | "sales"
  | "queue"
  | "orders"
  | "patients"
  | "tocall"
  | "calls"
  | "payments"
  | "messages"
  | "numbers";
const TABS: Tab[] = [
  "tocall",
  "sales",
  "patients",
  "calls",
  "payments",
  "queue",
  "orders",
  "messages",
  "numbers",
];
/** What each desk of the operations team works with; an admin has every tab. */
const DESK_TABS: Record<Desk, Tab[]> = {
  BLOOD_TESTS: ["tocall", "patients"],
  CONSULTATIONS: ["tocall", "calls", "patients"],
  MEDICINE: ["queue", "orders", "patients"],
};

export default function MedicineView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const summary = useApiResource("medicine-summary", getSummary);
  const now = useNow(60_000);
  const [patientId, setPatientId] = useState<string | null>(null);
  // bumped by any change in a sheet, so every panel's list reloads with the counts
  const [version, setVersion] = useState(0);

  // AdminShell lets in an admin and the operations team; a coach works in /coach, a salesperson in /sales
  const { status, user } = useSessionUser();
  const role = status === "ADMIN" || status === "OPS" ? status : null;
  // the desks as the API has them now (a change by admin shows without a new sign-in); the stored copy until it answers
  const desks =
    status === "OPS" ? (summary.data?.desks ?? user?.desks ?? []) : [];
  const works = (desk: Desk) => status === "ADMIN" || desks.includes(desk);
  const tabs =
    status === "ADMIN"
      ? TABS
      : TABS.filter((t) => desks.some((desk) => DESK_TABS[desk].includes(t)));
  const asked = params.get("tab") as Tab | null;
  const first = tabs[0] ?? "patients";
  const tab: Tab = asked && tabs.includes(asked) ? asked : first;

  const go = (next: Tab) =>
    router.replace(next === first ? pathname : `${pathname}?tab=${next}`, {
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
    sales: "Sales",
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
        title="Operations"
        sub={
          status === "OPS"
            ? "Your team's work: who to call, what to book, and what is coming up."
            : "Everything around a patient: who to call, every lead and sale, the consultations coming up, who has paid, and what to pack and dispatch."
        }
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

      {works("MEDICINE") && tab === "queue" && (
        <TasksPanel
          now={now}
          version={version}
          onOpenPatient={setPatientId}
          onChanged={changed}
        />
      )}
      {role === "ADMIN" && tab === "sales" && (
        <LeadsBoard admin onChanged={changed} />
      )}
      {works("MEDICINE") && tab === "orders" && (
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
      {role && tab === "tocall" && (
        <ToCallPanel
          version={version}
          admin={status === "ADMIN"}
          lab={works("BLOOD_TESTS")}
          dc={works("CONSULTATIONS")}
          onOpenPatient={setPatientId}
        />
      )}
      {works("CONSULTATIONS") && tab === "calls" && (
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
        lab={works("BLOOD_TESTS")}
        consults={works("CONSULTATIONS")}
        mock={summary.data?.messages.whatsapp === "mock"}
        onClose={() => {
          setPatientId(null);
          if (params.get("patient"))
            router.replace(
              tab === first ? pathname : `${pathname}?tab=${tab}`,
              { scroll: false },
            );
        }}
        onChanged={changed}
      />
    </main>
  );
}
