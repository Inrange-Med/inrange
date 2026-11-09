/**
 * "Your programme" on Care: the active plan (or how a programme starts), and under it the current
 * medicine and the latest delivery. Medicine and deliveries come from the PROPOSED care-plan
 * endpoints; until the backend serves them the card says so.
 */

import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import Card from "@/components/ui/Card";
import ErrorNotice from "@/components/ui/ErrorNotice";
import type { CarePlan, MedicineOrder } from "@/types/carePlan";
import type { SubscriptionPlan } from "@/types/subscription";
import {
  DELIVERY_STEPS,
  deliveryLine,
  deliveryStepIndex,
} from "./deliveryStatus";
import StepLine from "./StepLine";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import pageStyles from "../CarePage.module.css";
import styles from "./CareProgrammeCard.module.css";

/** Whether the patient is on a plan, and which. */
export type Programme = { active: boolean; plan: SubscriptionPlan | null };

export default function CareProgrammeCard({
  programme,
  programmeError,
  carePlan,
  carePlanError,
  order,
  onRetry,
  onOpenPrescription,
  onOpenDelivery,
}: {
  programme: Programme | null;
  programmeError: string | null;
  carePlan: CarePlan | null;
  carePlanError: string | null;
  order: MedicineOrder | null;
  onRetry: () => void;
  onOpenPrescription: () => void;
  onOpenDelivery: () => void;
}) {
  const medicine = carePlan?.prescription?.items[0] ?? null;
  const moving = !!order && order.status !== "DELIVERED";
  return (
    <Card
      title="Your programme"
      id="programme"
      className={`${pageStyles.card} ${pageStyles.prog}`}
    >
      {programme?.active ? (
        <p className={styles.progName}>
          {programme.plan?.name ?? "Your plan is active"}
        </p>
      ) : (
        programme && (
          <>
            <p className={pageStyles.text}>
              Not on a programme yet. Plans shows the one your doctor suggests,
              and a dietitian joins you once it starts.
            </p>
            <Link
              href="/patient-dashboard/plans"
              className={`${formStyles.link} ${styles.self}`}
            >
              See plans <CaretRight size={15} />
            </Link>
          </>
        )
      )}

      {medicine && (
        <div className={styles.med}>
          <p className={styles.medText}>
            <strong>
              {medicine.medicineName}{" "}
              <span className="num">{medicine.strength}</span>
            </strong>
            <button
              type="button"
              className={styles.inline}
              onClick={onOpenPrescription}
              aria-label="Full prescription"
            >
              <span className={styles.wideOnly}>Full prescription</span>
              <span className={styles.narrowOnly}>Prescription</span>
              <CaretRight size={14} aria-hidden="true" />
            </button>
          </p>
        </div>
      )}

      {order && (
        <div className={pageStyles.delivery}>
          <button
            type="button"
            className={styles.dRow}
            onClick={onOpenDelivery}
          >
            <span className={styles.dText}>
              <strong>{moving ? "Next delivery" : "Last delivery"}</strong>{" "}
              <span className="num">{deliveryLine(order)}</span>
            </span>
            <CaretRight
              size={16}
              className={pageStyles.go}
              aria-hidden="true"
            />
          </button>
          {moving && (
            <StepLine
              label={`Next delivery: ${deliveryLine(order)}`}
              steps={DELIVERY_STEPS.map((label) => ({ label }))}
              currentIndex={deliveryStepIndex(order)}
            />
          )}
        </div>
      )}

      {carePlan && !carePlan.available && (
        <p className={pageStyles.foot}>
          Your prescription and medicine deliveries will show here. This is not
          available in the app yet.
        </p>
      )}
      {(programmeError || carePlanError) && (
        <ErrorNotice
          message={programmeError ?? carePlanError ?? ""}
          onRetry={onRetry}
        />
      )}
    </Card>
  );
}
