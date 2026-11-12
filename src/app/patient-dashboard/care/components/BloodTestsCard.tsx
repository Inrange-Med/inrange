/**
 * Blood tests on Care: the way into home tests and reports, which live on their own pages
 * (/patient-dashboard/lab-tests and /patient-dashboard/reports). Until the patient has shared a
 * report or booked tests (no eligibility path yet, no care team), it suggests doing one of them.
 */

import Link from "next/link";
import { CaretRight, FileText, Flask } from "@phosphor-icons/react/dist/ssr";
import Card from "@/components/ui/Card";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import pageStyles from "../CarePage.module.css";
import styles from "./BloodTestsCard.module.css";

export default function BloodTestsCard({
  hasTeam,
  hasTestsOrReport,
  settled = true,
}: {
  hasTeam: boolean;
  /** the patient already shared a report or booked home tests */
  hasTestsOrReport: boolean;
  /** whether hasTestsOrReport is known yet; until then the card holds one soft line, so it never
      shows the two suggestions and then swaps them for the rows */
  settled?: boolean;
}) {
  const showRecords = hasTeam || hasTestsOrReport;
  return (
    <Card
      title="Blood tests"
      className={`${pageStyles.card} ${pageStyles.labs}`}
      action={
        hasTeam && (
          <Link
            href="/patient-dashboard/lab-tests/book"
            className={formStyles.link}
          >
            Book a test <CaretRight size={15} />
          </Link>
        )
      }
    >
      {!showRecords && !settled ? (
        <span className={styles.ghostLine} aria-hidden="true" />
      ) : showRecords ? (
        <>
          <ul className={pageStyles.people}>
            <li>
              <Link
                href="/patient-dashboard/lab-tests"
                className={pageStyles.row}
              >
                <span className={pageStyles.plate} aria-hidden="true">
                  <Flask size={17} />
                </span>
                <span className={pageStyles.rowText}>
                  <strong>Home blood tests</strong>
                  <span>Booked tests and where they are</span>
                </span>
                <CaretRight
                  size={16}
                  className={pageStyles.go}
                  aria-hidden="true"
                />
              </Link>
            </li>
            <li>
              <Link
                href="/patient-dashboard/reports"
                className={pageStyles.row}
              >
                <span className={pageStyles.plate} aria-hidden="true">
                  <FileText size={17} />
                </span>
                <span className={pageStyles.rowText}>
                  <strong>Reports</strong>
                  <span>Your results and the reports you shared</span>
                </span>
                <CaretRight
                  size={16}
                  className={pageStyles.go}
                  aria-hidden="true"
                />
              </Link>
            </li>
          </ul>
          <p className={`${pageStyles.foot} ${styles.labsFoot}`}>
            Your doctor orders the tests you need, and our partner lab collects
            the sample at home.
          </p>
        </>
      ) : (
        <div className={pageStyles.stack}>
          <p className={pageStyles.text}>
            Share a recent report, or book a home test. Your doctor reads it
            before your consultation.
          </p>
          <div className={styles.pair}>
            <Link
              href="/patient-dashboard/reports"
              className={`btn btn--ghost ${pageStyles.pill}`}
            >
              <FileText size={17} /> Share a report
            </Link>
            <Link
              href="/patient-dashboard/lab-tests/book"
              className={`btn btn--ghost ${pageStyles.pill}`}
            >
              <Flask size={17} /> Book a home test
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
