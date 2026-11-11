/**
 * Lab reports in the patient's record. Doc: docs/backend/reports.md
 *   GET  /api/reports   PROPOSED. Uploaded reports and Redcliffe reports, newest first
 *   POST /api/reports   PROPOSED. Uploads one, multipart: file, title, purpose? ("ELIGIBILITY"). No date: the admin
 *                       reads the date printed on the report itself.
 */

import { ApiError, apiRequest, listFrom } from "@/lib/http/apiClient";
import type { MedicalReport, NewReport } from "@/types/report";

type RawReport = Omit<MedicalReport, "id" | "labBookingId"> & {
  id: number | string;
  labBookingId: number | string | null;
};

const toReport = (raw: RawReport): MedicalReport => ({
  ...raw,
  file: raw.file ?? null,
  reviewStatus: raw.reviewStatus ?? null,
  reviewNote: raw.reviewNote ?? null,
  id: String(raw.id),
  labBookingId:
    raw.labBookingId === null || raw.labBookingId === undefined
      ? null
      : String(raw.labBookingId),
});

/** null when the backend does not have the endpoint yet, so the screen says so calmly. */
export async function listMyReports(): Promise<MedicalReport[] | null> {
  try {
    const body = await apiRequest("/api/reports");
    return listFrom<RawReport>(body).map(toReport);
  } catch (caught) {
    if (caught instanceof ApiError && caught.isMissingEndpoint) return null;
    throw caught;
  }
}

export async function uploadReport(report: NewReport): Promise<MedicalReport> {
  const form = new FormData();
  form.append("file", report.file);
  form.append("title", report.title);
  if (report.purpose) form.append("purpose", report.purpose);
  try {
    const body = await apiRequest<{ data: RawReport }>("/api/reports", {
      method: "POST",
      body: form,
    });
    return toReport(body.data);
  } catch (caught) {
    // a backend without this endpoint answers 404 with an HTML page; say it in words instead
    if (caught instanceof ApiError && caught.isMissingEndpoint)
      throw new ApiError(
        "Uploading reports is not available yet.",
        404,
        caught.body,
      );
    throw caught;
  }
}
