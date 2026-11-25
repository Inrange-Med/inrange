"use client";

/*
  To call (23 Nov 2026 call): about a third of patients stop somewhere and move on only when someone calls
  them. Each list is one place they stop, named for what the call is for:
    Book blood test     paid, and no blood test booked (they did not book in their two days)
    Not paid yet        signed up and gone quiet: a call to bring them back
    Rebook blood test   a paid test that is not happening as booked: a new time, at no charge
    Book consultation   the report is in: call and book the doctor, with the salesperson
    No plan yet         seen by the doctor, not on a plan: the salesperson's to close with a payment link
    Assign a coach      on a plan with no health coach
  Only the lists with someone in them show. A row opens the patient, where each of these is done. The
  follow-up after 25 days is under Calls.
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
  rows,
  words,
  onOpen,
}: {
  id: string;
  title: string;
  rows: Row[];
  /** what the row says under the name, and a pill on its right when there is something more to know */
  words: (row: Row) => { sub: string; pill?: string | false };
  onOpen: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section className={adminStyles.panel} aria-labelledby={`${id}-h`}>
      <div className={adminStyles.panelHead}>
        <h2 id={`${id}-h`} className={adminStyles.h2}>
          {title}
        </h2>
        <span className={`${adminStyles.count} num`}>{rows.length}</span>
      </div>
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
                    <span>{sub}</span>
                    {row.salesperson && <span>Sales: {row.salesperson}</span>}
                  </span>
                </button>
                {pill && (
                  <span className={s.side}>
                    <span className={adminStyles.pill} data-tone="new">
                      {pill}
                    </span>
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
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
  const nobody = ![
    lab && p.paidNoTest,
    lab && p.bloodTest,
    lab && p.labProblem,
    dc && p.consultation,
    admin && p.plan,
    admin && p.coach,
  ].some((rows) => rows && rows.length > 0);

  return (
    <div className={s.sheet}>
      {nobody && (
        <section className={adminStyles.panel} aria-label="To call">
          <p className={adminStyles.empty}>Nobody to call.</p>
        </section>
      )}
      {lab && (
        <Bucket
          id="call-paid"
          title="Book blood test"
          rows={p.paidNoTest}
          words={(row) => ({
            sub: row.since ? `Paid ${shortDate(row.since)}` : "Paid",
          })}
          onOpen={onOpenPatient}
        />
      )}
      {lab && (
        <Bucket
          id="call-test"
          title="Not paid yet"
          rows={p.bloodTest}
          words={(row) => ({
            sub: `Signed up ${shortDate(row.since)}`,
            pill: row.holding && "Time held",
          })}
          onOpen={onOpenPatient}
        />
      )}
      {lab && (
        <Bucket
          id="call-lab"
          title="Rebook blood test"
          rows={p.labProblem}
          words={(row) => ({ sub: row.why })}
          onOpen={onOpenPatient}
        />
      )}
      {dc && (
        <Bucket
          id="call-consult"
          title="Book consultation"
          rows={p.consultation}
          words={(row) => ({
            sub:
              row.stage === "UNDER_REVIEW"
                ? "Report not reviewed yet"
                : `Reviewed ${shortDate(row.since)}`,
          })}
          onOpen={onOpenPatient}
        />
      )}
      {admin && (
        <Bucket
          id="call-plan"
          title="No plan yet"
          rows={p.plan}
          words={(row) => ({
            sub: `Consultation ${shortDate(row.lastOn)}`,
            pill: row.linkWaiting && "Link sent",
          })}
          onOpen={onOpenPatient}
        />
      )}
      {admin && (
        <Bucket
          id="call-coach"
          title="Assign a coach"
          rows={p.coach}
          words={(row) => ({
            sub: `${row.planName}, started ${shortDate(row.since)}`,
          })}
          onOpen={onOpenPatient}
        />
      )}
    </div>
  );
}
