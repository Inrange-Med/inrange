/** A medicine delivery's steps and its status in a few words, shared by the programme card and the delivery sheet. */

import { shortDate } from "@/lib/format/dateTime";
import type { MedicineOrder, MedicineOrderStatus } from "@/types/carePlan";

export const DELIVERY_STEPS = ["Ordered", "Packed", "On the way", "Delivered"];

/** Out for delivery is still "On the way" on the four-step line; a cancelled order has no step. */
const STEP_INDEX: Record<MedicineOrderStatus, number> = {
  PLACED: 0,
  PACKED: 1,
  DISPATCHED: 2,
  OUT_FOR_DELIVERY: 2,
  DELIVERED: 3,
  CANCELLED: 0,
};

/** The step happening now; past the last one once delivered. */
export const deliveryStepIndex = (order: MedicineOrder) =>
  STEP_INDEX[order.status] + (order.status === "DELIVERED" ? 1 : 0);

/** Still coming (not delivered, not cancelled). */
export const isMoving = (order: MedicineOrder) =>
  order.status !== "DELIVERED" && order.status !== "CANCELLED";

/** When a status was reached, if it has been. */
export const reachedAt = (order: MedicineOrder, status: MedicineOrderStatus) =>
  order.history.find((entry) => entry.status === status)?.at ?? null;

/** Each step's date, by what was reached: the pharmacy may pack and dispatch in one go. */
export const stepDates = (order: MedicineOrder): (string | null)[] => [
  order.placedAt,
  reachedAt(order, "PACKED") ??
    (STEP_INDEX[order.status] >= 1 ? (order.dispatchedAt ?? null) : null),
  reachedAt(order, "DISPATCHED") ??
    reachedAt(order, "OUT_FOR_DELIVERY") ??
    order.dispatchedAt ??
    null,
  reachedAt(order, "DELIVERED") ?? order.deliveredAt ?? null,
];

/** "On the way, due 6 Oct", "Out for delivery today", "Delivered 16 Sep", "Packed 2 Oct", "Cancelled, refunded" */
export function deliveryLine(order: MedicineOrder) {
  const at = reachedAt(order, order.status) ?? order.placedAt;
  if (order.status === "CANCELLED")
    return order.refundedPaise ? "Cancelled, refunded" : "Cancelled";
  if (order.status === "DELIVERED")
    return `Delivered ${shortDate(order.deliveredAt ?? at)}`;
  if (order.status === "OUT_FOR_DELIVERY") return "Out for delivery today";
  if (order.status === "DISPATCHED")
    return order.expectedAt
      ? `On the way, due ${shortDate(order.expectedAt)}`
      : `On the way since ${shortDate(at)}`;
  return `${order.status === "PACKED" ? "Packed" : "Ordered"} ${shortDate(at)}`;
}
