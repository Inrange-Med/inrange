"use client";

/**
 * Onboarding, step 1: the care package that includes lab tests (lab tests and consultation), in
 * place of the Redcliffe package list. The card lists what is included (the backend's lines, with no
 * consultation length) and how many markers the blood test reads, never the tests by name (client
 * call, 12 Nov 2026: a list of tests is a shopping list for any local lab; the promise is the cause,
 * then the plan). "Start your consultation" uses its Redcliffe package (for the fasting note and the
 * lab's age and sex limits) and moves on. Prices come from the backend.
 */

import { useState } from "react";
import { ArrowRight, WarningCircle } from "@phosphor-icons/react";
import { useApiResource } from "@/hooks/useApiResource";
import { errorMessage } from "@/lib/http/apiClient";
import { markerCount, withoutDuration } from "@/lib/format/carePackage";
import { formatRupees } from "@/lib/format/money";
import { listCarePackages } from "@/services/carePackageService";
import { listLabPackages } from "@/services/labTestService";
import type { CarePackage } from "@/types/carePackage";
import type { LabPackage } from "@/types/labTest";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "../LabBookingFlow.module.css";

type Props = {
  onChoose: (chosen: { care: CarePackage; lab: LabPackage }) => void;
};

export default function CarePackageStep({ onChoose }: Props) {
  const packages = useApiResource("care-packages", listCarePackages);
  // the lab packages, for each card's marker count; the same list "Start your consultation" uses
  const labPackages = useApiResource("lab-packages", listLabPackages);
  const [startingCode, setStartingCode] = useState<string | null>(null);
  const [problem, setProblem] = useState<{
    code: string;
    message: string;
  } | null>(null);

  const start = async (care: CarePackage) => {
    if (startingCode) return;
    setStartingCode(care.code);
    setProblem(null);
    try {
      const lab = (labPackages.data ?? (await listLabPackages()))?.find(
        (item) => item.code === care.labPackageCode,
      );
      if (lab) onChoose({ care, lab });
      else
        setProblem({
          code: care.code,
          message:
            "This package cannot be booked right now. Please try again later.",
        });
    } catch (caught) {
      setProblem({ code: care.code, message: errorMessage(caught) });
    } finally {
      setStartingCode(null);
    }
  };

  if (packages.loading) return <LoadingSkeleton />;
  if (packages.error)
    return <ErrorNotice message={packages.error} onRetry={packages.reload} />;

  const withLabTests = (packages.data ?? []).filter(
    (item) => item.includesLabTests && item.labPackageCode,
  );
  if (withLabTests.length === 0)
    return (
      <p className={styles.sheetMeta}>
        Booking a home blood test is not available yet. You can book it from
        your account later.
      </p>
    );

  return (
    <ul className={styles.carePackages}>
      {withLabTests.map((care) => {
        const markers = markerCount(
          labPackages.data?.find((item) => item.code === care.labPackageCode)
            ?.testCount,
        );
        return (
          <li key={care.code} className={styles.carePackage}>
            <div className={styles.packetHead}>
              <strong>{care.name}</strong>
              <span className={`${styles.packetPrice} num`}>
                {formatRupees(care.priceRupees)}
              </span>
            </div>
            {care.description && (
              <p className={styles.packetWhat}>
                {withoutDuration(care.description)}
              </p>
            )}
            {care.includes.length > 0 && (
              <ul className={styles.includes}>
                {care.includes.map((line) => (
                  <li key={line}>{withoutDuration(line)}</li>
                ))}
              </ul>
            )}
            {/* what the blood test is for, and how much it reads; never the tests by name */}
            <div className={styles.markers}>
              {markers && (
                <p className={`${styles.markersCount} num`}>{markers}</p>
              )}
              <p className={styles.markersWhy}>
                Your blood tests look for what may be behind your weight. Your
                doctor goes through every result with you, then explains what to
                do about it.
              </p>
            </div>
            {problem?.code === care.code && (
              <p className={formStyles.err} role="alert">
                <WarningCircle size={16} weight="fill" aria-hidden="true" />
                <span>{problem.message}</span>
              </p>
            )}
            <button
              type="button"
              className={`btn ${formStyles.go}`}
              onClick={() => start(care)}
              data-busy={startingCode === care.code}
              aria-busy={startingCode === care.code}
            >
              <span>Book home blood tests</span>
              <span className="well" aria-hidden="true">
                {startingCode === care.code ? (
                  <i className={formStyles.spin} />
                ) : (
                  <ArrowRight size={18} />
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
