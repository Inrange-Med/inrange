"use client";

/*
  One lead, on its own page, for their salesperson (and for an admin). In the order the work happens
  (23 Nov 2026 call): the steps the lead has passed, the one thing to do next, then
    Plan         pick the plan, send it. The customer pays in their app or with the link shown here; the
                 page keeps asking Razorpay, and once it is paid the plan starts by itself. A payment made
                 another way is added by its payment ID
    Sales form   after the payment. Customer, number, plan, amount, payment ID, salesperson and doctor come
                 from the system; the salesperson picks the condition and the programme and adds remarks
    Call notes   how a call went and when to call again
    Details      what the team's sheet tracks, all from the system
  Never here: reports, lab values, the prescription itself or the doctor's notes. Opening the page is logged.
*/

import { useEffect, useState } from "react";
import BackLink from "@/components/ui/BackLink";
import DatePicker from "@/components/ui/DatePicker";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
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
  getSalesCallLink,
  listPlansOnSale,
  makeSalesLink,
  recordSale,
  saveSaleForm,
} from "@/services/salesService";
import type {
  CallStatus,
  LeadDetail,
  LeadStage,
  PaymentLink,
  PlanOnSale,
  Sale,
} from "@/types/sales";
import { callWhen, CALL_WORDS, followUpDue, STAGE_WORDS } from "./leadWords";
import surfaceStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";
import p from "./LeadPage.module.css";

const STEPS: { label: string; from: LeadStage }[] = [
  { label: "Signed up", from: "NEW" },
  { label: "Paid for blood test", from: "PAID" },
  { label: "Blood test booked", from: "TEST_BOOKED" },
  { label: "Report in", from: "REPORT_IN" },
  { label: "Consultation", from: "CONSULT_BOOKED" },
  { label: "On a plan", from: "ON_PLAN" },
];
const ORDER: LeadStage[] = [
  "NEW",
  "PAID",
  "TEST_BOOKED",
  "REPORT_IN",
  "CONSULT_BOOKED",
  "CONSULTED",
  "LINK_SENT",
  "ON_PLAN",
];

/** The conditions and programmes inrange treats; the form offers these and nothing typed. */
const CONDITIONS = [
  "Obesity",
  "Type 2 diabetes",
  "Obesity and type 2 diabetes",
  "Other",
];
const PROGRAMMES = ["Weight care", "Diabetes care"];

const CONSULT: Record<LeadDetail["consultations"][number]["status"], string> = {
  Booked: "Booked",
  InProgress: "In progress",
  Completed: "Done",
  NoShow: "No one joined",
};

/** Where the blood test and the report stand, in a few words; never the report itself. */
function reportWords(lead: LeadDetail["lead"]) {
  if (lead.eligibilityStage === "APPROVED") return "Report reviewed";
  if (lead.eligibilityStage === "UNDER_REVIEW") return "Report in";
  if (lead.eligibilityStage === "NOT_APPROVED") return "New report needed";
  if (lead.eligibilityStage === "SAMPLE_COLLECTED") return "Sample collected";
  if (lead.eligibilityStage === "LAB_SCHEDULED") return "Booked";
  if (lead.labCredit) return "Paid, not booked";
  return "Not started";
}

const planLabel = (plan: PlanOnSale) =>
  `${plan.months} months, ${formatRupees(plan.priceRupees)}`;

/** The plan: pick it and send it; then the link, until it is paid. */
function PlanPanel({
  data,
  plans,
  admin,
  onChanged,
}: {
  data: LeadDetail;
  plans: PlanOnSale[];
  admin: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { lead } = data;
  const link = data.links.find((l) => l.status === "CREATED") ?? null;
  const [planId, setPlanId] = useState("");
  const [busy, setBusy] = useState(false);
  const [paidOpen, setPaidOpen] = useState(false);
  const [paymentId, setPaymentId] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (work: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      toast(await work());
      onChanged();
    } catch (caught) {
      setProblem(errorMessage(caught, "That did not work. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  };
  const copyAndSay = async (url: string) =>
    toast((await copy(url)) ? "Link copied" : "Select the link and copy it.");

  const picker = (
    <label className={p.field}>
      Plan
      <select
        className={s.input}
        value={planId}
        onChange={(e) => setPlanId(e.target.value)}
      >
        <option value="">Choose a plan</option>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {planLabel(plan)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className={surfaceStyles.panel} aria-labelledby="plan-h">
      <h2 id="plan-h" className={surfaceStyles.h2}>
        Plan
      </h2>
      {lead.planName ? (
        <div>
          <p className={p.big}>{lead.planName}</p>
          <p className={`${surfaceStyles.muted} num`}>
            Paid. Started{" "}
            {lead.planStartedAt ? shortDate(lead.planStartedAt) : ""}
            {lead.planEndsAt ? `, ends ${shortDate(lead.planEndsAt)}` : ""}.
          </p>
        </div>
      ) : link ? (
        <LinkWaiting
          link={link}
          mobile={lead.mobile}
          busy={busy}
          onCopy={() => copyAndSay(link.url)}
          onCheck={() => run(() => actOnSalesLink(link.id, "check"))}
          onCancel={() => run(() => actOnSalesLink(link.id, "cancel"))}
        />
      ) : (
        <div className={p.form}>
          {picker}
          <div className={p.actions}>
            <button
              type="button"
              className={p.btn}
              disabled={!planId || busy}
              onClick={() =>
                run(async () => {
                  const made = await makeSalesLink(lead.id, {
                    planId,
                    discountPercent: 0,
                    coachPreference: "",
                    note: "",
                    ...(admin ? { salespersonId: lead.salespersonId } : {}),
                  });
                  return (await copy(made.url))
                    ? "Plan sent. Link copied."
                    : "Plan sent. The link is below.";
                })
              }
            >
              {busy ? "Sending" : "Send plan"}
            </button>
            <button
              type="button"
              className={surfaceStyles.textBtn}
              onClick={() => setPaidOpen(!paidOpen)}
            >
              Already paid
            </button>
          </div>
          {paidOpen && (
            <div className={p.form}>
              <label className={p.field}>
                Razorpay payment ID
                <input
                  className={s.input}
                  value={paymentId}
                  maxLength={40}
                  placeholder="pay_..."
                  onChange={(e) => setPaymentId(e.target.value)}
                />
              </label>
              <div className={p.actions}>
                <button
                  type="button"
                  className={p.btnQuiet}
                  disabled={!planId || !paymentId.trim() || busy}
                  onClick={() => {
                    if (!/^pay_\w{6,}$/.test(paymentId.trim()))
                      return setProblem("A payment ID starts with pay_.");
                    run(() =>
                      recordSale(lead.id, {
                        planId,
                        paymentId: paymentId.trim(),
                        coachPreference: "",
                        note: "",
                      }),
                    );
                  }}
                >
                  Start plan
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {problem && (
        <p className={s.problem} role="alert">
          {problem}
        </p>
      )}
    </section>
  );
}

function LinkWaiting({
  link,
  mobile,
  busy,
  onCopy,
  onCheck,
  onCancel,
}: {
  link: PaymentLink;
  mobile: string;
  busy: boolean;
  onCopy: () => void;
  onCheck: () => void;
  onCancel: () => void;
}) {
  const words = `Your inrange plan (${link.planName}, ${formatRupees(link.amountRupees)}). Pay here: ${link.url}`;
  return (
    <div className={p.form}>
      <div>
        <p className={`${p.big} num`}>
          {link.planName}, {formatRupees(link.amountRupees)}
        </p>
        <p className={surfaceStyles.muted}>
          Waiting for payment. The plan starts when they pay.
        </p>
      </div>
      <label className={p.field}>
        Payment link
        <input
          className={`${s.input} num`}
          readOnly
          value={link.url}
          onFocus={(e) => e.target.select()}
        />
      </label>
      <div className={p.actions}>
        <button type="button" className={p.btn} onClick={onCopy}>
          Copy link
        </button>
        <a
          className={p.btnQuiet}
          href={`https://wa.me/91${mobile}?text=${encodeURIComponent(words)}`}
          target="_blank"
          rel="noreferrer"
        >
          Send on WhatsApp
        </a>
        <button
          type="button"
          className={p.btnQuiet}
          disabled={busy}
          onClick={onCheck}
        >
          Check payment
        </button>
        <button
          type="button"
          className={surfaceStyles.textBtn}
          disabled={busy}
          onClick={onCancel}
        >
          Cancel link
        </button>
      </div>
    </div>
  );
}

/** The sales form: what the system knows, and the three things the salesperson adds. */
function SaleFormPanel({
  data,
  sale,
  onSaved,
}: {
  data: LeadDetail;
  sale: Sale;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [condition, setCondition] = useState(sale.condition ?? "");
  const [programme, setProgramme] = useState(sale.programme ?? "");
  const [note, setNote] = useState(sale.note ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await saveSaleForm(data.lead.id, {
        condition,
        programme,
        note: note.trim(),
      });
      toast("Sales form saved");
      onSaved();
    } catch (caught) {
      toast(errorMessage(caught, "Not saved. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const pick = (
    label: string,
    value: string,
    set: (v: string) => void,
    options: string[],
  ) => (
    <label className={p.field}>
      {label}
      <select
        className={s.input}
        value={value}
        onChange={(e) => set(e.target.value)}
      >
        <option value="">Choose</option>
        {/* an older form's own words stay choosable */}
        {value && !options.includes(value) && <option>{value}</option>}
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );

  return (
    <section className={surfaceStyles.panel} aria-labelledby="form-h">
      <div className={p.headRow}>
        <h2 id="form-h" className={surfaceStyles.h2}>
          Sales form
        </h2>
        <span
          className={surfaceStyles.pill}
          data-tone={sale.submittedAt ? "ok" : "new"}
        >
          {sale.submittedAt
            ? `Submitted ${shortDate(sale.submittedAt)}`
            : "To fill in"}
        </span>
      </div>
      <dl className={s.facts}>
        <div>
          <dt>Customer</dt>
          <dd>{data.lead.name}</dd>
        </div>
        <div>
          <dt>Number</dt>
          <dd className="num">{spacedMobile(data.lead.mobile)}</dd>
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
          <dd>{sale.salesperson ?? data.lead.salesperson ?? "Not on record"}</dd>
        </div>
        <div>
          <dt>Doctor</dt>
          <dd>{data.lead.doctors ?? "None yet"}</dd>
        </div>
      </dl>
      <div className={p.form}>
        {pick("Medical condition", condition, setCondition, CONDITIONS)}
        {pick("Programme", programme, setProgramme, PROGRAMMES)}
        <label className={p.field}>
          Remarks
          <textarea
            className={s.textarea}
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className={p.actions}>
          <button
            type="button"
            className={p.btn}
            disabled={busy || !condition || !programme}
            onClick={save}
          >
            {busy ? "Saving" : sale.submittedAt ? "Save changes" : "Submit"}
          </button>
        </div>
      </div>
    </section>
  );
}

/** After a call: how it went, a remark, when to call again; every note stays below. */
function CallsPanel({
  data,
  onSaved,
}: {
  data: LeadDetail;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [status, setStatus] = useState<CallStatus | null>(null);
  const [remark, setRemark] = useState("");
  const [followUpOn, setFollowUpOn] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await addLeadUpdate(data.lead.id, {
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
      toast(errorMessage(caught, "Not saved. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={surfaceStyles.panel} aria-labelledby="calls-h">
      <h2 id="calls-h" className={surfaceStyles.h2}>
        Call notes
      </h2>
      <div className={p.form}>
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
          placeholder="Remark"
          aria-label="Remark"
          onChange={(e) => setRemark(e.target.value)}
        />
        <DatePicker
          label="Call again on"
          value={followUpOn}
          min={toApiDate(new Date())}
          placeholder="Call again on"
          onChange={setFollowUpOn}
        />
        <div className={p.actions}>
          <button
            type="button"
            className={p.btnQuiet}
            disabled={busy || (!status && !remark.trim() && !followUpOn)}
            onClick={save}
          >
            {busy ? "Saving" : "Save note"}
          </button>
        </div>
      </div>
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
                    u.followUpOn && `Call again ${shortDate(u.followUpOn)}`,
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
  );
}

/** The one thing to do next, in a line. */
function nextWords(data: LeadDetail): { words: string; small?: string } {
  const { lead } = data;
  if (lead.formDue) return { words: "Fill in the sales form." };
  if (followUpDue(lead)) return { words: "Call them today." };
  if (lead.stage === "ON_PLAN")
    return { words: "Done. They are on a plan.", small: lead.planName! };
  if (lead.stage === "LINK_SENT")
    return {
      words: `Waiting for payment of ${formatRupees(lead.linkRupees!)}.`,
      small: "This page updates by itself when they pay.",
    };
  if (lead.nextCallAt)
    return {
      words: `Join the call: ${callWhen(lead.nextCallAt).toLowerCase()}.`,
      small: `${lead.nextCallDoctor ?? "The doctor"} goes first. Then you explain the plan.`,
    };
  if (lead.stage === "CONSULTED") return { words: "Send the plan." };
  return {
    words: `${STAGE_WORDS[lead.stage]}.`,
    small: "The care team books the consultation. Nothing for you yet.",
  };
}

export default function LeadPage({
  leadId,
  admin = false,
}: {
  leadId: string;
  admin?: boolean;
}) {
  const toast = useToast();
  const detail = useApiResource(`lead-${leadId}`, () => getLead(leadId));
  const plans = useApiResource("plans-on-sale", listPlansOnSale);
  const team = useApiResource(admin ? "salespeople" : null, listSalespeople);
  const data = detail.data?.lead.id === leadId ? detail.data : null;
  const lead = data?.lead;
  const waiting = lead?.stage === "LINK_SENT";
  const reload = detail.reload;

  // a link is waiting: the page asks again every 15 seconds (the server asks Razorpay), so a payment shows by itself
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, 15000);
    return () => clearInterval(timer);
  }, [waiting, reload]);

  const join = async (callId: string) => {
    // opened before the wait, so the browser treats the new tab as the person's own click
    const tab = window.open("", "_blank");
    try {
      (tab ?? window).location.assign(await getSalesCallLink(callId));
    } catch (caught) {
      tab?.close();
      toast(errorMessage(caught, "The call could not be opened."));
    }
  };

  const back = admin
    ? { href: "/admin/medicine?tab=sales", label: "Leads" }
    : { href: "/sales", label: "Leads" };

  if (detail.error && !data)
    return (
      <main className={surfaceStyles.page}>
        <BackLink {...back} />
        <ErrorNotice message={detail.error} onRetry={detail.reload} />
      </main>
    );
  if (!data || !lead)
    return (
      <main className={surfaceStyles.page}>
        <LoadingSkeleton />
      </main>
    );

  const at = ORDER.indexOf(lead.stage);
  const next = nextWords(data);
  const sellers = (team.data ?? []).filter((x) => x.active);

  return (
    <main className={surfaceStyles.page}>
      <div className={surfaceStyles.pageHead}>
        <BackLink {...back} />
        <h1>{lead.name}</h1>
        <p className="num">
          <a href={`tel:+91${lead.mobile}`}>{spacedMobile(lead.mobile)}</a>
          {lead.email ? `, ${lead.email}` : ""}
        </p>
      </div>

      <ol className={p.steps} aria-label="Where they are">
        {STEPS.map((step, i) => {
          const from = ORDER.indexOf(step.from);
          const nextFrom =
            i + 1 < STEPS.length ? ORDER.indexOf(STEPS[i + 1].from) : 99;
          return (
            <li
              key={step.label}
              data-done={at >= from}
              aria-current={at >= from && at < nextFrom ? "step" : undefined}
            >
              {step.label}
            </li>
          );
        })}
      </ol>

      <div className={p.next}>
        <p>
          {next.words}
          {next.small && <small>{next.small}</small>}
        </p>
        {lead.nextCallId && (
          <button
            type="button"
            className={p.btnLight}
            onClick={() => join(lead.nextCallId!)}
          >
            Join the call
          </button>
        )}
      </div>

      <div className={p.cols}>
        <div className={p.col}>
          <PlanPanel
            key={`plan-${data.links[0]?.id ?? ""}-${lead.planName ?? ""}`}
            data={data}
            plans={plans.data ?? []}
            admin={admin}
            onChanged={reload}
          />
          {data.sale && (
            <SaleFormPanel
              key={`form-${data.sale.submittedAt}`}
              data={data}
              sale={data.sale}
              onSaved={reload}
            />
          )}
          <CallsPanel data={data} onSaved={reload} />
        </div>

        <div className={p.col}>
          <section className={surfaceStyles.panel} aria-labelledby="facts-h">
            <h2 id="facts-h" className={surfaceStyles.h2}>
              Details
            </h2>
            <dl className={s.facts}>
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
                          toast("Saved");
                          reload();
                        } catch (caught) {
                          toast(errorMessage(caught, "Not saved."));
                        }
                      }}
                    >
                      <option value="">Not assigned</option>
                      {lead.salespersonId &&
                        !sellers.some((x) => x.id === lead.salespersonId) && (
                          <option value={lead.salespersonId} disabled>
                            {lead.salesperson} (not on the team)
                          </option>
                        )}
                      {sellers.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.fullName}
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>
              )}
              <div>
                <dt>Doctor</dt>
                <dd>{lead.doctors ?? "None yet"}</dd>
              </div>
              <div>
                <dt>Signed up</dt>
                <dd className="num">{shortDate(lead.createdAt)}</dd>
              </div>
              <div>
                <dt>BMI</dt>
                <dd className="num">{lead.bmi ?? "Not given"}</dd>
              </div>
              <div>
                <dt>Blood test</dt>
                <dd>{reportWords(lead)}</dd>
              </div>
              <div>
                <dt>Consultation</dt>
                <dd>
                  {data.consultations.length === 0 && "Not booked"}
                  {data.consultations.slice(0, 3).map((a) => (
                    <span key={a.id} className={`${s.lineItem} num`}>
                      {when(a.startsAt)}, {a.doctorName}. {CONSULT[a.status]}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt>Prescription</dt>
                <dd className="num">
                  {lead.prescriptionSentAt
                    ? `Sent ${shortDate(lead.prescriptionSentAt)}`
                    : "Not sent"}
                </dd>
              </div>
              {lead.prescriptionSentAt && (
                <div>
                  <dt>GLP-1 prescribed</dt>
                  <dd>{lead.glp1Prescribed ? "Yes" : "No"}</dd>
                </div>
              )}
              {data.condition && (
                <div>
                  <dt>Doctor wrote</dt>
                  <dd>{data.condition}</dd>
                </div>
              )}
              <div>
                <dt>Coach</dt>
                <dd>{lead.coachName ?? "After the plan starts"}</dd>
              </div>
              {lead.fitnessCoachName && (
                <div>
                  <dt>Fitness coach</dt>
                  <dd>{lead.fitnessCoachName}</dd>
                </div>
              )}
              <div>
                <dt>Paid so far</dt>
                <dd className="num">
                  {lead.paidRupees ? formatRupees(lead.paidRupees) : "Nothing"}
                </dd>
              </div>
            </dl>
          </section>

          {data.payments.length > 0 && (
            <section className={surfaceStyles.panel} aria-labelledby="pay-h">
              <h2 id="pay-h" className={surfaceStyles.h2}>
                Payments
              </h2>
              <ol className={s.timeline}>
                {data.payments.map((pay, i) => (
                  <li key={i}>
                    <time dateTime={pay.paidAt}>{shortDate(pay.paidAt)}</time>
                    <span>
                      <strong className="num">
                        {formatRupees(pay.amountRupees)}, {pay.title}
                      </strong>
                      {pay.paymentId && (
                        <span className={`${s.reply} num`}>{pay.paymentId}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
