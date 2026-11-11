/*
  "Waiting on you" on Today (Arhaan's queue panel): one row per patient, their most pressing item
  leading, the rest as chips that each open their own task. The backend sends the queue most
  pressing first (severe symptoms, urgent messages, reports, messages, notes, drafts), so grouping
  keeps that order. `items` is null while the backend has no queue endpoint, undefined while loading.
*/

import type { ReactNode } from "react";
import Link from "next/link";
import { timeAgo } from "@/lib/format/dateTime";
import type { WaitingItem } from "@/types/patientRecord";
import { chipWords, itemHref } from "../waitingWords";
import WaitingKindIcon from "./WaitingKindIcon";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "./WaitingQueue.module.css";

function byPatient(items: WaitingItem[]) {
  const groups = new Map<string, WaitingItem[]>();
  for (const item of items)
    groups.set(item.patientId, [...(groups.get(item.patientId) ?? []), item]);
  return [...groups.values()];
}

export default function WaitingQueue({
  items,
  now,
  className,
  notice,
}: {
  items: WaitingItem[] | null | undefined;
  now: number;
  /** where the panel sits in the Today grid */ className: string;
  /** a load error, shown inside the panel so the grid never shifts */
  notice?: ReactNode;
}) {
  return (
    <section
      className={`${clinicStyles.panel} ${className}`}
      aria-labelledby="waiting-heading"
    >
      <div className={clinicStyles.panelHead}>
        <h2 id="waiting-heading" className={clinicStyles.h2}>
          Waiting on you
        </h2>
        {items && (
          <span className={`${clinicStyles.count} num`}>{items.length}</span>
        )}
      </div>
      {notice}
      {items === undefined ? (
        // while the queue loads, three rows breathe where it will be
        <ul className={styles.queue} aria-busy="true" aria-label="Loading">
          {[0, 1, 2].map((ghost) => (
            <li key={ghost} className={styles.ghost} />
          ))}
        </ul>
      ) : items === null ? (
        notice ? null : (
          <p className={clinicStyles.empty}>
            Not available yet. Flagged symptoms, messages for you, new reports,
            call notes and drafts to sign will appear here.
          </p>
        )
      ) : items.length ? (
        <ul className={styles.queue}>
          {byPatient(items).map((group) => {
            const top = group[0];
            return (
              <li
                key={top.patientId}
                className={styles.item}
                data-kind={top.kind}
                data-severity={top.severity ?? undefined}
                data-urgent={top.urgent || undefined}
              >
                <span className={styles.icon} aria-hidden="true">
                  <WaitingKindIcon item={top} />
                </span>
                <span className={styles.text}>
                  <span className={styles.line}>
                    <Link
                      href={itemHref(top)}
                      className={styles.name}
                      title={`${top.title}: ${top.detail}`}
                    >
                      {top.patientName}
                    </Link>
                    {group.some((item) => item.severity === "Severe") && (
                      <span className={clinicStyles.qSevere}>Severe</span>
                    )}
                    <span className={`${styles.when} num`}>
                      {timeAgo(top.at, now)}
                    </span>
                  </span>
                  <span className={styles.chips}>
                    {group.map((item) => (
                      <Link
                        key={item.id}
                        href={itemHref(item)}
                        className={styles.chip}
                        data-kind={item.kind}
                        data-severity={item.severity ?? undefined}
                        data-urgent={item.urgent || undefined}
                      >
                        {chipWords(item)}
                      </Link>
                    ))}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={clinicStyles.empty}>
          Nothing waiting. Flagged symptoms, messages for you, new reports, call
          notes and drafts to sign appear here.
        </p>
      )}
    </section>
  );
}
