// The one place eligibility changes. Pass `tx` inside a transaction, or `sql` outside one.
// A report that arrives waits in UNDER_REVIEW until an admin decides (routes/admin.ts).
import type { Sql, TransactionSql } from "postgres";

type Db = Sql | TransactionSql;
export type EligibilityPatch = Partial<{
  path: "OWN_REPORT" | "LAB_TEST";
  stage: "NOT_STARTED" | "AWAITING_PAYMENT" | "LAB_SCHEDULED" | "SAMPLE_COLLECTED" | "UNDER_REVIEW" | "APPROVED" | "NOT_APPROVED";
  review_note: string | null;
  lab_booking_id: string | null;
  consultation_paid: boolean;
  consultation_used: boolean;
}>;

export async function setEligibility(db: Db, userId: number, patch: EligibilityPatch) {
  const p = { path: null, stage: null, review_note: undefined, lab_booking_id: undefined, consultation_paid: null, consultation_used: null, ...patch };
  await db`
    insert into eligibility (user_id, path, stage, review_note, lab_booking_id, consultation_paid, consultation_used)
    values (${userId}, ${p.path}, ${p.stage ?? "NOT_STARTED"}, ${p.review_note ?? null}, ${p.lab_booking_id ?? null},
            ${p.consultation_paid ?? false}, ${p.consultation_used ?? false})
    on conflict (user_id) do update set
      path = coalesce(${p.path}, eligibility.path),
      stage = coalesce(${p.stage}, eligibility.stage),
      review_note = case when ${p.review_note !== undefined} then ${p.review_note ?? null} else eligibility.review_note end,
      lab_booking_id = case when ${p.lab_booking_id !== undefined} then ${p.lab_booking_id ?? null} else eligibility.lab_booking_id end,
      consultation_paid = coalesce(${p.consultation_paid}, eligibility.consultation_paid),
      consultation_used = coalesce(${p.consultation_used}, eligibility.consultation_used),
      updated_at = now()`;
}
