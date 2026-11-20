/**
 * A price with the real price of the parts crossed out before it, and how much less that is ("55% off"): the
 * Nano plan and its add-on (20 Nov 2026, the way EZWeight shows it). Only a genuine reference price is ever
 * crossed out (the backend's mrpRupees); never a countdown or "lowest price ever" beside it.
 */

import { formatRupees } from "@/lib/format/money";
import styles from "../LabBookingFlow.module.css";

export const offPercent = (price: number, mrp: number | null | undefined) =>
  mrp && mrp > price ? Math.round((1 - price / mrp) * 100) : 0;

export default function WasNow({
  price,
  mrp,
  showOff = false,
}: {
  price: number;
  mrp: number | null | undefined;
  /** "55% off" beside it (the main price; an add-on shows only the crossed-out price) */
  showOff?: boolean;
}) {
  const off = offPercent(price, mrp);
  return (
    <span className={styles.wasNow}>
      {off > 0 && (
        <s className={`${styles.listPrice} num`}>
          <span className="sr-only">Was </span>
          {formatRupees(mrp!)}
        </s>
      )}
      {showOff && off > 0 && (
        <span className={`${styles.off} num`}>{off}% off</span>
      )}
      <span className="num">
        {off > 0 && <span className="sr-only">now </span>}
        {formatRupees(price)}
      </span>
    </span>
  );
}
