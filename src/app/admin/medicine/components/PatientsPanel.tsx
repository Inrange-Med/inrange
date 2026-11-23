"use client";

/*
  Every patient (a coach: their own), newest activity first, found by name or number, so admin can set the
  salesperson and put someone on a plan before they have a prescription. A row says the plan, the last
  order's step, when the medicines run out, how doses are going, their doctors, who sells to them and who
  coaches them. Admins manage the coaches and the sales team from here.
*/

import { useDeferredValue, useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useApiResource } from "@/hooks/useApiResource";
import { shortDate } from "@/lib/format/dateTime";
import { listPatients } from "@/services/medicineOpsService";
import CoachesSheet from "./CoachesSheet";
import SalesTeamSheet from "./SalesTeamSheet";
import { ORDER_WORDS } from "./words";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";
import s from "./Medicine.module.css";

export default function PatientsPanel({
  isAdmin,
  version,
  onOpenPatient,
  onChanged,
}: {
  isAdmin: boolean;
  /** bumped by the page after a change in the patient sheet (a coach assigned), so the rows reload */
  version: number;
  onOpenPatient: (id: string) => void;
  /** a salesperson renamed in the sales team sheet: the page reloads the rows */
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim());
  const patients = useApiResource(`medicine-patients-${q}-${version}`, () =>
    listPatients(q),
  );
  const [coaches, setCoaches] = useState(false);
  const [sales, setSales] = useState(false);

  return (
    <section className={adminStyles.panel} aria-labelledby="patients-h">
      <div className={adminStyles.panelHead}>
        <h2 id="patients-h" className={adminStyles.h2}>
          Patients
        </h2>
        {isAdmin && (
          <span className={s.headActions}>
            <button
              type="button"
              className={adminStyles.textBtn}
              onClick={() => setSales(true)}
            >
              Sales team
            </button>
            <button
              type="button"
              className={adminStyles.textBtn}
              onClick={() => setCoaches(true)}
            >
              Health coaches
            </button>
          </span>
        )}
      </div>
      <input
        className={s.search}
        type="search"
        value={query}
        placeholder="Name or mobile"
        aria-label="Find a patient by name or mobile"
        onChange={(e) => setQuery(e.target.value)}
      />
      {patients.error && !patients.data ? (
        <ErrorNotice message={patients.error} onRetry={patients.reload} />
      ) : !patients.data ? (
        <LoadingSkeleton />
      ) : patients.data.length === 0 ? (
        <p className={adminStyles.empty}>
          {q ? "No patient matches that." : "No patients yet."}
        </p>
      ) : (
        <ul className={s.rows}>
          {patients.data.map((p) => {
            const adherence =
              p.dosesResolved >= 3
                ? Math.round((p.dosesTaken / p.dosesResolved) * 100)
                : null;
            return (
              <li key={p.id}>
                <div className={s.row}>
                  <button
                    type="button"
                    className={s.open}
                    onClick={() => onOpenPatient(p.id)}
                  >
                    <span className={s.what}>{p.name}</span>
                    <span className={s.sub}>
                      {p.planName && <span>{p.planName}</span>}
                      <span>
                        {p.lastOrderStatus
                          ? `Last order: ${ORDER_WORDS[p.lastOrderStatus].toLowerCase()}`
                          : "Not ordered yet"}
                      </span>
                      {p.runOutOn && (
                        <span className="num">
                          Runs out {shortDate(p.runOutOn)}
                        </span>
                      )}
                      {adherence !== null && (
                        <span className="num">{adherence}% of doses taken</span>
                      )}
                      {p.doctors && <span>{p.doctors}</span>}
                      {!p.whatsapp && <span>WhatsApp off</span>}
                    </span>
                  </button>
                  <span className={s.side}>
                    {p.openTasks > 0 && (
                      <span className={adminStyles.pill} data-tone="new">
                        <span className="num">{p.openTasks}</span> to do
                      </span>
                    )}
                    <span className={adminStyles.muted}>
                      {[
                        p.salesperson && `Sales: ${p.salesperson}`,
                        p.coachName ?? "No coach",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {isAdmin && (
        <>
          <CoachesSheet open={coaches} onClose={() => setCoaches(false)} />
          <SalesTeamSheet
            open={sales}
            onClose={() => setSales(false)}
            onChanged={onChanged}
          />
        </>
      )}
    </section>
  );
}
