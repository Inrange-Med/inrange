"use client";

/**
 * The signed prescription in its sheet: one row per medicine with its strength and when to take it;
 * open a row for how and why, or open them all at once.
 */

import { useState } from "react";
import { CaretDown, DownloadSimple } from "@phosphor-icons/react";
import FileOpenButton from "@/components/ui/FileOpenButton";
import { shortDate } from "@/lib/format/dateTime";
import { getFile } from "@/services/fileService";
import type { Prescription } from "@/types/carePlan";
import formalDoctorName from "./formalDoctorName";
import pageStyles from "../CarePage.module.css";
import styles from "./PrescriptionSheet.module.css";

const capitalise = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);
const lowerFirst = (text: string) =>
  text.charAt(0).toLowerCase() + text.slice(1);
/** "21 Sep 2026", held together */
const dayYear = (iso: string) =>
  `${shortDate(iso)} ${new Date(iso).getFullYear()}`;

export default function PrescriptionSheet({
  prescription,
}: {
  prescription: Prescription;
}) {
  const [open, setOpen] = useState<string[]>([]);
  const items = prescription.items;
  const allOpen = open.length === items.length;
  return (
    <div className={pageStyles.sheetBody}>
      <p className={pageStyles.sheetMeta}>
        Signed by {formalDoctorName(prescription.doctorName)},{" "}
        {dayYear(prescription.signedAt)}
        {prescription.version > 1 ? ", updated after your follow-up" : ""}.
      </p>
      <div className={styles.rxTools}>
        <span className={styles.rxCount}>
          <span className="num">{items.length}</span>{" "}
          {items.length === 1 ? "medicine" : "medicines"}
        </span>
        <button
          type="button"
          className={styles.rxAll}
          aria-expanded={allOpen}
          onClick={() =>
            setOpen(allOpen ? [] : items.map((item) => item.medicineName))
          }
        >
          {allOpen ? "Collapse all" : "Expand all"}
          <CaretDown size={14} aria-hidden="true" />
        </button>
      </div>
      <ul className={styles.rxList}>
        {items.map((item) => (
          <li key={item.medicineName}>
            <details
              className={styles.rxItem}
              open={open.includes(item.medicineName)}
              onToggle={(event) => {
                const isOpen = event.currentTarget.open;
                setOpen((names) =>
                  isOpen
                    ? names.includes(item.medicineName)
                      ? names
                      : [...names, item.medicineName]
                    : names.filter((name) => name !== item.medicineName),
                );
              }}
            >
              <summary>
                <span className={styles.rxSum}>
                  <span className={styles.rxName}>
                    <strong>{item.medicineName}</strong>
                    <span className="num">{item.strength}</span>
                  </span>
                  <span className={styles.rxHow}>
                    {capitalise(item.dose)}, {lowerFirst(item.frequency)}
                  </span>
                </span>
                <CaretDown
                  size={18}
                  className={styles.rxCaret}
                  aria-hidden="true"
                />
              </summary>
              <div className={styles.rxBody}>
                {item.genericName && (
                  <p className={styles.rxGeneric}>{item.genericName}</p>
                )}
                <dl className={styles.rxDl}>
                  <div>
                    <dt>How:</dt>
                    <dd>
                      {item.route}. {item.instructions}
                    </dd>
                  </div>
                  <div>
                    <dt>Why:</dt>
                    <dd>{item.reason}</dd>
                  </div>
                </dl>
              </div>
            </details>
          </li>
        ))}
      </ul>
      {prescription.pdf && (
        <ul className={styles.links}>
          <li>
            <FileOpenButton
              className={styles.linkRow}
              load={() => getFile(prescription.pdf ?? "")}
            >
              {(opening) => (
                <>
                  {opening ? "Opening" : "Open the signed PDF"}{" "}
                  <DownloadSimple size={16} aria-hidden="true" />
                </>
              )}
            </FileOpenButton>
          </li>
        </ul>
      )}
      <p className={pageStyles.foot}>
        {prescription.doctorName}, {prescription.doctorQualification}.
        Registration: {prescription.doctorRegistrationNo}.
      </p>
    </div>
  );
}
