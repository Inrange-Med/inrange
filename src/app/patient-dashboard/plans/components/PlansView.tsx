"use client";

/**
 * /patient-dashboard/plans: the patient's plan and payments. With an active plan it shows that plan;
 * otherwise the plan chooser, which sends the chosen plan to /patient-dashboard/checkout (the plan is
 * activated by the backend only after Razorpay confirms the payment). A plan the doctor recommended
 * (PROPOSED GET /api/subscriptions/recommended) is shown first. Invoices sit underneath.
 */

import Card from "@/components/ui/Card";
import ErrorNotice from "@/components/ui/ErrorNotice";
import PageGhosts from "@/app/patient-dashboard/components/PageGhosts";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import { ApiError } from "@/lib/http/apiClient";
import { getSessionUser } from "@/lib/session/authSession";
import { listPayments } from "@/services/paymentService";
import {
  getRecommendedPlan,
  getSubscriptionStatus,
  listPlans,
} from "@/services/subscriptionService";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import CurrentPlan from "./CurrentPlan";
import InvoiceList from "./InvoiceList";
import PlanChooser from "./PlanChooser";
import styles from "../PlansPage.module.css";

/** An endpoint the backend has not built yet answers 404: treat it as "nothing to show". */
const nullWhenMissing = (error: unknown) => {
  if (error instanceof ApiError && error.isMissingEndpoint) return null;
  throw error;
};

async function loadPlansAndStatus() {
  const userId = getSessionUser()?.userId ?? null;
  const [plans, status, recommended] = await Promise.all([
    listPlans(),
    userId === null
      ? null
      : getSubscriptionStatus(userId).catch(nullWhenMissing),
    // a recommendation that fails to load must not stop the patient choosing a plan
    getRecommendedPlan().catch(() => null),
  ]);
  return { plans, status, recommended };
}

export default function PlansView() {
  const planState = useApiResource("plans", loadPlansAndStatus);
  const payments = useApiResource("payments", () =>
    listPayments().catch(nullWhenMissing),
  );

  const content = () => {
    if (planState.error)
      return (
        <ErrorNotice message={planState.error} onRetry={planState.reload} />
      );
    if (!planState.data) return <PageGhosts heights={[320]} />;
    const { plans, status, recommended } = planState.data;
    if (status?.hasActivePlan)
      return (
        <CurrentPlan
          plan={plans.find((plan) => plan.id === status.planId) ?? null}
        />
      );
    if (plans.length === 0)
      return (
        <Card title="Choose your subscription plan">
          <p className={styles.text}>No plans are available right now.</p>
        </Card>
      );
    return <PlanChooser plans={plans} recommended={recommended} />;
  };

  return (
    <main className={`${layoutStyles.page} ${layoutStyles.narrow}`}>
      <PageHead
        title="Plan and payments"
        back={{ href: "/patient-dashboard/care", label: "Care" }}
      />
      <div className={styles.stack}>
        {content()}
        {payments.error ? (
          <ErrorNotice message={payments.error} onRetry={payments.reload} />
        ) : payments.loading ? (
          // a card-shaped ghost holds the invoices' place, so the stack never jumps
          <PageGhosts heights={[120]} />
        ) : (
          <InvoiceList payments={payments.data} />
        )}
      </div>
    </main>
  );
}
