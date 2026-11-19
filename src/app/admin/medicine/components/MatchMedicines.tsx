"use client";

/*
  A "Match a medicine" task (doctor portal v2): the doctor typed a medicine that is not on the master list.
  For each such line, find the real item and tap it. The line takes that item; while the prescription is
  current and the pharmacy sells it, its packs join the patient's order. The task closes when every line
  is matched. The patient's PDF stays as the doctor signed it. Data: GET and POST
  /api/admin/medicine/tasks/:id/unmatched|match, GET /api/medicines/search.
*/

import { useEffect, useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { errorMessage } from "@/lib/http/apiClient";
import { searchMedicines } from "@/services/consultationService";
import { getUnmatched, matchMedicine } from "@/services/medicineOpsService";
import type { MedicineSearch } from "@/types/consultation";
import type { UnmatchedLine } from "@/types/medicineOps";
import s from "./Medicine.module.css";

function MatchLine({
  taskId,
  line,
  onMatched,
}: {
  taskId: string;
  line: UnmatchedLine;
  onMatched: (left: number) => void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState(
    line.name.replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml)\b/gi, "").trim(),
  );
  const [found, setFound] = useState<MedicineSearch | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) return;
    const stale = new AbortController();
    const timer = window.setTimeout(() => {
      searchMedicines(q, stale.signal)
        .then(setFound)
        .catch(() => {});
    }, 180);
    return () => {
      stale.abort();
      clearTimeout(timer);
    };
  }, [q]);

  const items = found ? [...found.matches, ...found.didYouMean] : [];
  return (
    <li className={s.matchLine}>
      <p>
        <strong>&ldquo;{line.name}&rdquo;</strong>
        <span>
          {[
            line.dose,
            line.frequencyWords,
            line.duration && `for ${line.duration}`,
          ]
            .filter(Boolean)
            .join(", ")}
        </span>
      </p>
      <input
        className={s.input}
        value={query}
        maxLength={60}
        aria-label={`Find "${line.name}" on the list`}
        placeholder="Search the list"
        onChange={(e) => setQuery(e.target.value)}
      />
      {q.length >= 2 && found && items.length === 0 && (
        <p className={s.sub}>
          Nothing on the list is close. Add the item to the master list first.
        </p>
      )}
      {items.length > 0 && (
        <ul className={s.matchResults}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={s.matchResult}
                disabled={busy !== null}
                onClick={async () => {
                  setBusy(item.id);
                  try {
                    const left = await matchMedicine(
                      taskId,
                      line.index,
                      item.id,
                    );
                    toast(`Matched to ${item.name}`);
                    onMatched(left);
                  } catch (caught) {
                    toast(
                      errorMessage(caught, "That was not matched. Try again."),
                    );
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                <strong>{busy === item.id ? "Matching" : item.name}</strong>
                <span>
                  {item.molecule}
                  {item.orderable
                    ? ""
                    : ". Not sold by our pharmacy yet: it will not reach the order"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function MatchMedicines({
  taskId,
  onDone,
}: {
  taskId: string;
  onDone: () => void;
}) {
  const lines = useApiResource(`unmatched-${taskId}`, () =>
    getUnmatched(taskId),
  );
  if (lines.error && !lines.data)
    return <ErrorNotice message={lines.error} onRetry={lines.reload} />;
  if (!lines.data) return <LoadingSkeleton />;
  if (lines.data.length === 0)
    return <p className={s.sub}>Every medicine is matched.</p>;
  return (
    <fieldset className={s.section}>
      <legend className={s.sectionHead}>Match to the list</legend>
      <ul className={s.matchLines}>
        {lines.data.map((line) => (
          <MatchLine
            key={line.index}
            taskId={taskId}
            line={line}
            onMatched={(left) => (left === 0 ? onDone() : lines.reload())}
          />
        ))}
      </ul>
    </fieldset>
  );
}
