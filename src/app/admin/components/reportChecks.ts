/*
  What the admin should know about one report before deciding, in plain words. `facts` describe the
  file; `warnings` are reasons to look closely (an edited, old or reused file). None of them decides:
  the admin still reads the lab name, patient name and date printed on the report.
*/

import { longDate, shortDate } from "@/lib/format/dateTime";
import { spacedMobile } from "@/lib/format/phone";
import type { ReviewReport } from "@/types/admin";

const HOUR = 36e5;
const DAY = 24 * HOUR;

// consumer apps that make or change documents; a lab's own system rarely is one of these
const EDITORS =
  /canva|ilovepdf|smallpdf|sejda|pdfescape|pdffiller|dochub|photoshop|picsart|pixelmator|microsoft.*word|word for|google docs|libreoffice|openoffice|wps|pdf-?xchange|phantompdf|pdfelement|wondershare|nitro|lightpdf|soda ?pdf|pdf ?candy|pdf2go|xodo|inkscape|gimp/i;

/** "6 hours", "3 days" */
function span(ms: number) {
  if (ms < 2 * DAY) {
    const hours = Math.round(ms / HOUR);
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `${Math.round(ms / DAY)} days`;
}

const sizeWords = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function reportChecks(report: ReviewReport): {
  facts: string[];
  warnings: string[];
} {
  const facts: string[] = [];
  const warnings: string[] = [];
  const { facts: f } = report;

  facts.push(report.kind === "pdf" ? "PDF" : "Photo or scan");
  if (report.sizeBytes) facts.push(sizeWords(report.sizeBytes));
  if (report.source === "LAB") {
    facts.push("Sent directly by Redcliffe Labs");
    return { facts, warnings };
  }

  const app = f.producer || f.creator;
  if (app) facts.push(`Made with ${app}`);
  if (f.created) facts.push(`created ${longDate(f.created)}`);
  if (f.encrypted) facts.push("Locked PDF");
  if (report.kind === "image")
    facts.push("Read the date and lab name on the photo");

  const editor = [f.producer, f.creator].find((x) => x && EDITORS.test(x));
  if (editor)
    warnings.push(
      `Made or saved with ${editor}, an app that can edit documents.`,
    );
  if (f.created && f.modified) {
    const changedAfter = Date.parse(f.modified) - Date.parse(f.created);
    if (changedAfter > HOUR)
      warnings.push(
        `Changed ${span(changedAfter)} after it was made (on ${longDate(f.modified)}).`,
      );
  }
  if (f.created) {
    const age = Date.parse(report.uploadedAt) - Date.parse(f.created);
    if (age > 90 * DAY)
      warnings.push(
        `The file was made on ${longDate(f.created)}, more than 3 months before it was sent.`,
      );
  }
  for (const other of report.sameFile) {
    if (!other.samePatient)
      warnings.push(
        `The same file was uploaded by another patient (${spacedMobile(other.mobile)}) on ${shortDate(other.uploadedAt)}.`,
      );
    else if (other.reviewStatus === "NOT_APPROVED")
      warnings.push(
        `The same file was sent on ${shortDate(other.uploadedAt)} and marked not approved.`,
      );
    else facts.push(`also sent on ${shortDate(other.uploadedAt)}`);
  }
  return { facts, warnings };
}
