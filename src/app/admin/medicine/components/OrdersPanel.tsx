"use client";

/*
  The pharmacy's deliveries, grouped by step: to pack, to dispatch, on the way, delivered lately. Each
  row has its one next step; dispatching asks for the courier and tracking first, and marking delivered
  asks once more (neither can be undone). A row opens the order: address, items, history, a new date,
  or cancel and refund.
*/

import { useState } from "react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { errorMessage } from "@/lib/http/apiClient";
import { listOrders, moveOrder } from "@/services/medicineOpsService";
import type { OpsOrder } from "@/types/medicineOps";
import OrderSheet, { type OrderSheetStart } from "./OrderSheet";
import { dueWords, NEXT_STEP, when } from "./words";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";
import s from "./Medicine.module.css";

const GROUPS: {
  title: string;
  statuses: OpsOrder["status"][];
  empty: string;
}[] = [
  { title: "To pack", statuses: ["PLACED"], empty: "Nothing to pack." },
  {
    title: "To dispatch",
    statuses: ["PACKED"],
    empty: "Nothing waiting for the courier.",
  },
  {
    title: "On the way",
    statuses: ["DISPATCHED", "OUT_FOR_DELIVERY"],
    empty: "Nothing on the way.",
  },
  {
    title: "Delivered or cancelled lately",
    statuses: ["DELIVERED", "CANCELLED"],
    empty: "",
  },
];

export default function OrdersPanel({
  now,
  version,
  onOpenPatient,
  onChanged,
}: {
  now: number;
  /** bumped by the page after a change anywhere (the patient sheet), so the list reloads */
  version: number;
  onOpenPatient: (id: string) => void;
  onChanged: () => void;
}) {
  const orders = useApiResource(`medicine-orders-${version}`, listOrders);
  const toast = useToast();
  const [opened, setOpened] = useState<{
    order: OpsOrder;
    start: OrderSheetStart;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const step = async (order: OpsOrder) => {
    const next = NEXT_STEP[order.status];
    if (!next) return;
    if (next.to === "DISPATCHED")
      return setOpened({ order, start: "dispatch" });
    if (next.to === "DELIVERED") return setOpened({ order, start: "deliver" });
    if (busy) return;
    setBusy(order.id);
    try {
      await moveOrder(order.id, { to: next.to });
      toast(
        `${order.orderNumber}: ${next.label.toLowerCase()}. The patient was told.`,
      );
      onChanged();
    } catch (caught) {
      toast(errorMessage(caught, "That step could not be saved."));
    } finally {
      setBusy(null);
    }
  };

  if (orders.error && !orders.data)
    return <ErrorNotice message={orders.error} onRetry={orders.reload} />;
  if (!orders.data) return <LoadingSkeleton />;

  const active = orders.data.some(
    (o) => o.status !== "DELIVERED" && o.status !== "CANCELLED",
  );
  return (
    <div className={s.stack}>
      {!active && (
        <section className={adminStyles.panel} aria-label="Orders">
          <p className={adminStyles.empty}>
            Nothing to pack or send. A paid order appears here at once, with the
            time it must be dispatched by.
          </p>
        </section>
      )}
      {GROUPS.filter((g) => active || g.statuses.includes("DELIVERED")).map(
        (group) => {
          const rows = orders.data!.filter((o) =>
            group.statuses.includes(o.status),
          );
          if (!rows.length && !group.empty) return null;
          return (
            <section
              key={group.title}
              className={adminStyles.panel}
              aria-label={group.title}
            >
              <div className={adminStyles.panelHead}>
                <h2 className={adminStyles.h2}>{group.title}</h2>
                <span className={`${adminStyles.count} num`}>
                  {rows.length}
                </span>
              </div>
              {rows.length === 0 ? (
                <p className={adminStyles.empty}>{group.empty}</p>
              ) : (
                <ul className={s.rows}>
                  {rows.map((order) => {
                    const next = NEXT_STEP[order.status];
                    const dispatchBy = dueWords(order.dispatchBy, now);
                    return (
                      <li key={order.id}>
                        <div className={s.row}>
                          <button
                            type="button"
                            className={s.open}
                            onClick={() => setOpened({ order, start: "view" })}
                          >
                            <span className={s.what}>
                              <span className="num">{order.orderNumber}</span>{" "}
                              {order.patientName}
                            </span>
                            <span className={s.sub}>
                              <span className={s.items}>
                                {order.items.map((i) => i.name).join(", ")}
                              </span>
                              {order.courier && <span>{order.courier}</span>}
                              <span className="num">
                                {order.status === "DELIVERED" &&
                                order.deliveredAt
                                  ? `Delivered ${when(order.deliveredAt)}`
                                  : order.status === "CANCELLED"
                                    ? "Cancelled and refunded"
                                    : `Paid ${when(order.placedAt)}`}
                              </span>
                              {order.feedback === "ISSUE" && (
                                <span>Patient reported a problem</span>
                              )}
                            </span>
                          </button>
                          <span className={s.side}>
                            {(order.status === "PLACED" ||
                              order.status === "PACKED") && (
                              <span
                                className={`${s.due} num`}
                                data-late={dispatchBy.late}
                              >
                                {dispatchBy.late
                                  ? dispatchBy.text.replace(
                                      "Overdue",
                                      "Dispatch overdue",
                                    )
                                  : `Dispatch by ${when(order.dispatchBy)}`}
                              </span>
                            )}
                            {next && (
                              <button
                                type="button"
                                className={adminStyles.textBtn}
                                disabled={busy === order.id}
                                onClick={() => step(order)}
                              >
                                {busy === order.id ? "Saving" : next.label}
                              </button>
                            )}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        },
      )}

      <OrderSheet
        order={opened?.order ?? null}
        start={opened?.start ?? "view"}
        onClose={() => setOpened(null)}
        onOpenPatient={(id) => {
          setOpened(null);
          onOpenPatient(id);
        }}
        onChanged={onChanged}
      />
    </div>
  );
}
