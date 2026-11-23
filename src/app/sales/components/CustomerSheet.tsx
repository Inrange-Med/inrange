"use client";

/*
  One customer, for their salesperson (23 Nov 2026 call): who they are, their doctor and coach, their calls
  (Join opens the video call in a new tab: the salesperson comes in after the doctor), what the doctor found
  and prescribed, and the plan. The sales form makes a payment link; when the customer pays it the plan
  starts by itself. A payment already made another way (a link from the Razorpay dashboard) is entered by
  its Razorpay payment ID, and the plan starts once Razorpay confirms it. Nothing here shows reports, notes
  or the prescription's PDF, and opening the sheet is logged.
*/

import { useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Sheet from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/ToastProvider";
import PaymentLinks from "@/features/payment-links/PaymentLinks";
import { when } from "@/features/medicine-queue/words";
import { useApiResource } from "@/hooks/useApiResource";
import { shortDate } from "@/lib/format/dateTime";
import { spacedMobile } from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import {
  actOnSalesLink,
  getCustomer,
  getSalesCallLink,
  listPlansOnSale,
  makeSalesLink,
  recordSale,
} from "@/services/salesService";
import type { PlanOnSale, SalesCustomer } from "@/types/sales";
import surfaceStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

const STATUS: Record<SalesCustomer["consultations"][number]["status"], string> =
  {
    Booked: "Booked",
    InProgress: "In progress",
    Completed: "Done",
    NoShow: "No one joined",
  };

/** A payment the customer already made another way: its Razorpay payment ID starts the plan once Razorpay confirms it. */
function PaidAlready({
  customerId,
  plans,
  onSaved,
}: {
  customerId: string;
  plans: PlanOnSale[];
  onSaved: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [coachPreference, setCoachPreference] = useState("");
  const [note, setNote] = useState("");
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
        await recordSale(customerId, {
          planId,
          paymentId: paymentId.trim(),
          coachPreference: coachPreference.trim(),
          note: note.trim(),
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
      <input
        className={s.input}
        value={coachPreference}
        maxLength={200}
        placeholder="The coach they asked for (language, timing), if any"
        aria-label="The kind of coach the customer asked for"
        onChange={(e) => setCoachPreference(e.target.value)}
      />
      <input
        className={s.input}
        value={note}
        maxLength={1000}
        placeholder="Remarks from the sale, if any"
        aria-label="Remarks from the sale"
        onChange={(e) => setNote(e.target.value)}
      />
      <span className={surfaceStyles.muted}>
        The amount comes from Razorpay, and the plan starts once Razorpay
        confirms the payment. Paid some other way? Ask admin to record it.
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

export default function CustomerSheet({
  customerId,
  onClose,
  onChanged,
}: {
  customerId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const customer = useApiResource(
    customerId ? `sales-customer-${customerId}` : null,
    () => getCustomer(customerId!),
  );
  const plans = useApiResource("plans-on-sale", listPlansOnSale);
  // the last customer stays loaded while the next one loads: never show or act on them
  const data = customer.data?.patient.id === customerId ? customer.data : null;
  const refresh = () => {
    customer.reload();
    onChanged();
  };

  const join = async (id: string) => {
    // opened before the wait, so the browser treats the new tab as the person's own click
    const tab = window.open("", "_blank");
    try {
      const url = await getSalesCallLink(id);
      (tab ?? window).location.assign(url);
    } catch (caught) {
      tab?.close();
      toast(errorMessage(caught, "The call could not be opened."));
    }
  };

  return (
    <Sheet
      open={customerId !== null}
      onClose={onClose}
      title={data?.patient.name ?? "Customer"}
    >
      {customer.error && !data ? (
        <ErrorNotice message={customer.error} onRetry={customer.reload} />
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
            {(data.patient.age || data.patient.gender) && (
              <div>
                <dt>About</dt>
                <dd>
                  {[
                    data.patient.age && `${data.patient.age} years`,
                    data.patient.gender,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </div>
            )}
            <div>
              <dt>Doctor</dt>
              <dd>{data.patient.doctors.join(", ") || "No doctor yet"}</dd>
            </div>
            <div>
              <dt>Coach</dt>
              <dd>
                {[
                  data.patient.coachName,
                  data.patient.fitnessCoachName &&
                    `${data.patient.fitnessCoachName} (fitness)`,
                ]
                  .filter(Boolean)
                  .join(", ") || "Assigned once the plan starts"}
              </dd>
            </div>
            {data.prescription && (
              <div>
                <dt>Prescription</dt>
                <dd>
                  {data.prescription.diagnosis && (
                    <span className={s.lineItem}>
                      {data.prescription.diagnosis}
                    </span>
                  )}
                  <span className={s.lineItem}>
                    {data.prescription.medicines.join(", ") ||
                      "No medicines on it"}
                  </span>
                  <span className={`${s.lineItem} ${surfaceStyles.muted}`}>
                    {data.prescription.doctorName}
                    {data.prescription.sentAt
                      ? `, ${shortDate(data.prescription.sentAt)}`
                      : ""}
                    . For one month.
                  </span>
                </dd>
              </div>
            )}
            <div>
              <dt>Plan</dt>
              <dd>
                {data.plan && (
                  <span className={s.lineItem}>
                    {data.plan.name}, until {shortDate(data.plan.endsAt)}
                  </span>
                )}
                {!data.plan && data.links.length === 0 && (
                  <span className={s.lineItem}>No plan yet</span>
                )}
                <PaymentLinks
                  key={data.patient.id}
                  links={data.links}
                  plans={plans.data ?? []}
                  canMake={!data.plan}
                  onMake={(form) => makeSalesLink(data.patient.id, form)}
                  onAct={(id, action) =>
                    actOnSalesLink(id, action === "cancel" ? "cancel" : "check")
                  }
                  onChanged={refresh}
                />
                {!data.plan && (
                  <PaidAlready
                    key={`paid-${data.patient.id}`}
                    customerId={data.patient.id}
                    plans={plans.data ?? []}
                    onSaved={refresh}
                  />
                )}
              </dd>
            </div>
          </dl>

          <section className={s.section} aria-label="Calls">
            <h3 className={s.sectionHead}>Calls</h3>
            {data.consultations.length === 0 ? (
              <p className={surfaceStyles.empty}>
                No consultation booked yet. Admin books it and you see it here.
              </p>
            ) : (
              <ol className={s.timeline}>
                {data.consultations.map((a) => (
                  <li key={a.id}>
                    <time dateTime={a.startsAt}>{when(a.startsAt)}</time>
                    <span>
                      <strong>
                        {a.doctorName},{" "}
                        {a.visitType === "FOLLOW_UP"
                          ? "follow-up"
                          : "first consultation"}
                        . {STATUS[a.status]}
                      </strong>
                      {a.joinable && (
                        <span className={s.chips}>
                          <button
                            type="button"
                            className={s.chip}
                            onClick={() => join(a.id)}
                          >
                            Join the call
                          </button>
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </Sheet>
  );
}
