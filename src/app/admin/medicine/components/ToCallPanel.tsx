"use client";

/*
  To call (23 Nov 2026 call): about a third of patients stop somewhere and move on only when someone calls
  them. Each list is one place they stop, with what the call is for:
    paid           paid, and no blood test booked (they did not book in their two days): book it on the call
    not paid       signed up and gone quiet: a call to bring them back
    new time       a paid test that is not happening as booked: book a new time, at no charge
    consultation   the report is in: call and book the doctor, with the salesperson
    plan           seen by the doctor, not on a plan: the salesperson's to close with a payment link
    coach          on a plan with no health coach: assign one so the first call can happen
  A row opens the patient, where each of these is done. The follow-up after 25 days is under Calls.
*/

import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useApiResource } from "@/hooks/useApiResource";

import { shortDate } from "@/lib/format/dateTime";
import { spacedMobile } from "@/lib/format/phone";
import { getPipeline } from "@/services/medicineOpsService";
import type { PipelineRow } from "@/types/medicineOps";
import adminStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

function Bucket<Row extends PipelineRow>({
  id,
  title,
  empty,
  rows,
  words,
  onOpen,
}: {
  id: string;
  title: string;
  empty: string;
  rows: Row[];
  /** what the row says under the name, and the pill on its right */
  words: (row: Row) => { sub: string[]; pill: string };
  onOpen: (id: string) => void;
}) {
  return (
    <section className={adminStyles.panel} aria-labelledby={`${id}-h`}>
      <div className={adminStyles.panelHead}>
        <h2 id={`${id}-h`} className={adminStyles.h2}>
          {title}
          {rows.length > 0 && <span className="num"> {rows.length}</span>}
        </h2>
      </div>
      {rows.length === 0 ? (
        <p className={adminStyles.empty}>{empty}</p>
      ) : (
        <ul className={s.rows}>
          {rows.map((row, i) => {
            const { sub, pill } = words(row);
            return (
              <li key={`${row.patientId}-${i}`}>
                <div className={s.row}>
                  <button
                    type="button"
                    className={s.open}
                    onClick={() => onOpen(row.patientId)}
                  >
                    <span className={s.what}>{row.patientName}</span>
                    <span className={`${s.sub} num`}>
                      <span>{spacedMobile(row.patientMobile)}</span>
                      {sub.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                      {row.salesperson && <span>Sales: {row.salesperson}</span>}
                    </span>
                  </button>
                  <span className={s.side}>
                    <span className={adminStyles.pill} data-tone="new">
                      {pill}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function ToCallPanel({
  version,
  admin,
  lab,
  dc,
  onOpenPatient,
}: {
  version: number;
  /** each desk sees its own lists (the API sends only those); an admin, all of them */
  admin: boolean;
  lab: boolean;
  dc: boolean;
  onOpenPatient: (id: string) => void;
}) {
  const pipeline = useApiResource(`admin-pipeline-${version}`, getPipeline);

  if (pipeline.error && !pipeline.data)
    return <ErrorNotice message={pipeline.error} onRetry={pipeline.reload} />;
  if (!pipeline.data) return <LoadingSkeleton />;
  const p = pipeline.data;

  return (
    <div className={s.sheet}>
      {lab && (
        <Bucket
          id="call-paid"
          title="Paid, blood test not booked"
          empty="Everyone who has paid has a blood test booked."
          rows={p.paidNoTest}
          words={(row) => ({
            sub: [row.since ? `Paid ${shortDate(row.since)}` : "Paid"],
            pill: "Call and book the test",
          })}
          onOpen={onOpenPatient}
        />
      )}
      {lab && (
        <Bucket
          id="call-test"
          title="Signed up, not paid"
          empty="Everyone who signed up has paid or sent a report."
          rows={p.bloodTest}
          words={(row) => ({
            sub: [`Signed up ${shortDate(row.since)}`],
            pill: row.holding ? "Time held, not paid" : "Call them",
          })}
          onOpen={onOpenPatient}
        />
      )}
      {lab && (
        <Bucket
          id="call-lab"
          title="Blood test needs a new time"
          empty="Every paid blood test is going ahead as booked."
          rows={p.labProblem}
          words={(row) => ({ sub: [row.why], pill: "Book a new time" })}
          onOpen={onOpenPatient}
        />
      )}
      {dc && (
        <Bucket
          id="call-consult"
          title="Report in, no consultation booked"
          empty="Everyone with a report has a consultation booked."
          rows={p.consultation}
          words={(row) => ({
            sub: [
              row.stage === "UNDER_REVIEW"
                ? "The review is still to be done (Reviews)"
                : `Reviewed ${shortDate(row.since)}`,
            ],
            pill: "Call and book the doctor",
          })}
          onOpen={onOpenPatient}
        />
      )}
      {admin && (
        <Bucket
          id="call-plan"
          title="Seen by the doctor, no plan"
          empty="Everyone seen in the last 60 days is on a plan."
          rows={p.plan}
          words={(row) => ({
            sub: [`Consultation ${shortDate(row.lastOn)}`],
            pill: row.linkWaiting
              ? "Link sent, not paid"
              : "Sales to follow up",
          })}
          onOpen={onOpenPatient}
        />
      )}
      {admin && (
        <Bucket
          id="call-coach"
          title="On a plan, no coach"
          empty="Everyone on a plan has a health coach."
          rows={p.coach}
          words={(row) => ({
            sub: [`${row.planName}, started ${shortDate(row.since)}`],
            pill: "Assign a coach",
          })}
          onOpen={onOpenPatient}
        />
      )}
    </div>
  );
}
