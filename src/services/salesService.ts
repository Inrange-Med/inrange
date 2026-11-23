/**
 * The sales panel: a salesperson's own customers, payment links and sales. Docs: docs/backend/sales-and-coach.md
 *   GET  /api/sales/me                               who I am and my numbers
 *   GET  /api/sales/plans                            the plans on sale
 *   GET  /api/sales/patients?q=                      my customers
 *   GET  /api/sales/patients/:id                     one customer
 *   POST /api/sales/patients/:id/payment-links       the sales form: makes the link -> { id, url, amountRupees, texted }
 *   POST /api/sales/payment-links/:id/check          asks Razorpay whether it was paid
 *   POST /api/sales/payment-links/:id/cancel         withdraws one nobody paid
 *   POST /api/sales/patients/:id/sale                { planId, paymentId, coachPreference, note }: a Razorpay payment already made
 *   GET  /api/sales/consultations/:id/join           -> { url }: my link into a customer's video call
 */

import { apiRequest, listFrom, type ApiEnvelope } from "@/lib/http/apiClient";
import type {
  LinkForm,
  PlanOnSale,
  SalesCustomer,
  SalesCustomerRow,
  SalesMe,
} from "@/types/sales";

export async function getSalesMe(): Promise<SalesMe> {
  return (await apiRequest<ApiEnvelope<SalesMe>>("/api/sales/me")).data!;
}

export async function listPlansOnSale(): Promise<PlanOnSale[]> {
  return listFrom<PlanOnSale>(await apiRequest("/api/sales/plans"), "plans");
}

export async function listCustomers(q = ""): Promise<SalesCustomerRow[]> {
  return listFrom<SalesCustomerRow>(
    await apiRequest(
      `/api/sales/patients${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
    "patients",
  );
}

export async function getCustomer(id: string): Promise<SalesCustomer> {
  return (
    await apiRequest<ApiEnvelope<SalesCustomer>>(`/api/sales/patients/${id}`)
  ).data!;
}

/** Makes the payment link; returns the link and the server's words. */
export async function makeSalesLink(patientId: string, form: LinkForm) {
  const body = await apiRequest<
    ApiEnvelope<{ url: string }> & { message?: string }
  >(`/api/sales/patients/${patientId}/payment-links`, {
    method: "POST",
    body: form,
  });
  return { url: body.data!.url, message: body.message ?? "Link made" };
}

/** `check` asks Razorpay whether the link was paid; `cancel` withdraws it. Returns the server's words. */
export async function actOnSalesLink(
  id: string,
  action: "check" | "cancel",
): Promise<string> {
  const body = await apiRequest<{ message?: string }>(
    `/api/sales/payment-links/${id}/${action}`,
    { method: "POST" },
  );
  return body?.message ?? "Done";
}

export async function recordSale(
  patientId: string,
  sale: {
    planId: string;
    paymentId: string;
    coachPreference: string;
    note: string;
  },
): Promise<string> {
  const body = await apiRequest<{ message?: string }>(
    `/api/sales/patients/${patientId}/sale`,
    { method: "POST", body: sale },
  );
  return body?.message ?? "Plan started";
}

export async function getSalesCallLink(consultationId: string) {
  return (
    await apiRequest<ApiEnvelope<{ url: string }>>(
      `/api/sales/consultations/${consultationId}/join`,
    )
  ).data!.url;
}
