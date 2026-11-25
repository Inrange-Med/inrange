"use client";

/*
  One lead, end to end, for their salesperson (and for an admin): what the team's sheet tracks, in the order
  the work happens.
    The lead      contact, where they stand, what they have paid, blood test and report, the consultation and
                  its doctor (Join opens the video call: the salesperson comes in after the doctor), whether a
                  prescription was sent and whether it has a GLP-1 medicine, the coach
    After a call  how it went, a remark, when to call again; every note stays below
    Plan          the payment link (plan and discount); paid, the plan starts by itself. Or a payment made
                  another way, by its Razorpay payment ID
    Sales form    once the plan is paid for: the customer, plan, amount, payment ID and salesperson are filled
                  in from the payment; the salesperson adds the condition, the programme, the coach asked for
                  and remarks. It can be corrected later
  Never here: reports, lab values, the prescription itself or the doctor's notes. Opening the sheet is logged.
*/

import { useState } from "react";
import DatePicker from "@/components/ui/DatePicker";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Sheet from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/ToastProvider";
import PaymentLinks from "@/features/payment-links/PaymentLinks";
import { when } from "@/features/medicine-queue/words";
import { useApiResource } from "@/hooks/useApiResource";
import { shortDate, toApiDate } from "@/lib/format/dateTime";
import { formatRupees } from "@/lib/format/money";
import { spacedMobile } from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import { listSalespeople, setSalesperson } from "@/services/medicineOpsService";
import {
  actOnSalesLink,
  addLeadUpdate,
  getLead,
  listPlansOnSale,
  makeSalesLink,
  recordSale,
  saveSaleForm,
} from "@/services/salesService";
import type { CallStatus, LeadDetail, PlanOnSale, Sale } from "@/types/sales";
import { callWhen, CALL_WORDS, STAGE_WORDS } from "./leadWords";
import surfaceStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

const CONSULT: Record<LeadDetail["consultations"][number]["status"], string> = {
  Booked: "Booked",
  InProgress: "In progress",
  Completed: "Done",
  NoShow: "No one joined",
};

/** Where the blood test and the report stand, in a few words; never the report itself. */
function reportWords(lead: LeadDetail["lead"]) {
  if (lead.eligibilityStage === "APPROVED") return "Report reviewed";
  if (lead.eligibilityStage === "UNDER_REVIEW")
    return "Report in, being reviewed";
  if (lead.eligibilityStage === "NOT_APPROVED")
    return "A newer report is needed";
  if (lead.eligibilityStage === "SAMPLE_COLLECTED")
    return "Sample collected, report to come";
  if (lead.eligibilityStage === "LAB_SCHEDULED") return "Blood test booked";
  if (lead.labCredit) return "Paid, blood test to book";
  return "Not started";
}

/** After a call: how it went, a remark, and when to call again. */
function CallNote({
  leadId,
  onSaved,
}: {
  leadId: string;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [status, setStatus] = useState<CallStatus | null>(null);
  const [remark, setRemark] = useState("");
  const [followUpOn, setFollowUpOn] = useState("");
  const [busy, setBusy] = useState(false);
  const today = toApiDate(new Date());

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await addLeadUpdate(leadId, {
        callStatus: status,
        remark: remark.trim(),
        followUpOn: followUpOn || null,
      });
      toast("Saved");
      setStatus(null);
      setRemark("");
      setFollowUpOn("");
      onSaved();
    } catch (caught) {
      toast(errorMessage(caught, "That was not saved. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.planForm}>
      <span
        className={s.chips}
        role="radiogroup"
        aria-label="How the call went"
      >
        {(Object.keys(CALL_WORDS) as CallStatus[]).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={status === value}
            data-on={status === value || undefined}
            className={s.chip}
            onClick={() => setStatus(status === value ? null : value)}
          >
            {CALL_WORDS[value]}
          </button>
        ))}
      </span>
      <input
        className={s.input}
        value={remark}
        maxLength={2000}
        placeholder="Remark, if any"
        aria-label="Remark"
        onChange={(e) => setRemark(e.target.value)}
      />
      <DatePicker
        label="Call again on"
        value={followUpOn}
        min={today}
        placeholder="Call again on (optional)"
        onChange={setFollowUpOn}
      />
      <span className={s.chips}>
        <button
          type="button"
          className={s.chip}
          disabled={busy || (!status && !remark.trim() && !followUpOn)}
          onClick={save}
        >
          {busy ? "Saving" : "Save the note"}
        </button>
      </span>
    </div>
  );
}

/** A payment the customer already made another way: its Razorpay payment ID starts the plan once Razorpay confirms it. */
function PaidAlready({
  leadId,
  plans,
  onSaved,
}: {
  leadId: string;
  plans: PlanOnSale[];
  onSaved: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy || !planId) return;
    if (!/^pay_\w{6,}$/.test(paymentId.trim()))
      return setProblem("A Razorpay payment ID starts with pay_.");
    setBusy(true);
    setProblem(null);
    try {
      toast(
        await recordSale(leadId, {
          planId,
          paymentId: paymentId.trim(),
          coachPreference: "",
          note: "",
        }),
      );
      setOpen(false);
      onSaved();
    } catch (caught) {
      setProblem(errorMessage(caught, "The sale could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <span className={s.chips}>
        <button type="button" className={s.chip} onClick={() => setOpen(true)}>
          They have paid already
        </button>
      </span>
    );
  return (
    <div className={s.planForm}>
      <SegmentedControl
        label="Plan length"
        value={planId}
        options={plans.map((p) => ({
          value: p.id,
          label: `${p.months} months`,
        }))}
        onChange={setPlanId}
      />
      <input
        className={s.input}
        value={paymentId}
        maxLength={40}
        placeholder="Razorpay payment ID (pay_...)"
        aria-label="Razorpay payment ID"
        onChange={(e) => setPaymentId(e.target.value)}
      />
      <span className={surfaceStyles.muted}>
        The amount comes from Razorpay, and the plan starts once Razorpay
        confirms the payment.
      </span>
      {problem && (
        <span className={s.problem} role="alert">
          {problem}
        </span>
      )}
      <span className={s.chips}>
        <button
          type="button"
          className={s.chip}
          disabled={!planId || busy}
          onClick={save}
        >
          {busy ? "Checking with Razorpay" : "Start the plan"}
        </button>
        <button
          type="button"
          className={s.chip}
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </span>
    </div>
  );
}

/** The sales form: what the payment filled in, and what the salesperson adds. */
function SaleFormSection({
  data,
  sale,
  onSaved,
}: {
  data: LeadDetail;
  sale: Sale;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [condition, setCondition] = useState(
    sale.condition ?? data.condition ?? "",
  );
  const [programme, setProgramme] = useState(sale.programme ?? "");
  const [coachPreference, setCoachPreference] = useState(
    sale.coachPreference ?? "",
  );
  const [note, setNote] = useState(sale.note ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await saveSaleForm(data.lead.id, {
        condition: condition.trim(),
        programme: programme.trim(),
        coachPreference: coachPreference.trim(),
        note: note.trim(),
      });
      toast("Sales form saved");
      onSaved();
    } catch (caught) {
      toast(errorMessage(caught, "The form was not saved. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    placeholder: string,
    max: number,
  ) => (
    <input
      className={s.input}
      value={value}
      maxLength={max}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => set(e.target.value)}
    />
  );

  return (
    <section className={s.section} aria-label="Sales form">
      <h3 className={s.sectionHead}>
        Sales form
        <span className={surfaceStyles.muted}>
          {" "}
          {sale.submittedAt
            ? `Filled in by ${sale.submittedBy ?? "the team"}, ${shortDate(sale.submittedAt)}`
            : "To fill in"}
        </span>
      </h3>
      <dl className={s.facts}>
        <div>
          <dt>Customer</dt>
          <dd className="num">
            {data.lead.name}, {spacedMobile(data.lead.mobile)}
          </dd>
        </div>
        <div>
          <dt>Plan</dt>
          <dd>{sale.planName}</dd>
        </div>
        <div>
          <dt>Amount received</dt>
          <dd className="num">
            {sale.amountRupees != null
              ? formatRupees(sale.amountRupees)
              : "Not on record"}
          </dd>
        </div>
        <div>
          <dt>Payment ID</dt>
          <dd className="num">{sale.paymentId ?? "Not on record"}</dd>
        </div>
        <div>
          <dt>Salesperson</dt>
          <dd>{sale.salesperson ?? data.lead.salesperson ?? "Not recorded"}</dd>
        </div>
      </dl>
      <div className={s.planForm}>
        {field(
          "Medical condition",
          condition,
          setCondition,
          "Medical condition, in a few words",
          300,
        )}
        {field(
          "Programme",
          programme,
          setProgramme,
          "Programme (weight care, diabetes care)",
          120,
        )}
        {field(
          "The coach they asked for",
          coachPreference,
          setCoachPreference,
          "The coach they asked for (language, timing), if any",
          200,
        )}
        {field("Remarks", note, setNote, "Remarks, if any", 1000)}
        <span className={s.chips}>
          <button
            type="button"
            className={s.chip}
            disabled={busy}
            onClick={save}
          >
            {busy
              ? "Saving"
              : sale.submittedAt
                ? "Save the changes"
                : "Submit the sales form"}
          </button>
        </span>
      </div>
    </section>
  );
}

export default function LeadSheet({
  leadId,
  admin,
  onJoin,
  onClose,
  onChanged,
}: {
  leadId: string | null;
  admin: boolean;
  onJoin: (consultationId: string) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const detail = useApiResource(leadId ? `lead-${leadId}` : null, () =>
    getLead(leadId!),
  );
  const plans = useApiResource("plans-on-sale", listPlansOnSale);
  const team = useApiResource(admin ? "salespeople" : null, listSalespeople);
  // the last lead stays loaded while the next one loads: never show or act on them
  const data = detail.data?.lead.id === leadId ? detail.data : null;
  const lead = data?.lead;
  const refresh = () => {
    detail.reload();
    onChanged();
  };
  const sellers = (team.data ?? []).filter((p) => p.active);

  return (
    <Sheet
      open={leadId !== null}
      onClose={onClose}
      title={lead?.name ?? "Lead"}
    >
      {detail.error && !data ? (
        <ErrorNotice message={detail.error} onRetry={detail.reload} />
      ) : !data || !lead ? (
        <LoadingSkeleton />
      ) : (
        <div className={s.sheet}>
          <dl className={s.facts}>
            <div>
              <dt>Mobile</dt>
              <dd>
                <a href={`tel:+91${lead.mobile}`} className="num">
                  {spacedMobile(lead.mobile)}
                </a>
                {lead.email && (
                  <span className={`${s.lineItem} ${surfaceStyles.muted}`}>
                    {lead.email}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>Where they are</dt>
              <dd>
                {STAGE_WORDS[lead.stage]}
                <span className={`${s.lineItem} ${surfaceStyles.muted} num`}>
                  Signed up {shortDate(lead.createdAt)}
                  {lead.bmi ? `. BMI ${lead.bmi}` : ""}
                </span>
              </dd>
            </div>
            <div>
              <dt>Paid so far</dt>
              <dd className="num">
                {lead.paidRupees
                  ? `${formatRupees(lead.paidRupees)}, last for ${lead.paidFor ?? "their care"}${lead.lastPaidAt ? `, ${shortDate(lead.lastPaidAt)}` : ""}`
                  : "Nothing yet"}
              </dd>
            </div>
            <div>
              <dt>Blood test</dt>
              <dd>{reportWords(lead)}</dd>
            </div>
            <div>
              <dt>Consultation</dt>
              <dd>
                {data.consultations.length === 0 && "None booked yet"}
                {data.consultations.slice(0, 3).map((a) => (
                  <span key={a.id} className={`${s.lineItem} num`}>
                    {when(a.startsAt)}, {a.doctorName}. {CONSULT[a.status]}{" "}
                    {a.joinable && (
                      <button
                        type="button"
                        className={s.chip}
                        data-on="true"
                        onClick={() => onJoin(a.id)}
                      >
                        Join the call
                      </button>
                    )}
                  </span>
                ))}
                {lead.nextCallAt && (
                  <span className={`${s.lineItem} ${surfaceStyles.muted}`}>
                    You join after the doctor. Next:{" "}
                    {callWhen(lead.nextCallAt).toLowerCase()}.
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>Prescription</dt>
              <dd>
                {lead.prescriptionSentAt
                  ? `Sent ${shortDate(lead.prescriptionSentAt)}, for one month. ${lead.glp1Prescribed ? "GLP-1 medicine prescribed" : "No GLP-1 medicine on it"}`
                  : "Not sent yet"}
                {data.condition && (
                  <span className={`${s.lineItem} ${surfaceStyles.muted}`}>
                    Condition: {data.condition}
                  </span>
                )}
                {lead.lastOrderAt && (
                  <span className={`${s.lineItem} ${surfaceStyles.muted} num`}>
                    Last medicine order {shortDate(lead.lastOrderAt)}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>Doctor and coach</dt>
              <dd>
                {lead.doctors ?? "No doctor yet"}
                <span className={`${s.lineItem} ${surfaceStyles.muted}`}>
                  {[
                    lead.coachName && `Coach: ${lead.coachName}`,
                    lead.fitnessCoachName &&
                      `Fitness: ${lead.fitnessCoachName}`,
                  ]
                    .filter(Boolean)
                    .join(". ") || "A coach is assigned when the plan starts"}
                </span>
              </dd>
            </div>
            {admin && (
              <div>
                <dt>Salesperson</dt>
                <dd>
                  <select
                    className={s.input}
                    value={lead.salespersonId ?? ""}
                    aria-label="Salesperson"
                    onChange={async (e) => {
                      try {
                        await setSalesperson(lead.id, e.target.value || null);
                        toast(
                          e.target.value
                            ? "Salesperson assigned"
                            : "Salesperson removed",
                        );
                        refresh();
                      } catch (caught) {
                        toast(errorMessage(caught, "That was not saved."));
                      }
                    }}
                  >
                    <option value="">Not assigned</option>
                    {lead.salespersonId &&
                      !sellers.some((p) => p.id === lead.salespersonId) && (
                        <option value={lead.salespersonId} disabled>
                          {lead.salesperson} (not on the team)
                        </option>
                      )}
                    {sellers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.rank}. {p.fullName}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
            )}
            <div>
              <dt>Plan</dt>
              <dd>
                {lead.planName && (
                  <span className={s.lineItem}>
                    {lead.planName}
                    {lead.planEndsAt
                      ? `, until ${shortDate(lead.planEndsAt)}`
                      : ""}
                  </span>
                )}
                {!lead.planName && data.links.length === 0 && (
                  <span className={s.lineItem}>No plan yet</span>
                )}
                <PaymentLinks
                  key={lead.id}
                  links={data.links}
                  plans={plans.data ?? []}
                  canMake={!lead.planName}
                  anyDiscount={admin}
                  onMake={(form) => makeSalesLink(lead.id, form)}
                  onAct={(id, action) =>
                    actOnSalesLink(id, action === "cancel" ? "cancel" : "check")
                  }
                  onChanged={refresh}
                />
                {!lead.planName && (
                  <PaidAlready
                    key={`paid-${lead.id}`}
                    leadId={lead.id}
                    plans={plans.data ?? []}
                    onSaved={refresh}
                  />
                )}
              </dd>
            </div>
          </dl>

          {data.sale && (
            <SaleFormSection
              key={`form-${lead.id}-${data.sale.submittedAt}`}
              data={data}
              sale={data.sale}
              onSaved={refresh}
            />
          )}

          <section className={s.section} aria-label="After a call">
            <h3 className={s.sectionHead}>After a call</h3>
            <CallNote
              key={`note-${lead.id}`}
              leadId={lead.id}
              onSaved={refresh}
            />
            {data.updates.length > 0 && (
              <ol className={s.timeline}>
                {data.updates.map((u) => (
                  <li key={u.id}>
                    <time dateTime={u.at}>{when(u.at)}</time>
                    <span>
                      <strong className={s.pre}>
                        {[
                          u.callStatus && CALL_WORDS[u.callStatus],
                          u.remark,
                          u.followUpOn &&
                            `Call again ${shortDate(u.followUpOn)}`,
                        ]
                          .filter(Boolean)
                          .join(". ")}
                      </strong>
                      <span className={s.reply}>{u.by}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {data.payments.length > 0 && (
            <section className={s.section} aria-label="Payments">
              <h3 className={s.sectionHead}>Payments</h3>
              <ol className={s.timeline}>
                {data.payments.map((p, i) => (
                  <li key={i}>
                    <time dateTime={p.paidAt}>{shortDate(p.paidAt)}</time>
                    <span>
                      <strong className="num">
                        {formatRupees(p.amountRupees)}, {p.title}
                      </strong>
                      {p.paymentId && (
                        <span className={`${s.reply} num`}>
                          Payment ID {p.paymentId}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}
