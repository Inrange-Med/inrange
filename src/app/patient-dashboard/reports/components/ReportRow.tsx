"use client";

/**
 * One report in the list (Arhaan's report row: plate, title, date, caret), with the medical team's
 * review when the report decides eligibility (and the reason when it was not approved). Tapping it
 * opens the file through the signed-in API (uploads and Redcliffe reports alike).
 */

import { CaretRight, FileText, Flask } from "@phosphor-icons/react";
import FileOpenButton from "@/components/ui/FileOpenButton";
import { longDate } from "@/lib/format/dateTime";
import { getFile } from "@/services/fileService";
import type { MedicalReport } from "@/types/report";
import styles from "../ReportsPage.module.css";

const REVIEW_WORDS: Record<
  NonNullable<MedicalReport["reviewStatus"]>,
  string
> = {
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  NOT_APPROVED: "Not approved",
};

export default function ReportRow({ report }: { report: MedicalReport }) {
  const file = report.file;
  return (
    <FileOpenButton
      className={styles.row}
      disabled={!file}
      load={() => getFile(file ?? "")}
    >
      {(opening) => (
        <>
          <span className={styles.plate} aria-hidden="true">
            {report.source === "LAB_BOOKING" ? (
              <Flask size={17} />
            ) : (
              <FileText size={17} />
            )}
          </span>
          <span className={styles.rowText}>
            <strong>{report.title}</strong>
            <span>
              {report.source === "LAB_BOOKING"
                ? "From your home blood test, "
                : "Uploaded "}
              <span className="num">{longDate(report.addedAt)}</span>
            </span>
            {report.reviewStatus && (
              <span className={styles.review} data-review={report.reviewStatus}>
                {REVIEW_WORDS[report.reviewStatus]}
                {report.reviewStatus === "NOT_APPROVED" &&
                  report.reviewNote && (
                    <span className={styles.reviewNote}>
                      . {report.reviewNote}
                    </span>
                  )}
              </span>
            )}
          </span>
          {opening ? (
            <i className={styles.spin} aria-label="Opening" />
          ) : (
            <CaretRight size={17} className={styles.go} aria-hidden="true" />
          )}
        </>
      )}
    </FileOpenButton>
  );
}
