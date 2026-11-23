"use client";

/*
  Prescriptions (Home's first row, and where WhatsApp's "See the prescription" lands with ?rx=): the
  current one first, its medicines in plain words, View (the PDF) with Download beside it; the ones it
  replaced below, quieter, to read only: a new prescription makes the old one invalid, so it is never
  handed out again (19 Nov 2026 call). Data: GET /api/care/prescriptions (patientHomeService); the PDF comes through
  the signed-in file route, so no link leaves the app.
*/

import { useEffect, useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import FileOpenButton from "@/components/ui/FileOpenButton";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { shortDate } from "@/lib/format/dateTime";
import { errorMessage } from "@/lib/http/apiClient";
import { medicineLineWords } from "@/lib/format/medicineLine";
import { getFile } from "@/services/fileService";
import { listMyPrescriptions } from "@/services/patientHomeService";
import type { PatientPrescription } from "@/types/patientHome";
import PageGhosts from "@/app/patient-dashboard/components/PageGhosts";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import styles from "./PrescriptionsView.module.css";

const HOME = { href: "/patient-dashboard", label: "Home" };
const year = (iso: string) => new Date(iso).getFullYear();

function DownloadButton({ rx }: { rx: PatientPrescription & { pdf: string } }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`btn btn--ghost ${styles.action}`}
      data-busy={busy}
      aria-busy={busy}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          const url = URL.createObjectURL(await getFile(rx.pdf));
          const a = document.createElement("a");
          a.href = url;
          a.download = `inrange-prescription-${shortDate(rx.sentAt).replace(" ", "-")}-${year(rx.sentAt)}.pdf`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (caught) {
          toast(errorMessage(caught, "The PDF did not download. Try again."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <DownloadSimple size={18} aria-hidden="true" />
      {busy ? "Downloading" : "Download"}
    </button>
  );
}

export default function PrescriptionsView() {
  const list = useApiResource("my-prescriptions", listMyPrescriptions);
  const [linked, setLinked] = useState<string | null>(null);
  useEffect(() => {
    // the WhatsApp link (?rx=) points at one prescription: it is marked and scrolled to
    const rx = new URLSearchParams(window.location.search).get("rx");
    if (!rx || !list.data) return;
    setLinked(rx); // eslint-disable-line react-hooks/set-state-in-effect -- read once from the address
    document.getElementById(`rx-${rx}`)?.scrollIntoView({ block: "start" });
  }, [list.data]);

  return (
    <main className={`${layoutStyles.page} ${styles.page}`}>
      <PageHead title="Prescriptions" back={HOME} />
      {list.error && !list.data ? (
        <ErrorNotice message={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <PageGhosts heights={[220, 120]} />
      ) : list.data.length === 0 ? (
        <p className={styles.empty}>
          Your prescription appears here after your video call with the doctor.
          It also comes to you on WhatsApp.
        </p>
      ) : (
        <ol className={styles.list}>
          {list.data.map((rx) => (
            <li
              key={rx.id}
              id={`rx-${rx.id}`}
              className={styles.card}
              data-current={rx.current}
              data-linked={linked === rx.id || undefined}
            >
              <div className={styles.head}>
                <h2 className={styles.h2}>
                  {rx.current
                    ? "Your prescription"
                    : `Replaced, from ${shortDate(rx.sentAt)} ${year(rx.sentAt)}`}
                </h2>
                <p className={`${styles.meta} num`}>
                  {rx.doctorName}
                  {rx.doctorQualification &&
                    `, ${rx.doctorQualification}`}. {shortDate(rx.sentAt)}{" "}
                  {year(rx.sentAt)}
                  {rx.current &&
                    rx.validUntil &&
                    `. Valid until ${shortDate(rx.validUntil)}`}
                </p>
              </div>
              {rx.medicines.length > 0 ? (
                <ul className={styles.medicines}>
                  {rx.medicines.map((m, i) => (
                    <li key={`${m.key}-${i}`}>
                      <strong>{m.name}</strong>
                      <span>{medicineLineWords(m)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.meta}>
                  Advice from your doctor, no medicines.
                </p>
              )}
              {rx.pdf ? (
                <div className={styles.actions}>
                  <FileOpenButton
                    load={() => getFile(rx.pdf!)}
                    className={`btn ${styles.action}`}
                  >
                    {(opening) => (
                      <span>{opening ? "Opening" : "View prescription"}</span>
                    )}
                  </FileOpenButton>
                  <DownloadButton rx={{ ...rx, pdf: rx.pdf }} />
                </div>
              ) : (
                // a new prescription makes the old one invalid: it stays to read, and is never handed out again
                <p className={styles.meta}>
                  A newer prescription replaced this one, so it can no longer be
                  used or downloaded.
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
