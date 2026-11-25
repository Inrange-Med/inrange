/**
 * The sales panel: a salesperson's own leads, call notes, payment links and sales; an admin reaches every lead
 * through the same calls. Docs: docs/backend/sales-and-coach.md
 *   GET  /api/sales/me                               who I am and my numbers
 *   GET  /api/sales/plans                            the plans on sale
 *   GET  /api/sales/patients?q=&salespersonId=       the leads
 *   GET  /api/sales/patients/:id                     one lead, end to end
 *   POST /api/sales/patients/:id/updates             { callStatus, remark, followUpOn } a note after a call
 *   PUT  /api/sales/patients/:id/sale-form           the sales form, after the payment
 *   POST /api/sales/patients/:id/payment-links       makes a payment link -> { id, url, amountRupees, texted }
 *   POST /api/sales/payment-links/:id/check          asks Razorpay whether it was paid
 *   POST /api/sales/payment-links/:id/cancel         withdraws one nobody paid
 *   POST /api/sales/patients/:id/sale                { planId, paymentId, coachPreference, note }: a Razorpay payment already made
 *   GET  /api/sales/consultations/:id/join           -> { url }: my link into a lead's video call
 */

import { apiRequest, listFrom, type ApiEnvelope } from "@/lib/http/apiClient";
import type {
  CallStatus,
  Lead,
  LeadDetail,
  LinkForm,
  PlanOnSale,
  SaleForm,
  SalesMe,
} from "@/types/sales";

export async function getSalesMe(): Promise<SalesMe> {
  return (await apiRequest<ApiEnvelope<SalesMe>>("/api/sales/me")).data!;
}

export async function listPlansOnSale(): Promise<PlanOnSale[]> {
  return listFrom<PlanOnSale>(await apiRequest("/api/sales/plans"), "plans");
}

/** `salespersonId` (admin): one salesperson's leads, or "none" for those nobody has yet. */
export async function listLeads(q = "", salespersonId = ""): Promise<Lead[]> {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (salespersonId) query.set("salespersonId", salespersonId);
  return listFrom<Lead>(
    await apiRequest(`/api/sales/patients${query.size ? `?${query}` : ""}`),
    "patients",
  );
}

export async function getLead(id: string): Promise<LeadDetail> {
  return (
    await apiRequest<ApiEnvelope<LeadDetail>>(`/api/sales/patients/${id}`)
  ).data!;
}

export async function addLeadUpdate(
  id: string,
  update: {
    callStatus: CallStatus | null;
    remark: string;
    followUpOn: string | null;
  },
) {
  await apiRequest(`/api/sales/patients/${id}/updates`, {
    method: "POST",
    body: update,
  });
}

export async function saveSaleForm(id: string, form: SaleForm) {
  await apiRequest(`/api/sales/patients/${id}/sale-form`, {
    method: "PUT",
    body: form,
  });
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
