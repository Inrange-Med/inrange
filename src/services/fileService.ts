/**
 * Stored files: reports, lab reports, prescriptions and progress photos. The backend checks who is
 * asking and streams the file, so the app never holds a link that could be forwarded. Screens get the
 * path from the record that owns the file (`report.file`, `booking.reportFile`, `prescription.pdf`...).
 *   GET /api/files/reports/:id
 *   GET /api/files/lab-bookings/:id
 *   GET /api/files/prescriptions/:id
 *   GET /api/files/photos/:id/:pose
 */

import { apiFile } from "@/lib/http/apiClient";

export function getFile(path: string): Promise<Blob> {
  if (!path.startsWith("/api/files/"))
    return Promise.reject(new Error("This file is not available."));
  return apiFile(path);
}
