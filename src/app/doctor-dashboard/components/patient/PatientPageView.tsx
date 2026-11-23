"use client";

/*
  The doctor's page for one patient (19 Nov 2026 call), the same page whether it is opened from a
  consultation (Today, History) or from the patient list:
  1. Who they are and the consultation, with Join video call (a new tab, so this page stays open).
  2. What the doctor needs first, at the top: age, height, weight, BMI, the diagnosis, allergies, the plan,
     who looks after them (health coach, fitness coach, salesperson, doctors) and the latest report.
  3. Three places, one tap each: Prescriptions (every one, with who sent it and when; only the current one
     opens as a PDF), Reports, Coach remarks.
  The prescription form does not open by itself: the doctor presses Write prescription (PrescriptionWriter).
  A prescription does not need a consultation, so the button is always there; the server says where it is
  written (`write`), the doctor never chooses. "Edit and send new version" corrects the current one; "New
  prescription" starts another from it.
  Data: GET /api/doctor/consultations/:id or GET /api/doctor/patients/:id/page (consultationService).
*/

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, VideoCamera } from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import FileOpenButton from "@/components/ui/FileOpenButton";
import PageHead from "@/components/ui/PageHead";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { useNow } from "@/hooks/useNow";
import { openCallTab } from "@/lib/consultations/callTab";
import { clockTime, shortDate } from "@/lib/format/dateTime";
import { medicineLineWords } from "@/lib/format/medicineLine";
import { errorMessage } from "@/lib/http/apiClient";
import {
  getConsultation,
  getPatientPage,
  revisePrescription,
  sendPrescriptionAgain,
} from "@/services/consultationService";
import { getFile } from "@/services/fileService";
import type {
  PatientPageData,
  Prescription,
  PrescriptionEntry,
  RxTarget,
} from "@/types/consultation";
import ClinicSkeleton from "@/app/doctor-dashboard/components/ClinicSkeleton";
import {
  factsLine,
  whenWords,
} from "@/app/doctor-dashboard/components/consultations/consultationWords";
import PrescriptionWriter from "./PrescriptionWriter";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "./PatientPage.module.css";

const TODAY = { href: "/doctor-dashboard", label: "Today" };
const PATIENTS = { href: "/doctor-dashboard/patients", label: "Patients" };

type Tab = "prescriptions" | "reports" | "remarks";
type Writing = { target: RxTarget; initial: Prescription | null; turn: number };

/** "20 Nov, 9:31 am", with the year when it is not this one. */
function dayAndTime(iso: string) {
  const at = new Date(iso);
  const year =
    at.getFullYear() === new Date().getFullYear() ? "" : ` ${at.getFullYear()}`;
  return `${shortDate(iso)}${year}, ${clockTime(at)}`;
}

export default function PatientPageView({
  appointmentId,
  patientId,
}: {
  /** opened from a consultation */
  appointmentId?: string;
  /** opened from the patient list */
  patientId?: string;
}) {
  const page = useApiResource(
    appointmentId ? `consultation-${appointmentId}` : `patient-${patientId}`,
    () =>
      appointmentId
        ? getConsultation(appointmentId)
        : getPatientPage(patientId ?? ""),
  );
  const back = appointmentId ? TODAY : PATIENTS;
  // "Write prescription" on Today asks for the form at once (?write=1)
  const writeAtOnce = useSearchParams().get("write") === "1";
  if (page.error && !page.data) {
    return (
      <main className={`${clinicStyles.page} ${styles.page}`}>
        <PageHead
          className={clinicStyles.pageHead}
          title="Patient"
          back={back}
        />
        <ErrorNotice message={page.error} onRetry={page.reload} />
      </main>
    );
  }
  if (!page.data) {
    return (
      <main className={`${clinicStyles.page} ${styles.page}`}>
        <ClinicSkeleton />
      </main>
    );
  }
  return (
    <Loaded
      key={appointmentId ?? patientId}
      data={page.data}
      reload={page.reload}
      back={back}
      writeAtOnce={writeAtOnce}
    />
  );
}

function PrescriptionCard({
  rx,
  busy,
  onAgain,
  onEdit,
}: {
  rx: PrescriptionEntry;
  busy: null | "again" | "edit";
  onAgain: () => void;
  onEdit: () => void;
}) {
  // beside each one: who sent it and when (the call: no separate log)
  const sentLine = `${rx.edited ? "Edited and sent by" : "Sent by"} ${rx.doctorName || "the doctor"}${rx.sentAt ? `, ${dayAndTime(rx.sentAt)}` : ""}`;
  const body = (
    <>
      {rx.diagnosis && (
        <p className={styles.rxLine}>
          <span>Diagnosis</span> {rx.diagnosis}
        </p>
      )}
      {rx.medicines.length > 0 ? (
        <ul className={styles.rxMeds}>
          {rx.medicines.map((m, i) => (
            <li key={`${m.key}-${i}`}>
              <strong>{m.name}</strong>
              <span>{medicineLineWords(m)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.rxLine}>Advice only, no medicines.</p>
      )}
      {rx.advice && (
        <p className={styles.rxLine}>
          <span>Advice</span> {rx.advice}
        </p>
      )}
      {rx.remarks && (
        <p className={styles.rxLine}>
          <span>Remarks</span> {rx.remarks}
        </p>
      )}
    </>
  );
  if (!rx.current)
    return (
      // a replaced prescription is read here; it has no PDF to open or hand out
      <details className={styles.rxOld}>
        <summary>
          <strong className="num">Version {rx.version}, replaced</strong>
          <span className="num">{sentLine}</span>
        </summary>
        <div className={styles.rxBody}>{body}</div>
      </details>
    );
  return (
    <div className={styles.rx}>
      <div className={styles.rxHead}>
        <strong className="num">Version {rx.version}</strong>
        <span className={clinicStyles.pill} data-tone="ok">
          Current
        </span>
      </div>
      <p className={`${styles.rxSent} num`}>
        {sentLine}
        {rx.resentAt && `. Sent again ${dayAndTime(rx.resentAt)}`}
      </p>
      <div className={styles.rxBody}>{body}</div>
      <div className={styles.rxActions}>
        {rx.pdf && (
          <FileOpenButton
            load={() => getFile(rx.pdf!)}
            className={`btn btn--ghost ${styles.open}`}
          >
            {(opening) => (opening ? "Opening" : "View PDF")}
          </FileOpenButton>
        )}
        <button
          type="button"
          className={`btn btn--ghost ${styles.open}`}
          onClick={onAgain}
          disabled={busy !== null}
        >
          {busy === "again" ? "Sending" : "Send again"}
        </button>
        {rx.mine && (
          <button
            type="button"
            className={`btn btn--ghost ${styles.open}`}
            onClick={onEdit}
            disabled={busy !== null}
          >
            {busy === "edit" ? "Opening" : "Edit and send new version"}
          </button>
        )}
      </div>
    </div>
  );
}

function Loaded({
  data,
  reload,
  back,
  writeAtOnce,
}: {
  data: PatientPageData;
  reload: () => void;
  back: { href: string; label: string };
  writeAtOnce: boolean;
}) {
  const toast = useToast();
  const now = useNow(30_000);
  const { consultation: c, patient: p } = data;
  const [tab, setTab] = useState<Tab>("prescriptions");
  const [writing, setWriting] = useState<Writing | null>(() =>
    writeAtOnce ? { target: data.write, initial: data.draft, turn: 0 } : null,
  );
  const [busy, setBusy] = useState<null | "again" | "edit">(null);
  const current = data.prescriptions.find((rx) => rx.current) ?? null;
  const last = data.prescriptions[0] ?? null;
  const report = data.reports[0] ?? null;

  // the call: open from 10 minutes before the start until the doctor ends it (the server decides; it stays
  // open after a mid-call send, so a dropped call can be rejoined from here)
  const callOpen = Boolean(
    c &&
      (c.callOpen ||
        (c.state === "UPCOMING" &&
          Date.parse(c.startsAt) - 10 * 60_000 <= now)),
  );
  useEffect(() => {
    // the page learns when the call opens or ends while it sits open
    const returned = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", returned);
    return () => document.removeEventListener("visibilitychange", returned);
  }, [reload]);

  const open = (target: RxTarget, initial: Prescription | null) =>
    setWriting((was) => ({ target, initial, turn: (was?.turn ?? 0) + 1 }));

  const again = async () => {
    if (busy) return;
    setBusy("again");
    try {
      // the patient's current prescription, whoever sent it
      await sendPrescriptionAgain({ kind: "patient", id: p.id });
      toast("Sent to the patient again");
      reload();
    } catch (caught) {
      toast(errorMessage(caught, "It was not sent again. Try again."));
    } finally {
      setBusy(null);
    }
  };

  const edit = async (rx: PrescriptionEntry) => {
    if (busy) return;
    setBusy("edit");
    // a correction belongs where the prescription was written: its consultation, or none
    const target: RxTarget = rx.appointmentId
      ? { kind: "consultation", id: rx.appointmentId }
      : { kind: "patient", id: p.id };
    try {
      open(target, await revisePrescription(target));
    } catch (caught) {
      toast(
        errorMessage(caught, "The new version could not be opened. Try again."),
      );
    } finally {
      setBusy(null);
    }
  };

  const change = p.monthChangeKg
    ? `${p.monthChangeKg < 0 ? "Down" : "Up"} ${Math.abs(p.monthChangeKg)} kg in the last month`
    : null;
  const team = [
    p.coachName && `Health coach: ${p.coachName}`,
    p.fitnessCoachName && `Fitness coach: ${p.fitnessCoachName}`,
    p.salesperson && `Salesperson: ${p.salesperson}`,
    p.doctors.length > 0 &&
      `${p.doctors.length > 1 ? "Doctors" : "Doctor"}: ${p.doctors.join(", ")}`,
  ].filter(Boolean);
  const writeLabel = data.draft
    ? "Continue the prescription"
    : current
      ? "New prescription"
      : "Write prescription";

  return (
    <main className={`${clinicStyles.page} ${styles.page}`}>
      <PageHead
        className={clinicStyles.pageHead}
        back={back}
        title={p.name}
        sub={
          c ? (
            <>
              {factsLine(c)}.{" "}
              <span className="num">{whenWords(c.startsAt, now)}</span>
            </>
          ) : (
            <span className="num">
              {[p.age, p.sex].filter(Boolean).join(", ")}
            </span>
          )
        }
      />
      {c && (c.reason || callOpen || c.state === "UPCOMING") && (
        // the call has its own row under the name, so a long name keeps one line and a phone gets a full-width Join
        <div className={styles.callRow}>
          {c.reason && (
            <p className={styles.reason}>Reason for the visit: {c.reason}</p>
          )}
          {callOpen ? (
            <button
              type="button"
              className={`btn ${styles.join}`}
              onClick={() => openCallTab(c.id)}
            >
              <span>Join video call</span>
              <span className="well" aria-hidden="true">
                <VideoCamera size={18} weight="fill" />
              </span>
            </button>
          ) : c.state === "UPCOMING" ? (
            <span className={styles.opens}>
              The call opens at{" "}
              {clockTime(new Date(Date.parse(c.startsAt) - 10 * 60_000))}
            </span>
          ) : null}
        </div>
      )}

      <section className={styles.summary} aria-label="About the patient">
        <dl className={styles.stats}>
          <div>
            <dt>Age</dt>
            <dd className="num">
              {p.age ?? "Not recorded"}
              {p.age && p.sex ? <small>{p.sex}</small> : null}
            </dd>
          </div>
          <div>
            <dt>Height</dt>
            <dd className="num">
              {p.heightCm ? `${p.heightCm} cm` : "Not recorded"}
            </dd>
          </div>
          <div>
            <dt>Weight</dt>
            <dd className="num">
              {p.weightKg ? `${p.weightKg} kg` : "Not recorded"}
              {change && <small>{change}</small>}
            </dd>
          </div>
          <div>
            <dt>BMI</dt>
            <dd className="num">{p.bmi ?? "Not recorded"}</dd>
          </div>
        </dl>
        <dl className={styles.facts}>
          <div>
            <dt>Diagnosis</dt>
            <dd>{p.diagnosis ?? "None yet"}</dd>
          </div>
          <div>
            <dt>Allergies</dt>
            <dd>{p.allergies || "Not recorded"}</dd>
          </div>
          {p.conditions.length > 0 && (
            <div>
              <dt>Conditions</dt>
              <dd>{p.conditions.join(", ")}</dd>
            </div>
          )}
          <div>
            <dt>Plan</dt>
            <dd>
              {data.activePlan ? (
                <>
                  {data.activePlan.planName}{" "}
                  <span className={`${clinicStyles.pill} num`} data-tone="ok">
                    Active until {shortDate(data.activePlan.endsAt)}
                  </span>
                </>
              ) : data.assignedPlan ? (
                <>
                  {data.assignedPlan.planName}{" "}
                  <span className={clinicStyles.pill} data-tone="warn">
                    Not paid yet
                  </span>
                </>
              ) : (
                "None yet"
              )}
              {!p.onPlan && (
                <small>
                  Until a plan is paid, a prescription is one month.
                </small>
              )}
            </dd>
          </div>
          <div>
            <dt>Looked after by</dt>
            <dd>{team.length ? team.join("  ·  ") : "Nobody assigned yet"}</dd>
          </div>
          {report && (
            <div>
              <dt>Latest report</dt>
              <dd className={styles.factAction}>
                <span className="num">
                  {report.title}, {shortDate(report.at)}{" "}
                  {new Date(report.at).getFullYear()}
                </span>
                <FileOpenButton
                  load={() => getFile(report.file)}
                  className={styles.textBtn}
                >
                  {(opening) => (opening ? "Opening" : "Open")}
                </FileOpenButton>
              </dd>
            </div>
          )}
        </dl>
      </section>

      <div className={styles.tabs}>
        <SegmentedControl
          label="Patient sections"
          value={tab}
          options={[
            {
              value: "prescriptions",
              label: (
                <>
                  Prescriptions
                  {data.prescriptions.length > 0 && (
                    <span className="num"> {data.prescriptions.length}</span>
                  )}
                </>
              ),
            },
            {
              value: "reports",
              label: (
                <>
                  Reports
                  {data.reports.length > 0 && (
                    <span className="num"> {data.reports.length}</span>
                  )}
                </>
              ),
            },
            {
              value: "remarks",
              label: (
                <>
                  Coach remarks
                  {data.coachRemarks.length > 0 && (
                    <span className="num"> {data.coachRemarks.length}</span>
                  )}
                </>
              ),
            },
          ]}
          onChange={setTab}
        />
      </div>

      {/* the form stays mounted while another section is looked at, so nothing typed is lost */}
      <div className={styles.section} hidden={tab !== "prescriptions"}>
        {writing ? (
          <PrescriptionWriter
            key={writing.turn}
            target={writing.target}
            initial={writing.initial}
            last={last}
            onPlan={p.onPlan}
            onClose={() => {
              setWriting(null);
              reload();
            }}
            onSent={(sent) => {
              setWriting(null);
              toast(
                `Sent to patient${sent.sentAt ? `, ${clockTime(new Date(sent.sentAt))}` : ""}`,
              );
              reload();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onDropped={() => {
              setWriting(null);
              reload();
            }}
          />
        ) : (
          <section className={clinicStyles.panel} aria-labelledby="rxs-heading">
            <div className={clinicStyles.panelHead}>
              <h2 id="rxs-heading" className={clinicStyles.h2}>
                Prescriptions
              </h2>
              <button
                type="button"
                className={`btn ${styles.write}`}
                onClick={() => open(data.write, data.draft)}
              >
                <span>{writeLabel}</span>
                <span className="well" aria-hidden="true">
                  <ArrowRight size={18} />
                </span>
              </button>
            </div>
            {data.draft && (
              <p className={`${styles.draftNote} num`}>
                A prescription was begun
                {data.draft.savedAt
                  ? `, saved ${dayAndTime(data.draft.savedAt)}`
                  : ""}
                . It is not sent yet.
              </p>
            )}
            {data.prescriptions.length === 0 ? (
              <p className={clinicStyles.empty}>
                No prescription yet. One can be written at any time, with or
                without a consultation.
              </p>
            ) : (
              <ol className={styles.rxList}>
                {data.prescriptions.map((rx) => (
                  <li key={rx.id}>
                    <PrescriptionCard
                      rx={rx}
                      busy={busy}
                      onAgain={again}
                      onEdit={() => edit(rx)}
                    />
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>

      <section
        className={clinicStyles.panel}
        aria-labelledby="reports-heading"
        hidden={tab !== "reports"}
      >
        <h2 id="reports-heading" className={clinicStyles.h2}>
          Reports
        </h2>
        {data.reports.length === 0 ? (
          <p className={clinicStyles.empty}>No reports on this account yet.</p>
        ) : (
          <ul className={styles.reports}>
            {data.reports.map((r) => (
              <li key={r.id} className={styles.report}>
                <span className={styles.reportName}>
                  <strong>{r.title}</strong>
                  <span>
                    {r.source === "UPLOAD"
                      ? "Uploaded by the patient"
                      : "From the lab"}
                  </span>
                </span>
                <span className={`${styles.reportDate} num`}>
                  {shortDate(r.at)} {new Date(r.at).getFullYear()}
                </span>
                <FileOpenButton
                  load={() => getFile(r.file)}
                  className={`btn btn--ghost ${styles.open}`}
                >
                  {(opening) => (opening ? "Opening" : "Open")}
                </FileOpenButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className={clinicStyles.panel}
        aria-labelledby="remarks-heading"
        hidden={tab !== "remarks"}
      >
        <h2 id="remarks-heading" className={clinicStyles.h2}>
          Coach remarks
        </h2>
        {data.coachRemarks.length === 0 ? (
          <p className={clinicStyles.empty}>
            No remarks yet. The patient&apos;s coach writes here how the month
            went, before a follow-up.
          </p>
        ) : (
          <ol className={styles.remarks}>
            {data.coachRemarks.map((remark) => (
              <li key={remark.id}>
                <p className={`${styles.remarkBy} num`}>
                  {remark.by}, {dayAndTime(remark.at)}
                </p>
                <p className={styles.remarkText}>{remark.text}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
