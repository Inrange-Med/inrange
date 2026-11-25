"use client";

/*
  /sales: a salesperson's dashboard. Their own numbers on top, then their leads (features/sales/LeadsBoard):
  what to do today, each lead end to end, the payment link and the sales form.
*/

import PageHead from "@/components/ui/PageHead";
import LeadsBoard from "@/features/sales/LeadsBoard";
import { useApiResource } from "@/hooks/useApiResource";
import { getSalesMe } from "@/services/salesService";
import surfaceStyles from "@/components/ui/styles/StaffSurfaces.module.css";

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export default function SalesView() {
  const me = useApiResource("sales-me", getSalesMe);
  return (
    <main className={surfaceStyles.page}>
      <PageHead
        className={surfaceStyles.pageHead}
        title="Your leads"
        sub={
          me.data
            ? [
                me.data.rank && `Number ${me.data.rank} on the sales team`,
                count(me.data.patients, "lead", "leads"),
                count(me.data.plansSold, "plan sold", "plans sold"),
                me.data.linksWaiting > 0 &&
                  count(
                    me.data.linksWaiting,
                    "link waiting for payment",
                    "links waiting for payment",
                  ),
              ]
                .filter(Boolean)
                .join(". ") + "."
            : "The leads assigned to you: their calls, their plans and your notes."
        }
      />
      <LeadsBoard onChanged={me.reload} />
    </main>
  );
}
