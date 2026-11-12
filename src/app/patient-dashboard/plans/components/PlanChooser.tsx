"use client";

/**
 * Choosing a plan, shaped like Arhaan's Planner: the lengths as a segmented control (number over
 * unit), then the chosen plan's name, its perks as a checklist and its price last, then the
 * one action. Plan names, perks and prices come from GET /api/subscriptions/plans. When the doctor
 * recommended a plan in the consultation, it comes first with their note, already chosen.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "@phosphor-icons/react";
import ItemisedBill from "@/app/patient-dashboard/components/ItemisedBill";
import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { formatRupees } from "@/lib/format/money";
import { checkoutHref } from "@/lib/payments/checkoutHref";
import type { RecommendedPlan, SubscriptionPlan } from "@/types/subscription";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "./PlanChooser.module.css";

const monthsWord = (months: number) => (months === 1 ? "month" : "months");

export default function PlanChooser({
  plans,
  recommended,
}: {
  plans: SubscriptionPlan[];
  recommended: RecommendedPlan | null;
}) {
  const recommendedPlan = recommended
    ? (plans.find((candidate) => candidate.id === recommended.planId) ?? null)
    : null;
  const [chosenId, setChosenId] = useState(
    String((recommendedPlan ?? plans[0]).id),
  );
  const plan =
    plans.find((candidate) => String(candidate.id) === chosenId) ?? plans[0];
  const perMonth =
    plan.priceRupees && plan.durationMonths > 1
      ? `About ${formatRupees(plan.priceRupees / plan.durationMonths)} a month`
      : undefined;

  return (
    <Card title="Choose your subscription plan">
      <div className={styles.chooser}>
        {recommended && recommendedPlan && (
          <div className={styles.recommended}>
            <p className={styles.by}>
              <span aria-hidden="true">
                <Avatar
                  name={recommended.doctorName || "Your doctor"}
                  size={28}
                />
              </span>
              <span>
                {recommended.doctorName || "Your doctor"} recommends{" "}
                {recommendedPlan.name}
              </span>
            </p>
            {recommended.note && (
              <blockquote className={styles.note}>
                <p>{recommended.note}</p>
              </blockquote>
            )}
          </div>
        )}
        <p className={styles.text}>
          Select a plan for full doctor consultations.
        </p>

        {plans.length > 1 && (
          <div className={styles.lengths}>
            <SegmentedControl
              label="Plan length"
              value={chosenId}
              onChange={setChosenId}
              options={plans.map((option) => ({
                value: String(option.id),
                label: (
                  <>
                    <span className={styles.lengthNum}>
                      {option.durationMonths}
                    </span>
                    <span className={styles.lengthUnit}>
                      {monthsWord(option.durationMonths)}
                    </span>
                  </>
                ),
              }))}
            />
          </div>
        )}

        <div className={styles.chosen} aria-live="polite">
          <p className={styles.planName}>{plan.name}</p>
          {/* the length is already in the switch and the name; only the doctor's pick adds a line */}
          {plan.id === recommendedPlan?.id && (
            <p className={styles.meta}>Recommended by your doctor</p>
          )}
        </div>

        {plan.perks.length > 0 && (
          <ul className={styles.incl}>
            {plan.perks.map((perk, index) => (
              <li key={`${plan.id}-${index}`}>
                <Check size={16} weight="bold" aria-hidden="true" />
                {perk}
              </li>
            ))}
          </ul>
        )}
        <ItemisedBill
          lines={[]}
          total={{
            label: "Plan price",
            note: perMonth,
            amount:
              plan.priceRupees != null
                ? formatRupees(plan.priceRupees)
                : "Free",
          }}
        />
        {plan.perks.length === 0 && (
          <p className={styles.foot}>No benefits listed for this plan.</p>
        )}

        <div className={styles.action}>
          {plan.isActive ? (
            <Link
              href={checkoutHref({
                purpose: "PLAN",
                referenceId: plan.id,
                returnTo: "/patient-dashboard",
              })}
              className={`btn ${formStyles.go} ${styles.cta}`}
            >
              <span>Subscribe now</span>
              <span className="well" aria-hidden="true">
                <ArrowRight size={18} />
              </span>
            </Link>
          ) : (
            <button
              type="button"
              className={`btn ${formStyles.go} ${styles.cta}`}
              disabled
            >
              <span>Unavailable</span>
              <span className="well" aria-hidden="true">
                <ArrowRight size={18} />
              </span>
            </button>
          )}
          <p className={styles.foot}>
            {plan.isActive
              ? "You see the itemised price before you pay."
              : "This plan is currently unavailable"}
          </p>
        </div>
      </div>
    </Card>
  );
}
