"use client";

/*
  Calls (23 Nov 2026 call): every consultation coming up, across patients, with its video links to send by
  any means; and the follow-up sheet: patients whose last consultation was 25 days ago or more with nothing
  booked, so the team calls them and books the next one with their own doctor. A row opens the patient,
  where the consultation is booked, moved or cancelled.
*/

import { useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useApiResource } from "@/hooks/useApiResource";
import { shortDate } from "@/lib/format/dateTime";
import { spacedMobile } from "@/lib/format/phone";
import { getCalls } from "@/services/medicineOpsService";
import { when } from "@/features/medicine-queue/words";
import CallLinksBlock from "./CallLinksBlock";
import adminStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

export default function CallsPanel({
  version,
  onOpenPatient,
}: {
  version: number;
  onOpenPatient: (id: string) => void;
}) {
  const calls = useApiResource(`admin-calls-${version}`, getCalls);
  const [linksFor, setLinksFor] = useState<string | null>(null);

  if (calls.error && !calls.data)
    return <ErrorNotice message={calls.error} onRetry={calls.reload} />;
  if (!calls.data) return <LoadingSkeleton />;
  const { upcoming, followUpsDue } = calls.data;

  return (
    <div className={s.sheet}>
      <section className={adminStyles.panel} aria-labelledby="calls-h">
        <div className={adminStyles.panelHead}>
          <h2 id="calls-h" className={adminStyles.h2}>
            Coming up
          </h2>
        </div>
        {upcoming.length === 0 ? (
          <p className={adminStyles.empty}>No consultations booked.</p>
        ) : (
          <ul className={s.rows}>
            {upcoming.map((a) => (
              <li key={a.id}>
                <div className={s.row}>
                  <button
                    type="button"
                    className={s.open}
                    onClick={() => onOpenPatient(a.patientId)}
                  >
                    <span className={`${s.what} num`}>
                      {when(a.startsAt)}: {a.patientName}
                    </span>
                    <span className={s.sub}>
                      <span>{a.doctorName}</span>
                      <span>
                        {a.visitType === "FOLLOW_UP"
                          ? "Follow-up"
                          : "First consultation"}
                      </span>
                      <span>
                        {a.salesperson
                          ? `Sales: ${a.salesperson}`
                          : "No salesperson"}
                      </span>
                      {a.status === "InProgress" && <span>In progress</span>}
                    </span>
                  </button>
                  <span className={s.side}>
                    <button
                      type="button"
                      className={s.chip}
                      aria-expanded={linksFor === a.id}
                      onClick={() =>
                        setLinksFor(linksFor === a.id ? null : a.id)
                      }
                    >
                      {linksFor === a.id ? "Hide links" : "Video links"}
                    </button>
                  </span>
                </div>
                {linksFor === a.id && (
                  <CallLinksBlock
                    consultationId={a.id}
                    patientName={a.patientName}
                    doctorName={a.doctorName}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={adminStyles.panel} aria-labelledby="due-h">
        <div className={adminStyles.panelHead}>
          <h2 id="due-h" className={adminStyles.h2}>
            Follow-up due
          </h2>
        </div>
        {followUpsDue.length === 0 ? (
          <p className={adminStyles.empty}>Nobody is due.</p>
        ) : (
          <ul className={s.rows}>
            {followUpsDue.map((p) => (
              <li key={p.patientId}>
                <div className={s.row}>
                  <button
                    type="button"
                    className={s.open}
                    onClick={() => onOpenPatient(p.patientId)}
                  >
                    <span className={s.what}>{p.patientName}</span>
                    <span className={s.sub}>
                      <span className="num">
                        {spacedMobile(p.patientMobile)}
                      </span>
                      <span className="num">
                        Last seen {shortDate(p.lastOn)}, {p.daysSince} days ago
                      </span>
                      {p.doctorName && <span>{p.doctorName}</span>}
                      {p.planName ? (
                        <span className="num">
                          {p.planName}
                          {p.consultsIncluded != null
                            ? `: ${p.consultsDone} of ${p.consultsIncluded} used`
                            : ""}
                        </span>
                      ) : (
                        <span>No plan</span>
                      )}
                    </span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
