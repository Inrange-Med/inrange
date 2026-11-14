"use client";

/**
 * Step 5: check and pay. Every choice with a way to change it, then the price. "Continue to payment"
 * holds the time with the lab for 30 minutes and goes straight to the checkout from `checkoutHref`,
 * which shows the backend's price (the care package price when the booking is part of one) before
 * the patient pays. Coming back while the hold lasts shows a Pay link to the same checkout. A test a paid lab plan
 * covers is booked at once instead, and the patient goes to `bookedHref`.
 */

import { addressText } from "@/lib/format/address";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, WarningCircle } from "@phosphor-icons/react";
import { useNow } from "@/hooks/useNow";
import { errorMessage } from "@/lib/http/apiClient";
import { clockTime, spokenDay, timeUntil } from "@/lib/format/dateTime";
import { markerCount } from "@/lib/format/carePackage";
import { formatRupees } from "@/lib/format/money";
import type { LabBooking } from "@/types/labTest";
import { useToast } from "@/components/ui/ToastProvider";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import type { LabBookingState, LabBookingStep } from "../useLabBookingFlow";
import PackageTestsDetails from "./PackageTestsDetails";
import styles from "../LabBookingFlow.module.css";
import { fastingSentence, packageName } from "@/lib/format/labPackage";

/** `beforePay`: the host's own summary, shown just above the pay button (onboarding: the BMI). */
type Props = {
  flow: LabBookingState;
  checkoutHref: (booking: LabBooking) => string;
  bookedHref: (booking: LabBooking) => string;
  beforePay?: ReactNode;
};

const capital = (text: string) =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

export default function ReviewAndPayStep({
  flow,
  checkoutHref,
  bookedHref,
  beforePay,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const now = useNow(10_000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    chosenPackage: labPackage,
    carePackage,
    address,
    patient,
    slot,
    held,
  } = flow;
  if (!labPackage || !address || !patient || !slot) return null;

  const at = new Date(slot.at);
  const when = `${capital(spokenDay(at))}, ${clockTime(at)}`;
  // the hold as long as it lasts; null before it is made and once its 30 minutes are up
  const liveHold =
    held?.holdExpiresAt && Date.parse(held.holdExpiresAt) > now ? held : null;
  const covered = !carePackage && labPackage.coveredByPlan;
  // a care package is billed at its own price, which covers the tests and the consultation
  const billName = carePackage?.name ?? packageName(labPackage.name);
  const listedPrice = carePackage?.priceRupees ?? labPackage.price;
  const markers = markerCount(labPackage.testCount);

  const hold = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const booking = await flow.hold();
      if (!booking.paymentRequired) {
        toast(`Home blood test booked for ${spokenDay(at)}, ${clockTime(at)}`);
        router.push(bookedHref(booking));
      } else {
        // straight on to pay; the checkout shows the lab's confirmed price before anything is charged
        router.push(checkoutHref(booking));
      }
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
    // on success the button stays busy until the next page opens
  };

  const rows: { label: string; value: string; step: LabBookingStep }[] = [
    {
      label: carePackage ? "Package" : "Test",
      value: billName,
      step: "package",
    },
    { label: "When", value: when, step: "time" },
    { label: "Where", value: addressText(address), step: "address" },
    {
      label: "For",
      value: `${patient.name}, ${patient.age}, ${patient.gender.toLowerCase()}`,
      step: "patient",
    },
  ];

  return (
    <>
      <dl className={styles.facts}>
        {rows.map((row) => (
          <div key={row.label}>
            <div>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
            <button
              type="button"
              className={formStyles.link}
              onClick={() => flow.goTo(row.step)}
            >
              Change
            </button>
          </div>
        ))}
      </dl>

      {/* the first step reads markers, never a list of tests by name (client call, 12 Nov 2026);
          a test booked from the dashboard keeps its full list */}
      {carePackage ? (
        <p className={styles.sheetMeta}>
          {markers ? `${markers}, tested at home.` : "Tested at home."} Your
          doctor goes through every result with you.
        </p>
      ) : (
        <PackageTestsDetails
          code={labPackage.code}
          testCount={labPackage.testCount}
        />
      )}

      <dl className={styles.bill}>
        <div>
          <dt>
            {billName}
            <small>
              {carePackage
                ? "Home blood test and consultation"
                : covered
                  ? "Covered by your plan"
                  : "Home blood test"}
            </small>
          </dt>
          <dd className="num">
            {covered
              ? formatRupees(0)
              : formatRupees(
                  liveHold ? liveHold.price.packagePrice : listedPrice,
                )}
          </dd>
        </div>
        {liveHold && liveHold.price.discount > 0 && (
          <div>
            <dt>Discount</dt>
            <dd className="num">-{formatRupees(liveHold.price.discount)}</dd>
          </div>
        )}
        {liveHold && (
          <div>
            <dt>Home collection</dt>
            <dd className="num">
              {liveHold.price.collectionCharge > 0
                ? formatRupees(liveHold.price.collectionCharge)
                : "Free"}
            </dd>
          </div>
        )}
        <div className={styles.total}>
          <dt>To pay now</dt>
          <dd className="num">
            {covered
              ? formatRupees(0)
              : formatRupees(liveHold ? liveHold.price.total : listedPrice)}
          </dd>
        </div>
      </dl>

      {fastingSentence(labPackage.fastingNote) && (
        <p className={styles.fast}>{fastingSentence(labPackage.fastingNote)}</p>
      )}

      {beforePay}

      {error && (
        <div>
          <p className={formStyles.err} role="alert">
            <WarningCircle size={16} weight="fill" aria-hidden="true" />
            <span>{error}</span>
          </p>
          <button
            type="button"
            className={formStyles.link}
            onClick={() => flow.goTo("time")}
          >
            Choose another time
          </button>
        </div>
      )}

      {liveHold ? (
        <>
          <p className={styles.sheetMeta}>
            <span>
              Your time is held until{" "}
              <span className="num">
                {clockTime(new Date(liveHold.holdExpiresAt!))}
              </span>
              . Pay {timeUntil(liveHold.holdExpiresAt!, now)} to keep it.
            </span>
          </p>
          <Link
            href={checkoutHref(liveHold)}
            className={`btn ${formStyles.go} ${styles.payDock}`}
          >
            <span>Pay {formatRupees(liveHold.price.total)} and book</span>
            <span className="well" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </Link>
        </>
      ) : (
        <>
          <button
            type="button"
            className={`btn ${formStyles.go} ${styles.payDock}`}
            onClick={hold}
            data-busy={busy}
            aria-busy={busy}
          >
            <span>
              {busy
                ? "Holding your time"
                : covered
                  ? "Book the test"
                  : "Continue to payment"}
            </span>
            <span className="well" aria-hidden="true">
              {busy ? (
                <i className={formStyles.spin} />
              ) : (
                <ArrowRight size={18} />
              )}
            </span>
          </button>
          <p className={styles.foot}>
            {held
              ? "The 30-minute hold ended. Continue to hold this time again."
              : covered
                ? "Your plan covers this test."
                : "The lab holds your time for 30 minutes while you pay, and confirms the price."}
          </p>
        </>
      )}
    </>
  );
}
