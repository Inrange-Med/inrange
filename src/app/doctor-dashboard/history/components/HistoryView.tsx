"use client";

/*
  History (doctor portal v2 PRD): all past consultations, newest first, found by name and a date range
  (the last 30 days to start). Each row has the same state and button as Today. No patient phone
  numbers anywhere (17 Nov 2026 call). Data: GET /api/doctor/consultations/history (consultationService).
*/

import { useDeferredValue, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import { toApiDate } from "@/lib/format/dateTime";
import { getConsultationHistory } from "@/services/consultationService";
import ClinicSkeleton from "@/app/doctor-dashboard/components/ClinicSkeleton";
import ConsultationRow, {
  consultationListClass,
} from "@/app/doctor-dashboard/components/consultations/ConsultationRow";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "./HistoryView.module.css";

export default function HistoryView() {
  const [today] = useState(() => toApiDate(new Date()));
  const [from, setFrom] = useState(() =>
    toApiDate(new Date(Date.now() - 29 * 86_400_000)),
  );
  const [to, setTo] = useState(today);
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim());
  const history = useApiResource(`doctor-history-${from}-${to}-${q}`, () =>
    getConsultationHistory({ from, to, q }),
  );
  const rows = history.data?.consultations ?? null;
  const backwards = from > to;

  return (
    <main className={`${clinicStyles.page} ${styles.page}`}>
      <PageHead className={clinicStyles.pageHead} title="History" />

      <section className={clinicStyles.panel} aria-label="Past consultations">
        <div className={styles.filters}>
          <label className={styles.search}>
            <MagnifyingGlass size={18} aria-hidden="true" />
            <span className="sr-only">Find a patient by name</span>
            <input
              type="search"
              value={query}
              placeholder="Patient name"
              maxLength={60}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className={styles.date}>
            <span>From</span>
            <input
              type="date"
              value={from}
              max={today}
              onChange={(e) => e.target.value && setFrom(e.target.value)}
            />
          </label>
          <label className={styles.date}>
            <span>To</span>
            <input
              type="date"
              value={to}
              max={today}
              onChange={(e) => e.target.value && setTo(e.target.value)}
            />
          </label>
        </div>

        {backwards ? (
          <p className={clinicStyles.empty}>
            The start date is after the end date.
          </p>
        ) : history.error && !history.data ? (
          <ErrorNotice message={history.error} onRetry={history.reload} />
        ) : !rows || history.loading ? (
          <ClinicSkeleton titled={false} />
        ) : rows.length === 0 ? (
          <p className={clinicStyles.empty}>
            {q
              ? `No consultations with “${q}” in these dates.`
              : "No consultations in these dates."}
          </p>
        ) : (
          <>
            <p className={`${clinicStyles.muted} num`}>
              {rows.length}{" "}
              {rows.length === 1 ? "consultation" : "consultations"}
            </p>
            <ol className={consultationListClass}>
              {rows.map((row) => (
                <li key={row.id}>
                  <ConsultationRow
                    row={row}
                    withDay
                    onChanged={history.reload}
                  />
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </main>
  );
}
