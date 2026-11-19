"use client";

/*
  One patient's medicines, for the care team and their coach: the plan, WhatsApp, the coach, the
  prescription, then one timeline (messages and the patient's replies, order steps, tasks) newest
  first, and the doses. While WhatsApp is in test mode an admin can play the patient's reply on a
  message, exactly as a tap on the phone would act. Opening it is logged (audit_log).
*/

import { useState } from "react";
import Sheet from "@/components/ui/Sheet";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { shortDate } from "@/lib/format/dateTime";
import { formatRupees } from "@/lib/format/money";
import { spacedMobile } from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import {
  getPatient,
  listCoaches,
  playReply,
  setCoach,
} from "@/services/medicineOpsService";
import type { OpsMessage, OpsPatient } from "@/types/medicineOps";
import {
  ACTION_WORDS,
  clockWords,
  KIND_WORDS,
  MESSAGE_WORDS,
  ORDER_WORDS,
  REPLIES_FOR,
  STATUS_WORDS,
  WEEKDAYS,
  when,
} from "./words";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";
import s from "./Medicine.module.css";

type Moment = { at: string; key: string; node: React.ReactNode };

const DOSE_WORDS = {
  DUE: "Due",
  TAKEN: "Taken",
  TAKEN_LATE: "Taken late",
  SKIPPED: "Skipped",
  MISSED: "Missed",
} as const;
const CADENCE = {
  WEEKLY: "Weekly",
  DAILY: "Daily",
  TWICE_DAILY: "Twice a day",
} as const;

function messageLine(m: OpsMessage) {
  const status =
    m.status === "SKIPPED"
      ? `Not sent: ${m.skipReason?.toLowerCase() ?? "no reason"}`
      : m.status === "FAILED"
        ? `Not sent: ${m.error ?? "WhatsApp refused it"}`
        : STATUS_WORDS[m.status];
  if (m.kind === "REPLY") return `Our reply: "${m.text ?? ""}"`;
  const waiting =
    m.status === "QUEUED" && m.sendAfter && new Date(m.sendAfter) > new Date()
      ? ` (goes ${when(m.sendAfter)})`
      : "";
  return `${MESSAGE_WORDS[m.kind] ?? m.kind}. ${status}${waiting}.`;
}

function ReplyChips({
  message,
  onPlayed,
}: {
  message: OpsMessage;
  onPlayed: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const options = message.choices?.length
    ? message.choices
    : (REPLIES_FOR[message.kind] ?? []);
  if (
    !options.length ||
    message.status === "SKIPPED" ||
    message.status === "QUEUED"
  )
    return null;
  return (
    <span className={s.chips} aria-label="Play the patient's reply (test mode)">
      {options.map((o) => (
        <button
          key={o.code}
          type="button"
          className={s.chip}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              toast(await playReply(message.id, { code: o.code }));
              onPlayed();
            } catch (caught) {
              toast(errorMessage(caught, "That reply could not be played."));
            } finally {
              setBusy(false);
            }
          }}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

function Timeline({
  data,
  mock,
  isAdmin,
  onPlayed,
}: {
  data: OpsPatient;
  mock: boolean;
  isAdmin: boolean;
  onPlayed: () => void;
}) {
  const moments: Moment[] = [];
  for (const m of data.messages) {
    moments.push({
      at: m.sentAt ?? m.createdAt,
      key: `m${m.id}`,
      node: (
        <>
          <strong>{messageLine(m)}</strong>
          {m.replies?.map((r, i) => (
            <span key={i} className={s.reply}>
              Patient tapped{" "}
              {r.action
                ? `"${ACTION_WORDS[r.action] ?? r.action}"`
                : `"${r.text ?? ""}"`}
              . {r.outcome}
            </span>
          ))}
          {mock && isAdmin && !m.replies?.length && (
            <ReplyChips message={m} onPlayed={onPlayed} />
          )}
        </>
      ),
    });
  }
  for (const r of data.looseReplies)
    moments.push({
      at: r.at,
      key: `r${r.at}`,
      node: (
        <strong>{`Wrote on WhatsApp: "${r.text ?? ""}". ${r.outcome ?? ""}`}</strong>
      ),
    });
  for (const o of data.orders)
    for (const [i, h] of o.history.entries())
      moments.push({
        at: h.at,
        key: `o${o.id}-${i}`,
        node: (
          <strong>{`${o.orderNumber}: ${h.note ?? (h.status ? ORDER_WORDS[h.status as keyof typeof ORDER_WORDS] : "")}`}</strong>
        ),
      });
  for (const t of data.tasks)
    for (const [i, h] of t.history.entries())
      moments.push({
        at: h.at,
        key: `t${t.id}-${i}`,
        node: (
          <>
            <strong>{`${KIND_WORDS[t.kind]}: ${h.what ?? ""}`}</strong>
            {h.byName && <span className={s.reply}>{h.byName}</span>}
          </>
        ),
      });
  for (const f of data.followups)
    for (const [i, h] of f.history.entries())
      moments.push({
        at: h.at,
        key: `f${f.id}-${i}`,
        node: <strong>{h.what}</strong>,
      });
  // the times come in two forms ("+05:30" and "Z"), so they are compared as instants
  moments.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (!moments.length) return <p className={adminStyles.empty}>Nothing yet.</p>;
  return (
    <ol className={s.timeline}>
      {moments.slice(0, 80).map((m) => (
        <li key={m.key}>
          <time dateTime={m.at}>{when(m.at)}</time>
          <span>{m.node}</span>
        </li>
      ))}
    </ol>
  );
}

function CoachPicker({
  data,
  onSaved,
}: {
  data: OpsPatient;
  onSaved: () => void;
}) {
  const coaches = useApiResource("coaches", listCoaches);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!coaches.data)
    return (
      <span className={adminStyles.muted}>
        {data.patient.coach?.name ?? "No coach"}
      </span>
    );
  return (
    <select
      className={s.input}
      value={data.patient.coach?.id ?? ""}
      disabled={busy}
      aria-label="Health coach"
      onChange={async (e) => {
        setBusy(true);
        try {
          await setCoach(data.patient.id, e.target.value || null);
          toast(e.target.value ? "Coach assigned" : "Coach removed");
          onSaved();
        } catch (caught) {
          toast(errorMessage(caught, "The coach could not be changed."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <option value="">No coach</option>
      {coaches.data.map((c) => (
        <option key={c.id} value={c.id}>
          {c.fullName}
        </option>
      ))}
    </select>
  );
}

export default function PatientSheet({
  patientId,
  isAdmin,
  mock,
  onClose,
  onChanged,
}: {
  patientId: string | null;
  isAdmin: boolean;
  mock: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const patient = useApiResource(
    patientId ? `medicine-patient-${patientId}` : null,
    () => getPatient(patientId!),
  );
  // the last patient's record stays loaded while the next one loads: never show or act on it
  const data = patient.data?.patient.id === patientId ? patient.data : null;
  const refresh = () => {
    patient.reload();
    onChanged();
  };
  const cart = data?.carts.find((k) => k.status === "OPEN") ?? null;
  const events = data?.doses.events ?? [];
  const resolved = events.filter((e) => e.status !== "DUE");
  const taken = resolved.filter(
    (e) => e.status === "TAKEN" || e.status === "TAKEN_LATE",
  );

  return (
    <Sheet
      open={patientId !== null}
      onClose={onClose}
      title={data?.patient.name ?? "Patient"}
    >
      {patient.error && !data ? (
        <ErrorNotice message={patient.error} onRetry={patient.reload} />
      ) : !data ? (
        <LoadingSkeleton />
      ) : (
        <div className={s.sheet}>
          <dl className={s.facts}>
            <div>
              <dt>Mobile</dt>
              <dd>
                <a href={`tel:+91${data.patient.mobile}`} className="num">
                  {spacedMobile(data.patient.mobile)}
                </a>
              </dd>
            </div>
            <div>
              <dt>Plan</dt>
              <dd>{data.patient.plan ?? "First consultation, no plan"}</dd>
            </div>
            <div>
              <dt>WhatsApp</dt>
              <dd>
                {data.patient.whatsappSince
                  ? `On since ${shortDate(data.patient.whatsappSince)}`
                  : "Off: nothing is sent. Call instead."}
              </dd>
            </div>
            <div>
              <dt>Health coach</dt>
              <dd>
                {isAdmin ? (
                  <CoachPicker data={data} onSaved={refresh} />
                ) : (
                  (data.patient.coach?.name ?? "No coach")
                )}
              </dd>
            </div>
            {data.prescription && (
              <div>
                <dt>Prescription</dt>
                <dd>
                  {data.prescription.items.map((i) => (
                    <span key={i.name} className={s.lineItem}>
                      {i.name}
                      {i.frequency ? `, ${i.frequency.toLowerCase()}` : ""}
                      {!i.stocked ? " (not stocked)" : ""}
                    </span>
                  ))}
                  <span className={`${s.lineItem} ${adminStyles.muted}`}>
                    {data.prescription.doctor}, signed{" "}
                    {shortDate(data.prescription.signedAt)}
                    {data.prescription.validUntil
                      ? `, valid until ${shortDate(data.prescription.validUntil)}`
                      : ""}
                  </span>
                </dd>
              </div>
            )}
            {cart && (
              <div>
                <dt>
                  {cart.kind === "REFILL" ? "Refill waiting" : "Order waiting"}
                </dt>
                <dd>
                  <span className="num">
                    {formatRupees(cart.totalPaise / 100)}
                  </span>
                  , ready to pay in the app
                  {cart.boughtElsewhere
                    ? ". Bought elsewhere, no reminders."
                    : ""}
                </dd>
              </div>
            )}
          </dl>

          {data.doses.schedules.length > 0 && (
            <section className={s.section} aria-label="Doses">
              <h3 className={s.sectionHead}>
                Doses
                {resolved.length >= 3
                  ? `: ${Math.round((taken.length / resolved.length) * 100)}% taken`
                  : ""}
              </h3>
              <dl className={s.facts}>
                {data.doses.schedules.map((sch) => (
                  <div key={sch.id}>
                    <dt>{sch.medicine}</dt>
                    <dd>
                      {CADENCE[sch.cadence]}
                      {sch.weekday
                        ? `, ${WEEKDAYS[sch.weekday - 1]}`
                        : ""} at{" "}
                      <span className="num">
                        {sch.times.map(clockWords).join(" and ")}
                      </span>
                      {sch.paused ? ", reminders paused" : ""}
                    </dd>
                  </div>
                ))}
              </dl>
              {resolved.length > 0 && (
                <ol className={s.timeline}>
                  {resolved.slice(0, 8).map((e) => (
                    <li key={e.id}>
                      <time dateTime={e.dueAt}>{when(e.dueAt)}</time>
                      <span>
                        {DOSE_WORDS[e.status]}
                        {e.skipReason
                          ? `: ${e.skipReason.toLowerCase().replace("_", " ")}`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          <section className={s.section} aria-label="What happened">
            <h3 className={s.sectionHead}>What happened</h3>
            <Timeline
              data={data}
              mock={mock}
              isAdmin={isAdmin}
              onPlayed={refresh}
            />
          </section>
          <p className={formStyles.hint}>
            Opening a patient&apos;s medicines is recorded in their audit log.
          </p>
        </div>
      )}
    </Sheet>
  );
}
