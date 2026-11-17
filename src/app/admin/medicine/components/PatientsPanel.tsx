"use client";

/*
  Everyone with a prescription or an order, newest activity first, found by name or number. A row says
  the last order's step, when the medicines run out, how doses are going and who coaches them. Admins
  manage the coaches from here.
*/

import { useDeferredValue, useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useApiResource } from "@/hooks/useApiResource";
import { shortDate } from "@/lib/format/dateTime";
import { listPatients } from "@/services/medicineOpsService";
import CoachesSheet from "./CoachesSheet";
import { ORDER_WORDS } from "./words";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";
import s from "./Medicine.module.css";

export default function PatientsPanel({
  isAdmin,
  version,
  onOpenPatient,
}: {
  isAdmin: boolean;
  /** bumped by the page after a change in the patient sheet (a coach assigned), so the rows reload */
  version: number;
  onOpenPatient: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim());
  const patients = useApiResource(`medicine-patients-${q}-${version}`, () =>
    listPatients(q),
  );
  const [coaches, setCoaches] = useState(false);

  return (
    <section className={adminStyles.panel} aria-labelledby="patients-h">
      <div className={adminStyles.panelHead}>
        <h2 id="patients-h" className={adminStyles.h2}>
          Patients
        </h2>
        {isAdmin && (
          <button
            type="button"
            className={adminStyles.textBtn}
            onClick={() => setCoaches(true)}
          >
            Health coaches
          </button>
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
          {q
            ? "No patient matches that."
            : "No one has a prescription yet. Patients appear here once a doctor signs one."}
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
                      {p.coachName ?? "No coach"}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {isAdmin && (
        <CoachesSheet open={coaches} onClose={() => setCoaches(false)} />
      )}
    </section>
  );
}
