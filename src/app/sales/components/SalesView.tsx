"use client";

/*
  /sales: the customers assigned to this salesperson (23 Nov 2026 call), and nobody else's. A call coming up
  comes first, then those still to buy. A row says the next call, the plan or the payment link waiting, the
  doctor and the coach; it opens the customer (CustomerSheet): join the call, see what the doctor prescribed,
  make the payment link. The numbers on top are this salesperson's own.
*/

import { useDeferredValue, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import { shortDate } from "@/lib/format/dateTime";
import { formatRupees } from "@/lib/format/money";
import { spacedMobile } from "@/lib/format/phone";
import { getSalesMe, listCustomers } from "@/services/salesService";
import { when } from "@/features/medicine-queue/words";
import CustomerSheet from "./CustomerSheet";
import surfaceStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export default function SalesView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const customerId = params.get("customer");
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim());
  const [version, setVersion] = useState(0);
  const me = useApiResource(`sales-me-${version}`, getSalesMe);
  const customers = useApiResource(`sales-customers-${q}-${version}`, () =>
    listCustomers(q),
  );
  const open = (id: string | null) =>
    router.replace(id ? `${pathname}?customer=${id}` : pathname, {
      scroll: false,
    });

  return (
    <main className={surfaceStyles.page}>
      <PageHead
        className={surfaceStyles.pageHead}
        title="Your customers"
        sub={
          me.data
            ? [
                `Number ${me.data.rank} on the sales team`,
                count(me.data.patients, "customer", "customers"),
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
            : "The customers assigned to you, their calls and their plans."
        }
      />
      <section className={surfaceStyles.panel} aria-labelledby="customers-h">
        <div className={surfaceStyles.panelHead}>
          <h2 id="customers-h" className={surfaceStyles.h2}>
            Customers
          </h2>
        </div>
        <input
          className={s.search}
          type="search"
          value={query}
          placeholder="Name or mobile"
          aria-label="Find a customer by name or mobile"
          onChange={(e) => setQuery(e.target.value)}
        />
        {customers.error && !customers.data ? (
          <ErrorNotice message={customers.error} onRetry={customers.reload} />
        ) : !customers.data ? (
          <LoadingSkeleton />
        ) : customers.data.length === 0 ? (
          <p className={surfaceStyles.empty}>
            {q
              ? "No customer matches that."
              : "No customers yet. Admin assigns them to you when a consultation is booked."}
          </p>
        ) : (
          <ul className={s.rows}>
            {customers.data.map((p) => (
              <li key={p.id}>
                <div className={s.row}>
                  <button
                    type="button"
                    className={s.open}
                    onClick={() => open(p.id)}
                  >
                    <span className={s.what}>{p.name}</span>
                    <span className={s.sub}>
                      <span className="num">{spacedMobile(p.mobile)}</span>
                      {p.nextCallAt && (
                        <span className="num">
                          Call {when(p.nextCallAt).toLowerCase()}
                          {p.nextCallDoctor ? ` with ${p.nextCallDoctor}` : ""}
                        </span>
                      )}
                      {p.doctors && !p.nextCallAt && <span>{p.doctors}</span>}
                      {p.coachName && <span>Coach: {p.coachName}</span>}
                    </span>
                  </button>
                  <span className={s.side}>
                    {p.planName ? (
                      <span className={surfaceStyles.pill} data-tone="ok">
                        {p.planName}
                        {p.planEndsAt
                          ? `, until ${shortDate(p.planEndsAt)}`
                          : ""}
                      </span>
                    ) : p.linkRupees != null ? (
                      <span className={surfaceStyles.pill} data-tone="pending">
                        Link sent,{" "}
                        <span className="num">
                          {formatRupees(p.linkRupees)}
                        </span>
                      </span>
                    ) : (
                      <span className={surfaceStyles.pill} data-tone="new">
                        No plan yet
                      </span>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <CustomerSheet
        customerId={customerId}
        onClose={() => open(null)}
        onChanged={() => setVersion((v) => v + 1)}
      />
    </main>
  );
}
