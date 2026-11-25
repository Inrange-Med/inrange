"use client";

/*
  One patient, for the care team, in the order the work happens. Top: mobile, WhatsApp, the salesperson (from
  the ranked sales team), their doctors (the first consultation's doctor by default; admin adds and removes
  the rest), the health coach and the fitness coach. Then the blood test, the consultations (the team books,
  moves and cancels them; an admin watches a recording the patient agreed to), the plan with its sale and
  payment links (PlanSale, PaymentLinks; admins), the current prescription and any order waiting, coaching,
  the coach's remarks for the doctor, every prescription with who sent it, the doses, and "History": one
  timeline (messages and the patient's replies, order steps, tasks) newest first, folded until opened.
  While WhatsApp is in test mode an admin can play the patient's reply on a message, exactly as a tap on the
  phone would act. Opening it is logged (audit_log).
  The plan is sold, not prescribed (20 Nov 2026): the salesperson tells admin, admin puts the patient on
  it here, and the patient pays for it in the app (with any medicines waiting, in one payment).
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
  actOnPaymentLink,
  getPatient,
  listStaffPlans,
  makePaymentLink,
  listCoaches,
  listSalespeople,
  playReply,
  setCareTeamDoctor,
  setCoach,
  setFitnessCoach,
  setSalesperson,
} from "@/services/medicineOpsService";
import { listDoctors } from "@/services/adminService";
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
} from "@/features/medicine-queue/words";
import CoachRemarks from "@/features/coaching/CoachRemarks";
import CoachingSections from "@/features/coaching/CoachingSections";
import PatientConsultations from "./PatientConsultations";
import PatientPrescriptions from "./PatientPrescriptions";
import PatientLabSection from "./PatientLab";
import PlanSale from "./PlanSale";
import PaymentLinks from "@/features/payment-links/PaymentLinks";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import adminStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

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
    <span className={s.chips} aria-label="Test the patient's reply">
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

/** The health coach or the fitness coach, chosen from the coaches (any coach can be either). */
function CoachPicker({
  data,
  fitness = false,
  onSaved,
}: {
  data: OpsPatient;
  fitness?: boolean;
  onSaved: () => void;
}) {
  const coaches = useApiResource("coaches", listCoaches);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const now = fitness ? data.patient.fitnessCoach : data.patient.coach;
  const what = fitness ? "Fitness coach" : "Coach";
  if (!coaches.data)
    return <span className={adminStyles.muted}>{now?.name ?? "No coach"}</span>;
  return (
    <select
      className={s.input}
      value={now?.id ?? ""}
      disabled={busy}
      aria-label={fitness ? "Fitness coach" : "Health coach"}
      onChange={async (e) => {
        setBusy(true);
        try {
          await (fitness ? setFitnessCoach : setCoach)(
            data.patient.id,
            e.target.value || null,
          );
          toast(e.target.value ? `${what} assigned` : `${what} removed`);
          onSaved();
        } catch (caught) {
          toast(errorMessage(caught, "The coach could not be changed."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <option value="">{fitness ? "No fitness coach" : "No coach"}</option>
      {coaches.data.map((c) => (
        <option key={c.id} value={c.id}>
          {c.fullName}
        </option>
      ))}
    </select>
  );
}

/** The active sales team, best first, as the options of a picker ("1. Asha Verma"). */
function useSalesOptions() {
  const team = useApiResource("salespeople", listSalespeople);
  return team.data?.filter((p) => p.active) ?? null;
}

/** Who sells to the patient, chosen from the sales team. Someone since taken off the team stays shown until changed. */
function SalespersonPicker({
  data,
  onSaved,
}: {
  data: OpsPatient;
  onSaved: () => void;
}) {
  const toast = useToast();
  const options = useSalesOptions();
  const [busy, setBusy] = useState(false);
  const { salesperson, salespersonId } = data.patient;
  if (!options)
    return (
      <span className={adminStyles.muted}>{salesperson ?? "Not set"}</span>
    );
  if (!options.length && !salesperson)
    return (
      <span className={adminStyles.muted}>
        No salespeople yet. Add one under Team.
      </span>
    );
  const listed = options.some((p) => p.id === salespersonId);
  return (
    <select
      className={s.input}
      value={salespersonId ?? (salesperson ? "former" : "")}
      disabled={busy}
      aria-label="Salesperson"
      onChange={async (e) => {
        setBusy(true);
        try {
          await setSalesperson(data.patient.id, e.target.value || null);
          toast(
            e.target.value ? "Salesperson assigned" : "Salesperson removed",
          );
          onSaved();
        } catch (caught) {
          toast(errorMessage(caught, "The salesperson could not be changed."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <option value="">No salesperson</option>
      {salesperson && !listed && (
        <option value={salespersonId ?? "former"} disabled>
          {salesperson} (not on the team)
        </option>
      )}
      {options.map((p) => (
        <option key={p.id} value={p.id}>
          {p.rank}. {p.fullName}
        </option>
      ))}
    </select>
  );
}

/**
 * The patient's doctors. The doctor of the first consultation joins by default; admin adds more and takes any
 * off. The patient books only with the doctors listed here (anyone, while the list is empty).
 */
function DoctorsField({
  data,
  onSaved,
}: {
  data: OpsPatient;
  onSaved: () => void;
}) {
  const toast = useToast();
  const doctors = useApiResource("admin-doctors", listDoctors);
  const [busy, setBusy] = useState(false);
  const team = data.patient.doctors;
  const others = (doctors.data ?? []).filter(
    (d) => d.active && !team.some((t) => t.id === String(d.id)),
  );
  const change = async (doctorId: string, on: boolean) => {
    setBusy(true);
    try {
      toast(await setCareTeamDoctor(data.patient.id, doctorId, on));
      onSaved();
    } catch (caught) {
      toast(errorMessage(caught, "The care team could not be changed."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {team.length === 0 && <span className={s.lineItem}>None yet</span>}
      {team.map((d) => (
        <span key={d.id} className={s.lineItem}>
          {d.name}{" "}
          <button
            type="button"
            className={s.chip}
            disabled={busy}
            aria-label={`Remove ${d.name} from the care team`}
            onClick={() => change(d.id, false)}
          >
            Remove
          </button>
        </span>
      ))}
      {others.length > 0 && (
        <select
          className={s.input}
          value=""
          disabled={busy}
          aria-label="Add a doctor to the care team"
          onChange={(e) => e.target.value && change(e.target.value, true)}
        >
          <option value="">Add a doctor</option>
          {others.map((d) => (
            <option key={d.id} value={d.id}>
              {d.fullName}
              {d.specialization ? `, ${d.specialization}` : ""}
            </option>
          ))}
        </select>
      )}
    </>
  );
}

export default function PatientSheet({
  patientId,
  isAdmin,
  lab = isAdmin,
  consults = isAdmin,
  mock,
  onClose,
  onChanged,
}: {
  patientId: string | null;
  isAdmin: boolean;
  /** the blood test desk and the consultations desk do their own part of the sheet; an admin, all of it */
  lab?: boolean;
  consults?: boolean;
  mock: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const patient = useApiResource(
    patientId ? `medicine-patient-${patientId}` : null,
    () => getPatient(patientId!),
  );
  const plans = useApiResource(isAdmin ? "staff-plans" : null, listStaffPlans);
  const sellers = useApiResource(
    isAdmin ? "salespeople" : null,
    listSalespeople,
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
              <dt>WhatsApp</dt>
              <dd>
                {data.patient.whatsappSince
                  ? `On since ${shortDate(data.patient.whatsappSince)}`
                  : "Off. Call instead."}
              </dd>
            </div>
            {!isAdmin && (
              <div>
                <dt>Plan</dt>
                <dd>
                  {data.patient.plan ??
                    (data.patient.assignedPlan
                      ? `${data.patient.assignedPlan.name}. Not paid yet`
                      : "No plan")}
                </dd>
              </div>
            )}
            <div>
              <dt>Salesperson</dt>
              <dd>
                {consults ? (
                  <SalespersonPicker data={data} onSaved={refresh} />
                ) : (
                  (data.patient.salesperson ?? "Not set")
                )}
              </dd>
            </div>
            <div>
              <dt>Doctors</dt>
              <dd>
                {consults ? (
                  <DoctorsField data={data} onSaved={refresh} />
                ) : (
                  data.patient.doctors.map((d) => d.name).join(", ") ||
                  "None yet"
                )}
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
            <div>
              <dt>Fitness coach</dt>
              <dd>
                {isAdmin ? (
                  <CoachPicker data={data} fitness onSaved={refresh} />
                ) : (
                  (data.patient.fitnessCoach?.name ?? "No fitness coach")
                )}
              </dd>
            </div>
          </dl>

          {lab && (
            <PatientLabSection
              key={`lab-${data.patient.id}`}
              patientId={data.patient.id}
              onChanged={onChanged}
            />
          )}
          <PatientConsultations
            data={data}
            isAdmin={consults}
            canWatch={isAdmin}
            onChanged={refresh}
          />
          {isAdmin && (
            <section className={s.section} aria-label="Plan">
              <h3 className={s.sectionHead}>Plan</h3>
              <PlanSale key={data.patient.id} data={data} onSaved={refresh} />
              {data.included && (
                <dl className={s.facts}>
                  {data.included.doctorConsults != null && (
                    <div>
                      <dt>Consultations</dt>
                      <dd className="num">
                        {data.included.consultsDone} of{" "}
                        {data.included.doctorConsults} used
                      </dd>
                    </div>
                  )}
                  {data.included.coachCalls != null && (
                    <div>
                      <dt>Coach calls</dt>
                      <dd className="num">
                        {data.included.coachCallsMade} of{" "}
                        {data.included.coachCalls} used
                      </dd>
                    </div>
                  )}
                  {data.included.fitnessCalls != null && (
                    <div>
                      <dt>Fitness calls</dt>
                      <dd className="num">
                        {data.included.fitnessCallsMade} of{" "}
                        {data.included.fitnessCalls} used
                      </dd>
                    </div>
                  )}
                </dl>
              )}
              <PaymentLinks
                key={`links-${data.patient.id}`}
                links={data.links}
                plans={plans.data ?? []}
                canMake={!data.patient.plan}
                anyDiscount
                sellers={(sellers.data ?? [])
                  .filter((p) => p.active)
                  .map((p) => ({
                    id: p.id,
                    label: `${p.rank}. ${p.fullName}`,
                  }))}
                defaultSeller={data.patient.salespersonId ?? ""}
                onMake={(form) => makePaymentLink(data.patient.id, form)}
                onAct={actOnPaymentLink}
                onChanged={refresh}
              />
            </section>
          )}
          {(data.prescription || cart) && (
            <section className={s.section} aria-label="Medicines">
              <h3 className={s.sectionHead}>Medicines</h3>
              <dl className={s.facts}>
                {data.prescription && (
                  <>
                    <div>
                      <dt>Prescription</dt>
                      <dd>
                        {data.prescription.items.map((i) => (
                          <span key={i.name} className={s.lineItem}>
                            {i.name}
                            {i.frequency
                              ? `, ${i.frequency.toLowerCase()}`
                              : ""}
                            {!i.stocked ? " (not stocked)" : ""}
                          </span>
                        ))}
                      </dd>
                    </div>
                    <div>
                      <dt>Signed</dt>
                      <dd className="num">
                        {data.prescription.doctor},{" "}
                        {shortDate(data.prescription.signedAt)}
                      </dd>
                    </div>
                    {data.prescription.validUntil && (
                      <div>
                        <dt>Valid until</dt>
                        <dd className="num">
                          {shortDate(data.prescription.validUntil)}
                        </dd>
                      </div>
                    )}
                  </>
                )}
                {cart && (
                  <div>
                    <dt>{cart.kind === "REFILL" ? "Refill" : "Order"}</dt>
                    <dd>
                      <span className="num">
                        {formatRupees(cart.totalPaise / 100)}
                      </span>
                      . Not paid yet
                      {cart.boughtElsewhere ? ". Bought elsewhere." : ""}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
          <CoachingSections
            key={`coaching-${data.patient.id}`}
            patientId={data.patient.id}
            can={{ health: isAdmin, fitness: isAdmin }}
            diet={data.coaching.diet}
            fitness={data.coaching.fitness}
            calls={data.coaching.calls}
            included={
              data.included && {
                coachCalls: data.included.coachCalls,
                fitnessCalls: data.included.fitnessCalls,
                healthCallsMade: data.included.coachCallsMade,
                fitnessCallsMade: data.included.fitnessCallsMade,
              }
            }
            onSaved={refresh}
          />
          <CoachRemarks
            key={data.patient.id}
            patientId={data.patient.id}
            remarks={data.remarks}
            onSaved={refresh}
          />
          <PatientPrescriptions prescriptions={data.prescriptions} />

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

          <details className={adminStyles.history}>
            <summary>History</summary>
            <Timeline
              data={data}
              mock={mock}
              isAdmin={isAdmin}
              onPlayed={refresh}
            />
          </details>
          <p className={formStyles.hint}>Opening this record is logged.</p>
        </div>
      )}
    </Sheet>
  );
}
