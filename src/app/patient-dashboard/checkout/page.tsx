/**
 * /patient-dashboard/checkout?purpose=PLAN|LAB_BOOKING|CONSULTATION_FEE&referenceId=<id>&returnTo=<path>
 * A server page so it can carry metadata; the flow reads the URL with useSearchParams, which needs
 * the Suspense boundary here.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import PageGhosts from "@/app/patient-dashboard/components/PageGhosts";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import CheckoutFlow from "./components/CheckoutFlow";
import styles from "./CheckoutPage.module.css";

export const metadata: Metadata = { title: "Checkout | inrange" };

export default function CheckoutPage() {
  return (
    <main className={`${layoutStyles.page} ${layoutStyles.narrow}`}>
      <div className={styles.column}>
        <Suspense fallback={<PageGhosts title heights={[300]} />}>
          <CheckoutFlow />
        </Suspense>
      </div>
    </main>
  );
}
