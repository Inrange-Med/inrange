"use client";

/*
  Payments: every payment, newest first, each one "Paid" with what it was for, the date, the receipt
  number and the amount. Anything still to pay is on Home's card, with its bill. Data: GET /api/payments
  (paymentService).
*/

import ErrorNotice from "@/components/ui/ErrorNotice";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import { shortDate } from "@/lib/format/dateTime";
import { formatRupees } from "@/lib/format/money";
import { listPayments } from "@/services/paymentService";
import PageGhosts from "@/app/patient-dashboard/components/PageGhosts";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import styles from "./PaymentsView.module.css";

const HOME = { href: "/patient-dashboard", label: "Home" };

export default function PaymentsView() {
  const payments = useApiResource("my-payments", listPayments);
  return (
    <main className={`${layoutStyles.page} ${styles.page}`}>
      <PageHead title="Payments" back={HOME} />
      {payments.error && !payments.data ? (
        <ErrorNotice message={payments.error} onRetry={payments.reload} />
      ) : !payments.data ? (
        <PageGhosts heights={[180]} />
      ) : payments.data.length === 0 ? (
        <p className={styles.empty}>
          No payments yet. When something is due, Home shows the bill and Pay.
        </p>
      ) : (
        <ul className={styles.list}>
          {payments.data.map((p) => (
            <li key={p.id} className={styles.row}>
              <span className={styles.what}>
                <strong>{p.title}</strong>
                <span className="num">
                  Paid {shortDate(p.paidAt)} {new Date(p.paidAt).getFullYear()}
                  {p.invoiceNumber && `. Receipt ${p.invoiceNumber}`}
                </span>
              </span>
              <span className={`${styles.amount} num`}>
                {formatRupees(p.amountPaise / 100)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
