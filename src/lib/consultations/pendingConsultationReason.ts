/**
 * The reason a patient typed on the Book page, carried to checkout for a paid consultation.
 * Kept in sessionStorage (this tab only), never in the URL: it is health information.
 */

const STORAGE_KEY = "inrange-consultation-reason";

export function savePendingConsultationReason(slotId: string, reason: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ slotId, reason }));
  } catch {
    // storage blocked: checkout goes ahead without the reason
  }
}

/** The saved reason for this slot, removed once read. */
export function takePendingConsultationReason(
  slotId: string,
): string | undefined {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as {
      slotId: string;
      reason: string;
    } | null;
    sessionStorage.removeItem(STORAGE_KEY);
    return saved?.slotId === slotId ? saved.reason : undefined;
  } catch {
    return undefined;
  }
}
