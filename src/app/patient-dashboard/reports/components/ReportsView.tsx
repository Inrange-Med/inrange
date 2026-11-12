"use client";

/**
 * Reports: every report in the record (uploads and the ones Redcliffe Labs sent for a home test),
 * each with its review status, and a way to upload one (the date on it must be within the last 90
 * days, the team's rule). When the medical team did not approve the eligibility report
 * (GET /api/eligibility stage NOT_APPROVED), the upload comes first with their note, and the new
 * report is sent for review (purpose ELIGIBILITY).
 */

import { useState } from "react";
import Card from "@/components/ui/Card";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LabReportUpload from "@/components/ui/LabReportUpload";
import PageGhosts from "@/app/patient-dashboard/components/PageGhosts";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { getMyEligibility } from "@/services/eligibilityService";
import { listMyReports, uploadReport } from "@/services/reportService";
import type { NewReport } from "@/types/report";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import ReportRow from "./ReportRow";
import styles from "../ReportsPage.module.css";

export default function ReportsView() {
  const reports = useApiResource("my-reports", listMyReports);
  const eligibility = useApiResource("my-eligibility", getMyEligibility);
  const toast = useToast();
  // a new key empties the upload form after a successful upload
  const [formKey, setFormKey] = useState(0);
  const notApproved = eligibility.data?.stage === "NOT_APPROVED";

  const upload = async (report: NewReport) => {
    await uploadReport(
      notApproved ? { ...report, purpose: "ELIGIBILITY" } : report,
    );
    toast(notApproved ? "Report sent to our medical team" : "Report uploaded");
    setFormKey((key) => key + 1);
    reports.reload();
    eligibility.reload();
  };

  const uploadCard = (
    <Card title={notApproved ? "Upload a newer report" : "Upload a report"}>
      {notApproved && (
        <p className={styles.note}>
          {eligibility.data?.reviewNote ||
            "Our medical team could not approve your last report."}
        </p>
      )}
      <LabReportUpload
        key={formKey}
        chooseLabel="Choose a PDF or photo"
        submitLabel="Upload report"
        onUpload={upload}
      />
    </Card>
  );

  const listCard = (
    <Card title="Your reports">
      {reports.loading && <PageGhosts heights={[52, 52]} />}
      {reports.error && (
        <ErrorNotice message={reports.error} onRetry={reports.reload} />
      )}
      {!reports.loading && !reports.error && reports.data === null && (
        <p className={styles.text}>Reports are not available yet.</p>
      )}
      {reports.data?.length === 0 && (
        <p className={styles.text}>
          No reports yet. Upload one, or book a home test.
        </p>
      )}
      {reports.data && reports.data.length > 0 && (
        <ul className={styles.people}>
          {reports.data.map((report) => (
            <li key={report.id}>
              <ReportRow report={report} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <main
      className={`${layoutStyles.page} ${layoutStyles.narrow} ${styles.page}`}
    >
      <PageHead
        title="Reports"
        back={{ href: "/patient-dashboard/care", label: "Care" }}
        sub="Your doctor reads these before your consultation."
      />
      <div className={styles.grid}>
        {notApproved ? uploadCard : listCard}
        {notApproved ? listCard : uploadCard}
      </div>
    </main>
  );
}
