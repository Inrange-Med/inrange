/**
 * The patient's treatment for the Care tab and the cart page. Docs: docs/backend/consultations-and-care.md,
 * docs/backend/medicine-cart.md
 *   GET   /api/care/prescription/current   The latest signed prescription -> { data: Prescription | null }
 *   GET   /api/care/medicine-orders        Medicine deliveries, newest first -> { data: MedicineOrder[] }
 *   GET   /api/care/cart                   The prescription's prefilled cart -> { data: MedicineCart | null, availableAt? }
 *   PATCH /api/care/cart                   { lines?: [{ medicineId, quantity }], addressId? } -> { data: MedicineCart }
 * Paying for the cart is the shared checkout: purpose MEDICINE_ORDER, referenceId the cart id.
 * loadCarePlan() asks for the first three at once; until they exist (404) the Care tab says so.
 */

import { ApiError, apiRequest, listFrom } from "@/lib/http/apiClient";
import type {
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
