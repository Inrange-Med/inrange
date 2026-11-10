"use client";

/**
 * "What is tested": a Redcliffe package's tests, loaded the first time it opens. A full-body package
 * lists 80+ markers, so they are never shown as one block: each group (Lipid profile, Thyroid) is a
 * row with its count that opens to a plain list; a group that is a single test is just its name.
 */

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { errorMessage } from "@/lib/http/apiClient";
import { getLabPackageTests } from "@/services/labTestService";
import type { LabPackageTests } from "@/types/labTest";
import styles from "../LabBookingFlow.module.css";

/** `testCount` is shown in the summary when known (the care package card does not know it before loading). */
export default function PackageTestsDetails({
  code,
  testCount,
}: {
  code: string;
  testCount?: number;
}) {
  const [tests, setTests] = useState<LabPackageTests | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const loadedCount = tests?.groups.reduce(
    (sum, group) => sum + Math.max(1, group.tests.length),
    0,
  );
  const count = testCount || loadedCount;

  const load = (open: boolean) => {
    if (!open || tests) return;
    setMessage("Loading");
    getLabPackageTests(code)
      .then((loaded) => {
        setTests(loaded);
        setMessage(null);
      })
      .catch((caught) => setMessage(errorMessage(caught)));
  };

  // groups with their own tests first, then the single tests together, so the eye meets structure first
  const groups = tests?.groups.filter((group) => group.tests.length > 1) ?? [];
  const singles =
    tests?.groups
      .filter((group) => group.tests.length <= 1)
      .map((group) => group.tests[0] ?? group.name) ?? [];

  return (
    <details
      className={styles.tested}
      onToggle={(event) => load(event.currentTarget.open)}
    >
      <summary>
        <span>
          What is tested
          {count ? <span className="num"> ({count})</span> : null}
        </span>
        <CaretDown size={16} aria-hidden="true" />
      </summary>
      {message && <p>{message}</p>}
      {tests && (
        <div className={styles.testGroups}>
          {groups.map((group) => (
            <details key={group.name} className={styles.testGroup}>
              <summary>
                <span>{group.name}</span>
                <span className={`${styles.testCount} num`}>
                  {group.tests.length}
                  <CaretDown size={14} aria-hidden="true" />
                </span>
              </summary>
              <ul className={styles.testList}>
                {group.tests.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </details>
          ))}
          {singles.length > 0 && (
            <div className={styles.testGroup}>
              {groups.length > 0 && (
                <p className={styles.testSinglesHead}>Also tested</p>
              )}
              <ul className={styles.testList}>
                {singles.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}
          {groups.length === 0 && singles.length === 0 && (
            <p>The lab has not listed the tests for this package.</p>
          )}
        </div>
      )}
    </details>
  );
}
