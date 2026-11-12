/**
 * The checkout's last screen, once the backend has verified the payment (the page heading says
 * "Payment received"): what happens next, what was paid for, the payment reference to quote to
 * support, and one way on.
 */

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Card from "@/components/ui/Card";
import { formatRupees } from "@/lib/format/money";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "./PaymentReceived.module.css";

export type PaidOrder = {
  title: string;
  amountPaise: number;
  paymentReference: string;
};

export default function PaymentReceived({
  paid,
  nextStep,
  continueTo,
}: {
  paid: PaidOrder;
  nextStep: string;
  continueTo: string;
}) {
  return (
    <Card>
      <div className={styles.receipt}>
        <span className={styles.seal} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className={styles.next}>{nextStep}</p>
        <dl className={styles.facts}>
          <div>
            <dt>Paid for</dt>
            <dd>{paid.title}</dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd className="num">{formatRupees(paid.amountPaise / 100)}</dd>
          </div>
          <div>
            <dt>Payment reference</dt>
            <dd className={`${styles.reference} num`}>
              {paid.paymentReference}
            </dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <Link href={continueTo} className={`btn ${formStyles.go}`}>
            <span>Continue</span>
            <span className="well" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </Link>
        </div>
      </div>
    </Card>
  );
}
