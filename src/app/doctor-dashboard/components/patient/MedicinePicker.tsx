"use client";

/*
  Finding a medicine on the master list (PDPL's medicines and supplements; GET /api/medicines/search).
  The search forgives case, spaces and words like tab or tablet, so "rybelsus" finds "Tablet Rybelsus
  3 mg". Nothing found: "Did you mean" comes first, then adding the name as typed, which says plainly
  that it prints but cannot be ordered until our team matches it (that stops duplicates in the list).
*/

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { searchMedicines } from "@/services/consultationService";
import type { ListItem, MedicineSearch } from "@/types/consultation";
import styles from "./PatientPage.module.css";

export default function MedicinePicker({
  first,
  onPick,
}: {
  /** no medicine yet: the search shows at once; after that, behind "Add another medicine" */
  first: boolean;
  onPick: (item: ListItem | null, typed?: string) => void;
}) {
  const [open, setOpen] = useState(first);
  const [query, setQuery] = useState("");
  // each answer keeps the words it answers, so a slower, older answer is never shown or picked
  const [found, setFound] = useState<(MedicineSearch & { q: string }) | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const q = query.trim();
  const showing = open || first;

  useEffect(() => {
    if (!showing) return;
    const stale = new AbortController();
    const timer = window.setTimeout(() => {
      searchMedicines(q, stale.signal)
        .then((result) => {
          setFound({ ...result, q });
          setFailed(false);
        })
        .catch(() => !stale.signal.aborted && setFailed(true));
    }, q ? 180 : 0);
    return () => {
      stale.abort();
      clearTimeout(timer);
    };
  }, [q, showing]);

  const pick = (item: ListItem | null) => {
    onPick(item, item ? undefined : q);
    setQuery("");
    setFound(null);
    setOpen(false);
  };

  if (!showing) {
    return (
      <button
        type="button"
        className={styles.addLine}
        onClick={() => {
          setOpen(true);
          window.setTimeout(() => input.current?.focus(), 30);
        }}
      >
        <Plus size={18} aria-hidden="true" />
        Add another medicine
      </button>
    );
  }

  // between keystrokes the last list stays up, so the dropdown never blinks shut
  const results = found;

  return (
    <div className={styles.picker}>
      <label className={styles.searchField}>
        <MagnifyingGlass size={18} aria-hidden="true" />
        <span className="sr-only">Search medicines and supplements</span>
        <input
          ref={input}
          value={query}
          maxLength={60}
          placeholder="Pick below or type to search"
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results?.matches[0]) {
              e.preventDefault();
              pick(results.matches[0]);
            }
            if (e.key === "Escape" && !first) setOpen(false);
          }}
        />
      </label>

      {failed && (
        <p className={styles.searchNote}>
          The list did not load. Keep typing to try again.
        </p>
      )}

      {results && results.matches.length > 0 && (
        <ul className={styles.results} aria-label="Matches on the list">
          {results.matches.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles.result}
                onClick={() => pick(item)}
              >
                <strong>{item.name}</strong>
                <span>
                  {[item.molecule, item.form].filter(Boolean).join(", ")}
                  {!item.orderable &&
                    ". Prints only: our pharmacy does not sell it yet"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {results && q && found?.q === q && results.matches.length === 0 && (
        <div className={styles.noMatch}>
          {results.didYouMean.length > 0 ? (
            <>
              <p className={styles.searchNote}>
                Not on the list. Did you mean:
              </p>
              <ul className={styles.results}>
                {results.didYouMean.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={styles.result}
                      onClick={() => pick(item)}
                    >
                      <strong>{item.name}</strong>
                      <span>
                        {[item.molecule, item.form].filter(Boolean).join(", ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={styles.searchNote}>
              &ldquo;{q}&rdquo; is not on the list.
            </p>
          )}
          <button
            type="button"
            className={`btn btn--ghost ${styles.typed}`}
            onClick={() => pick(null)}
          >
            Add &ldquo;{q}&rdquo; as typed
          </button>
          <p className={styles.searchNote}>
            It prints on the prescription. It can&apos;t be ordered until our
            team matches it to the list.
          </p>
        </div>
      )}

      {!first && (
        <button
          type="button"
          className={styles.textBtn}
          onClick={() => {
            setOpen(false);
            setQuery("");
          }}
        >
          Cancel
        </button>
      )}
    </div>
  );
}
