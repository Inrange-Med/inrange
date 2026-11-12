"use client";

/*
  The doctor's messages (Arhaan's clinician Messages): one chat per patient. Urgent chats come
  first, then whoever has waited longest, then the rest by latest message. A laptop shows the list
  and the open chat side by side, always with one open; a phone shows one at a time. The open chat
  is kept in the address (?p=<patientId>) so other screens can link straight to it.
*/

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ErrorNotice from "@/components/ui/ErrorNotice";
import ClinicSkeleton from "@/app/doctor-dashboard/components/ClinicSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { errorMessage } from "@/lib/http/apiClient";
import { listMyPatients } from "@/services/doctorPortalService";
import {
  listMyChatSessions,
  markNoReplyNeeded,
  undoNoReplyNeeded,
} from "@/services/doctorChatService";
import { listPatientSnapshots } from "@/services/patientRecordService";
import type { DoctorChatSession } from "@/types/chat";
import ThreadList, { type ThreadFilter } from "./ThreadList";
import ThreadPane from "./ThreadPane";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "../MessagesPage.module.css";

const LAPTOP = "(min-width: 1024px)";

function byNeed(a: DoctorChatSession, b: DoctorChatSession) {
  if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
  if (!!a.waitingSince !== !!b.waitingSince) return a.waitingSince ? -1 : 1;
  if (a.waitingSince && b.waitingSince)
    return a.waitingSince.localeCompare(b.waitingSince);
  return (b.lastMessage?.sentAt ?? "").localeCompare(
    a.lastMessage?.sentAt ?? "",
  );
}

export default function MessagesView() {
  const toast = useToast();
  const params = useSearchParams();
  const [now] = useState(() => Date.now());
  const sessions = useApiResource("doctor-chat-sessions", listMyChatSessions);
  const patients = useApiResource("doctor-patients", listMyPatients);
  const snapshots = useApiResource(
    "doctor-patient-snapshots",
    listPatientSnapshots,
  );
  const [show, setShow] = useState<ThreadFilter>("you");
  const [open, setOpen] = useState<string | null>(() => params.get("p"));
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(LAPTOP);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const sorted = useMemo(
    () => [...(sessions.data ?? [])].sort(byNeed),
    [sessions.data],
  );
  const needs = sorted.filter((session) => session.waitingSince);
  const list = show === "you" ? needs : sorted;
  const current =
    sorted.find((session) => session.patientId === open) ??
    (wide ? (list[0] ?? sorted[0]) : undefined);

  if (sessions.error && !sessions.data) {
    return (
      <main className={clinicStyles.page}>
        {/* the page keeps its heading when the chats fail to load */}
        <div className={styles.listHead}>
          <h1 className={clinicStyles.h1}>Messages</h1>
          <p className={clinicStyles.sub}>Every patient chat in one place.</p>
        </div>
        <ErrorNotice message={sessions.error} onRetry={sessions.reload} />
      </main>
    );
  }
  if (sessions.loading && !sessions.data) {
    return (
      <main className={clinicStyles.page}>
        <ClinicSkeleton />
      </main>
    );
  }

  const choose = (patientId: string | null) => {
    setOpen(patientId);
    const url = new URL(window.location.href);
    if (patientId) url.searchParams.set("p", patientId);
    else url.searchParams.delete("p");
    window.history.replaceState(null, "", url.pathname + url.search);
  };

  const setAside = async (session: DoctorChatSession) => {
    try {
      await markNoReplyNeeded(session.sessionId);
      sessions.reload();
      toast(`${session.patientName.split(" ")[0]}'s messages set aside`, () => {
        undoNoReplyNeeded(session.sessionId)
          .then(sessions.reload)
          .catch((caught) => toast(errorMessage(caught)));
      });
    } catch (caught) {
      toast(errorMessage(caught));
    }
  };

  const snapshotOf = (patientId: string) =>
    snapshots.data?.find((snapshot) => snapshot.patientId === patientId);

  return (
    <main className={`${clinicStyles.page} ${styles.page}`}>
      <div
        className={styles.split}
        data-open={current && !wide ? "thread" : "list"}
      >
        <ThreadList
          sessions={sessions.data ? list : null}
          needsYou={needs.length}
          show={show}
          onShow={setShow}
          currentId={current?.sessionId}
          onChoose={(session) => choose(session.patientId)}
          snapshotOf={snapshotOf}
          now={now}
        />
        {current ? (
          <ThreadPane
            key={current.sessionId}
            session={current}
            patient={patients.data?.find(
              (patient) => patient.id === current.patientId,
            )}
            snapshot={snapshotOf(current.patientId)}
            now={now}
            onBack={() => choose(null)}
            onSetAside={() => setAside(current)}
          />
        ) : (
          <section className={styles.threadPane} aria-hidden="true" />
        )}
      </div>
    </main>
  );
}
