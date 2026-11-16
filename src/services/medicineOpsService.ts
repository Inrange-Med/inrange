/**
 * The medicine queue (admin and health coach). Doc: docs/backend/medicine-flow.md
 *   GET   /api/admin/medicine/summary                      counts for the tabs
 *   GET   /api/admin/medicine/tasks?status=&mine=          the queue, soonest due first
 *   POST  /api/admin/medicine/tasks/:id/done               { outcome, note, callBackAt? }
 *   POST  /api/admin/medicine/tasks/:id/assign             { to: "me" | userId | null }
 *   POST  /api/admin/medicine/tasks/:id/send-link          the order link on WhatsApp
 *   GET   /api/admin/medicine/patients?q=                  patients with medicine activity
 *   GET   /api/admin/medicine/patients/:id                 one patient's medicines, messages, tasks and doses
 *   PATCH /api/admin/medicine/patients/:id/coach           { coachId | null } (admin)
 *   GET   /api/admin/medicine/orders                       deliveries (admin)
 *   POST  /api/admin/medicine/orders/:id/move              { to, courier?, trackingNo?, trackingUrl?, expectedAt?, note? } (admin)
 *   POST  /api/admin/medicine/orders/:id/delay             { expectedAt } (admin)
 *   POST  /api/admin/medicine/orders/:id/cancel            { reason }: full refund (admin)
 *   GET   /api/admin/medicine/messages                     every message sent or skipped
 *   POST  /api/admin/medicine/messages/:id/reply           { code?, text? }: plays the patient's reply while WhatsApp is mocked (admin)
 *   GET   /api/admin/medicine/numbers?days=                the measures (admin)
 *   GET   /api/admin/coaches   POST /api/admin/coaches     the health coaches (admin)
 */

import { apiRequest, listFrom, type ApiEnvelope } from "@/lib/http/apiClient";
import type {
  Coach,
  OpsMeasure,
  OpsMessage,
  OpsOrder,
  OpsPatient,
  OpsPatientRow,
  OpsSummary,
  OpsTask,
  OrderMove,
  TaskOutcome,
} from "@/types/medicineOps";

const base = "/api/admin/medicine";

export async function getSummary(): Promise<OpsSummary> {
  const body = await apiRequest<ApiEnvelope<OpsSummary>>(`${base}/summary`);
  return body.data!;
}

export async function listTasks(
  status: "OPEN" | "DONE" = "OPEN",
): Promise<OpsTask[]> {
  return listFrom<OpsTask>(
    await apiRequest(`${base}/tasks?status=${status}`),
    "tasks",
  );
}

export async function finishTask(
  id: string,
  input: { outcome: TaskOutcome; note: string; callBackAt?: string },
) {
  const body = await apiRequest<
    ApiEnvelope<{ status: "OPEN" | "DONE"; dueAt?: string }>
  >(`${base}/tasks/${id}/done`, {
    method: "POST",
    body: input,
  });
  return body.data!;
}

export async function assignTask(id: string, to: "me" | string | null) {
  await apiRequest(`${base}/tasks/${id}/assign`, {
    method: "POST",
    body: { to },
  });
}

export async function sendOrderLink(id: string) {
  await apiRequest(`${base}/tasks/${id}/send-link`, { method: "POST" });
}

export async function listPatients(q = ""): Promise<OpsPatientRow[]> {
  return listFrom<OpsPatientRow>(
    await apiRequest(
      `${base}/patients${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
    "patients",
  );
}

export async function getPatient(id: string): Promise<OpsPatient> {
  const body = await apiRequest<ApiEnvelope<OpsPatient>>(
    `${base}/patients/${id}`,
  );
  return body.data!;
}

export async function setCoach(patientId: string, coachId: string | null) {
  await apiRequest(`${base}/patients/${patientId}/coach`, {
    method: "PATCH",
    body: { coachId },
  });
}

export async function listOrders(): Promise<OpsOrder[]> {
  return listFrom<OpsOrder>(await apiRequest(`${base}/orders`), "orders");
}

export async function moveOrder(id: string, move: OrderMove) {
  await apiRequest(`${base}/orders/${id}/move`, { method: "POST", body: move });
}

export async function delayOrder(id: string, expectedAt: string) {
  await apiRequest(`${base}/orders/${id}/delay`, {
    method: "POST",
    body: { expectedAt },
  });
}

export async function cancelOrder(id: string, reason: string) {
  await apiRequest(`${base}/orders/${id}/cancel`, {
    method: "POST",
    body: { reason },
  });
}

export async function listMessages(): Promise<OpsMessage[]> {
  return listFrom<OpsMessage>(await apiRequest(`${base}/messages`), "messages");
}

export async function playReply(
  messageId: string,
  reply: { code?: string; text?: string },
): Promise<string> {
  const body = await apiRequest<ApiEnvelope<{ outcome: string }>>(
    `${base}/messages/${messageId}/reply`,
    {
      method: "POST",
      body: reply,
    },
  );
  return body.data?.outcome ?? "Done";
}

export async function getNumbers(days = 30): Promise<OpsMeasure[]> {
  const body = await apiRequest<ApiEnvelope<{ measures: OpsMeasure[] }>>(
    `${base}/numbers?days=${days}`,
  );
  return body.data?.measures ?? [];
}

export async function listCoaches(): Promise<Coach[]> {
  return listFrom<Coach>(await apiRequest("/api/admin/coaches"), "coaches");
}

export async function addCoach(input: {
  fullName: string;
  mobile: string;
}): Promise<Coach> {
  const body = await apiRequest<ApiEnvelope<Coach>>("/api/admin/coaches", {
    method: "POST",
    body: input,
  });
  return body.data!;
}
