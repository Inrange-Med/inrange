"use client";

/*
  /coach: the patients given to this coach (as health coach or fitness coach), and nobody else's. Whoever has
  waited longest for a call comes first. A row says the plan, the calls made against what it includes, and
  the last call; it opens the patient (CoachPatientSheet): the diet chart or exercise plan, the calls, the
  remarks for the doctor.
*/

import { useDeferredValue, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import { shortDate } from "@/lib/format/dateTime";
import { listCoachPatients } from "@/services/coachService";
import type { CoachPatientRow } from "@/types/coach";
import CoachPatientSheet from "./CoachPatientSheet";
import surfaceStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

/** "3 of 12 calls" for the side this coach is on (both, when they are both). */
function callWords(p: CoachPatientRow) {
  const part = (made: number, of: number | null, what: string) =>
    of != null ? `${made} of ${of} ${what}` : `${made} ${what}`;
  return [
    p.asHealth && part(p.healthCallsMade, p.coachCalls, "coach calls"),
    p.asFitness && part(p.fitnessCallsMade, p.fitnessCalls, "fitness calls"),
  ]
    .filter(Boolean)
    .join(", ");
}

export default function CoachView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const patientId = params.get("patient");
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim());
  const [version, setVersion] = useState(0);
  const patients = useApiResource(`coach-patients-${q}-${version}`, () =>
    listCoachPatients(q),
  );
  const open = (id: string | null) =>
    router.replace(id ? `${pathname}?patient=${id}` : pathname, {
      scroll: false,
    });

  return (
    <main className={surfaceStyles.page}>
      <PageHead
        className={surfaceStyles.pageHead}
        title="Your patients"
        sub="Their diet chart or exercise plan, the calls you have made, and your remarks for the doctor."
      />
      <section className={surfaceStyles.panel} aria-labelledby="patients-h">
        <div className={surfaceStyles.panelHead}>
          <h2 id="patients-h" className={surfaceStyles.h2}>
            Patients
          </h2>
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
          <p className={surfaceStyles.empty}>
            {q
              ? "No patient matches that."
              : "No patients yet. Admin gives them to you once their plan starts."}
          </p>
        ) : (
          <ul className={s.rows}>
            {patients.data.map((p) => (
              <li key={p.id}>
                <div className={s.row}>
                  <button
                    type="button"
                    className={s.open}
                    onClick={() => open(p.id)}
                  >
                    <span className={s.what}>{p.name}</span>
                    <span className={s.sub}>
                      <span>{p.planName ?? "No plan yet"}</span>
                      <span className="num">{callWords(p)}</span>
                      <span className="num">
                        {p.lastCallOn
                          ? `Last call ${shortDate(p.lastCallOn)}`
                          : "No call yet"}
                      </span>
                      {p.asHealth && !p.hasDiet && (
                        <span>No diet chart yet</span>
                      )}
                    </span>
                  </button>
                  <span className={s.side}>
                    {p.openTasks > 0 && (
                      <span className={surfaceStyles.pill} data-tone="new">
                        <span className="num">{p.openTasks}</span> to do
                      </span>
                    )}
                    <span className={surfaceStyles.muted}>
                      {p.asHealth && p.asFitness
                        ? "Health and fitness coach"
                        : p.asFitness
                          ? "Fitness coach"
                          : "Health coach"}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <CoachPatientSheet
        patientId={patientId}
        onClose={() => open(null)}
        onChanged={() => setVersion((v) => v + 1)}
      />
    </main>
  );
}
