"use client";

/**
 * Step 1: which test. Arhaan's packet list (CareTab LabBooking): a tap chooses and moves on. Packages
 * come from Redcliffe through the backend; one a paid lab plan covers is marked and listed first.
 */

import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react";
import { useApiResource } from "@/hooks/useApiResource";
import { listLabPackages } from "@/services/labTestService";
import { formatRupees } from "@/lib/format/money";
import { packageFacts, packageName } from "@/lib/format/labPackage";
import type { LabPackage } from "@/types/labTest";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "../LabBookingFlow.module.css";

export default function LabPackageStep({
  chosenCode,
  onChoose,
}: {
  chosenCode: string | null;
  onChoose: (chosen: LabPackage) => void;
}) {
  const packages = useApiResource("lab-packages", listLabPackages);

  if (packages.loading) return <LoadingSkeleton />;
  if (packages.error)
    return <ErrorNotice message={packages.error} onRetry={packages.reload} />;
  if (packages.data === null)
    return (
      <p className={styles.sheetMeta}>
        Booking home blood tests is not available yet.
      </p>
    );

  const ordered = [...packages.data].sort(
    (a, b) => Number(b.coveredByPlan) - Number(a.coveredByPlan),
  );

  return (
    <>
      <p className={styles.sheetMeta}>
        Someone from our partner lab comes to your home to take a blood sample.
      </p>
      {ordered.length === 0 && (
        <p className={styles.sheetMeta}>
          No tests can be booked right now. Please try again later.
        </p>
      )}
      <ul className={styles.packets}>
        {ordered.map((item) => (
          <li key={item.code}>
            <button
              type="button"
              className={styles.packet}
              data-suggested={
                item.coveredByPlan || item.code === chosenCode || undefined
              }
              onClick={() => onChoose(item)}
            >
              <span className={styles.packetText}>
                <span className={styles.packetHead}>
                  <strong>{packageName(item.name)}</strong>
                  <span className={`${styles.packetPrice} num`}>
                    {item.coveredByPlan ? (
                      "Covered"
                    ) : (
                      <>
                        {item.listPrice > item.price && (
                          <span className={styles.listPrice}>
                            {formatRupees(item.listPrice)}
                          </span>
                        )}
                        {formatRupees(item.price)}
                      </>
                    )}
                  </span>
                </span>
                {/* the lab's description is sales copy ("Free Doctor's Consultation"); the facts and
                    "What is tested" on the next screens say what matters */}
                <span className={`${styles.packetFacts} num`}>
                  {packageFacts(item).map((fact) => (
                    <span key={fact}>{fact}</span>
                  ))}
                </span>
                {item.coveredByPlan && (
                  <em className={styles.tag}>Covered by your plan</em>
                )}
              </span>
              <CaretRight size={17} className={styles.go} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <p className={styles.foot}>
        Not sure which one:{" "}
        <Link href="/patient-dashboard/messages" className={formStyles.link}>
          ask your care team
        </Link>
        .
      </p>
    </>
  );
}
