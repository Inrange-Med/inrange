/**
 * The first part of adding an address: use the current location, or search the area and choose the
 * right place. Matches update as the patient types; the first is the best match (Enter picks it).
 */

import {
  CaretRight,
  NavigationArrow,
  WarningCircle,
} from "@phosphor-icons/react";
import type { LabPlaceMatch } from "@/types/labTest";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "../LabBookingFlow.module.css";

export default function AddressPlaceSearch({
  query,
  onQuery,
  matches,
  searching,
  locating,
  onLocate,
  checkingEloc,
  onPick,
  error,
  onCancel,
}: {
  query: string;
  onQuery: (query: string) => void;
  matches: LabPlaceMatch[] | null;
  searching: boolean;
  locating: boolean;
  /** null when the current location cannot be used */
  onLocate: (() => void) | null;
  checkingEloc: string | null;
  onPick: (match: LabPlaceMatch) => void;
  error: string | null;
  onCancel?: () => void;
}) {
  return (
    <>
      {onLocate && (
        <button
          type="button"
          className={`btn btn--ghost ${styles.pill}`}
          onClick={onLocate}
          aria-busy={locating}
          disabled={locating}
        >
          <NavigationArrow size={17} weight="bold" aria-hidden="true" />
          <span>{locating ? "Finding you…" : "Use my current location"}</span>
        </button>
      )}
      <label className={formStyles.field}>
        <span className={formStyles.label}>Search your area</span>
        <input
          className={formStyles.input}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && matches?.[0]) onPick(matches[0]);
          }}
          placeholder="Society, building, street or PIN code"
          autoComplete="off"
          enterKeyHint="search"
          aria-busy={searching}
          autoFocus
        />
      </label>
      {searching && !matches?.length && (
        <p className={styles.foot} aria-live="polite">
          Searching…
        </p>
      )}
      {!searching && matches && matches.length === 0 && (
        <p className={styles.foot} aria-live="polite">
          Nothing found. Try the society, sector or PIN code.
        </p>
      )}
      {matches && matches.length > 0 && (
        <ul className={styles.packets}>
          {matches.map((match, index) => (
            <li key={match.eloc}>
              <button
                type="button"
                className={styles.packet}
                data-suggested={index === 0 || undefined}
                onClick={() => onPick(match)}
                aria-busy={checkingEloc === match.eloc}
              >
                <span className={styles.packetText}>
                  <strong className={styles.strong}>{match.name}</strong>
                  <span className={styles.packetWhat}>{match.address}</span>
                </span>
                {checkingEloc === match.eloc ? (
                  <i
                    className={`${formStyles.spin} ${styles.spin}`}
                    aria-label="Checking"
                  />
                ) : (
                  <CaretRight
                    size={17}
                    className={styles.go}
                    aria-hidden="true"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className={formStyles.err} role="alert">
          <WarningCircle size={16} weight="bold" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      {onCancel && (
        <button
          type="button"
          className={`btn btn--ghost ${styles.pill}`}
          onClick={onCancel}
        >
          Use a saved address
        </button>
      )}
    </>
  );
}
