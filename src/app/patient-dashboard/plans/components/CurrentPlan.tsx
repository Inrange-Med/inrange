/**
 * The plan the patient already has, as the facts list at the top of Arhaan's Plan and payments.
 * `plan` is null when the backend reports an active plan that is no longer in the plans list.
 */

import Card from "@/components/ui/Card";
import { formatRupees } from "@/lib/format/money";
import type { SubscriptionPlan } from "@/types/subscription";
import styles from "./CurrentPlan.module.css";

export default function CurrentPlan({
  plan,
}: {
  plan: SubscriptionPlan | null;
}) {
  return (
    <Card title="Your plan">
      <dl className={styles.dl}>
        <div>
          <dt>Programme</dt>
          <dd>
            {/* plan names already carry the length ("inrange 4 months") */}
            {plan ? plan.name : "Active"}
          </dd>
        </div>
        {plan?.priceRupees != null && (
          <div>
            <dt>Price</dt>
            <dd className="num">{formatRupees(plan.priceRupees)}</dd>
          </div>
        )}
      </dl>
    </Card>
  );
}
