/**
 * "From your coach": the diet chart your health coach wrote and the exercise plan from your fitness coach
 * (23 Nov 2026 call). Each shows the newest version, with who wrote it and when. Shown only once there is one.
 */

import Card from "@/components/ui/Card";
import { shortDate } from "@/lib/format/dateTime";
import type { CoachPlans } from "@/types/carePlan";
import pageStyles from "../CarePage.module.css";

export default function CoachPlanCard({ plans }: { plans: CoachPlans }) {
  const parts = [
    { title: "Your diet chart", plan: plans.diet },
    { title: "Your exercise plan", plan: plans.fitness },
  ].filter((part) => part.plan);
  if (!parts.length) return null;
  return (
    <Card className={pageStyles.card} title="From your coach" id="coach">
      {parts.map(({ title, plan }) => (
        <details key={title} className={pageStyles.coachPlan} open>
          <summary>
            <strong>{title}</strong>
            <span>
              {plan!.by}, {shortDate(plan!.at)}
            </span>
          </summary>
          <p>{plan!.text}</p>
        </details>
      ))}
    </Card>
  );
}
