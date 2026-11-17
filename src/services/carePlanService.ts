/**
 * The patient's treatment for the Care tab and the cart page. Docs: docs/backend/consultations-and-care.md,
 * docs/backend/medicine-cart.md
 *   GET   /api/care/prescription/current   The latest signed prescription -> { data: Prescription | null }
 *   GET   /api/care/medicine-orders        Medicine deliveries, newest first -> { data: MedicineOrder[] }
 *   GET   /api/care/cart                   The prescription's prefilled cart -> { data: MedicineCart | null, availableAt? }
 *   PATCH /api/care/cart                   { lines?: [{ medicineId, quantity }], addressId? } -> { data: MedicineCart }
 *   POST  /api/care/cart/open-now          The held order, opened early because the patient asked
 *   POST  /api/care/cart/elsewhere         "I bought them elsewhere": no more reminders about this order
 *   POST  /api/care/medicine-orders/:id/feedback  { rating: GOOD | ISSUE, note? } -> { callBy }
 *   GET   /api/care/doses                  Dose reminders and the recent doses -> { schedules, events }
 *   PATCH /api/care/doses/:scheduleId      { weekday?, time?, paused? }
 *   POST  /api/care/doses/events/:id       { status: TAKEN | SKIPPED, reason? } -> { callBy }
 * Paying for the cart is the shared checkout: purpose MEDICINE_ORDER, referenceId the cart id.
 * Doc for the rest: docs/backend/medicine-flow.md
 * loadCarePlan() asks for the first three at once; until they exist (404) the Care tab says so.
 */

import { ApiError, apiRequest, listFrom } from "@/lib/http/apiClient";
import type {
  Doses,
  DoseSchedule,
  CarePlan,
  CartState,
  MedicineCart,
  MedicineOrder,
  Prescription,
} from "@/types/carePlan";

const NO_CART: CartState = { cart: null, availableAt: null };

export async function loadCarePlan(): Promise<CarePlan> {
  try {
    const [prescriptionBody, ordersBody, cart] = await Promise.all([
      apiRequest<{ data?: Prescription | null }>(
        "/api/care/prescription/current",
      ),
      apiRequest("/api/care/medicine-orders"),
      getCart(),
    ]);
    return {
      available: true,
      prescription: prescriptionBody.data ?? null,
      orders: listFrom<MedicineOrder>(ordersBody, "orders"),
      cart,
    };
  } catch (caught) {
    if (caught instanceof ApiError && caught.isMissingEndpoint)
      return {
        available: false,
        prescription: null,
        orders: [],
        cart: NO_CART,
      };
    throw caught;
  }
}

export async function getCart(): Promise<CartState> {
  try {
    const body = await apiRequest<{
      data?: MedicineCart | null;
      availableAt?: string | null;
    }>("/api/care/cart");
    return { cart: body.data ?? null, availableAt: body.availableAt ?? null };
  } catch (caught) {
    if (caught instanceof ApiError && caught.isMissingEndpoint) return NO_CART;
    throw caught;
  }
}

export async function updateCart(change: {
  lines?: { medicineId: string; quantity: number }[];
  addressId?: string | number;
}): Promise<MedicineCart> {
  const body = await apiRequest<{ data: MedicineCart }>("/api/care/cart", {
    method: "PATCH",
    body: change,
  });
  return body.data;
}

export async function openCartNow(): Promise<void> {
  await apiRequest("/api/care/cart/open-now", { method: "POST" });
}

export async function boughtElsewhere(): Promise<void> {
  await apiRequest("/api/care/cart/elsewhere", { method: "POST" });
}

/** The answer says when the care team calls back, for "Something is wrong". */
export async function rateDelivery(
  orderId: string,
  rating: "GOOD" | "ISSUE",
  note?: string,
): Promise<{ message: string; callBy: string | null }> {
  const body = await apiRequest<{
    message?: string;
    data?: { callBy?: string | null };
  }>(`/api/care/medicine-orders/${orderId}/feedback`, {
    method: "POST",
    body: { rating, note },
  });
  return {
    message: body.message ?? "Thank you for telling us.",
    callBy: body.data?.callBy ?? null,
  };
}

const NO_DOSES: Doses = { schedules: [], events: [] };

export async function getDoses(): Promise<Doses> {
  try {
    const body = await apiRequest<{ data?: Doses }>("/api/care/doses");
    return body.data ?? NO_DOSES;
  } catch (caught) {
    if (caught instanceof ApiError && caught.isMissingEndpoint) return NO_DOSES;
    throw caught;
  }
}

export async function updateDoseReminder(
  scheduleId: string,
  change: { weekday?: number; time?: string; paused?: boolean },
): Promise<Pick<DoseSchedule, "weekday" | "times" | "paused">> {
  const body = await apiRequest<{
    data?: Pick<DoseSchedule, "weekday" | "times" | "paused">;
  }>(`/api/care/doses/${scheduleId}`, {
    method: "PATCH",
    body: change,
  });
  return body.data!;
}

export async function logDose(
  eventId: string,
  status: "TAKEN" | "SKIPPED",
  reason?: string,
): Promise<{ message: string; callBy: string | null }> {
  const body = await apiRequest<{
    message?: string;
    data?: { callBy?: string | null };
  }>(`/api/care/doses/events/${eventId}`, {
    method: "POST",
    body: { status, reason },
  });
  return {
    message: body.message ?? "Logged",
    callBy: body.data?.callBy ?? null,
  };
}
