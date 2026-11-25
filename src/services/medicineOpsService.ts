/**
 * The medicine queue (admin and health coach). Doc: docs/backend/medicine-flow.md
 *   GET   /api/admin/medicine/summary                      counts for the tabs
 *   GET   /api/admin/medicine/tasks?status=&mine=          the queue, soonest due first
 *   POST  /api/admin/medicine/tasks/:id/done               { outcome, note, callBackAt? }
 *   POST  /api/admin/medicine/tasks/:id/assign             { to: "me" | userId | null }
 *   POST  /api/admin/medicine/tasks/:id/send-link          the order link on WhatsApp
 *   GET   /api/admin/medicine/tasks/:id/unmatched          a "Match a medicine" task's hand-typed lines (doctor-portal-v2.md)
 *   POST  /api/admin/medicine/tasks/:id/match              { line, medicineId } (admin)
 *   GET   /api/admin/medicine/patients?q=                  admin: every patient; a coach: their own
 *   GET   /api/admin/medicine/patients/:id                 one patient's plan, medicines, messages, tasks and doses
 *   PATCH /api/admin/medicine/patients/:id/coach           { coachId | null } (admin)
 *   PATCH /api/admin/medicine/patients/:id/fitness-coach   { coachId | null } (admin)
 *   POST  /api/admin/medicine/patients/:id/remarks         { text }: a coach remark the doctor reads
 *   PATCH /api/admin/medicine/patients/:id/salesperson     { salespersonId | null } (admin)
 *   PUT   /api/admin/medicine/patients/:id/plan            the sales form, or { planId: null } to withdraw (admin)
 *   GET   /api/schedule/slots/:doctorId/:date              a doctor's times on a day (for admin's booking)
 *   POST  /api/admin/medicine/patients/:id/consultations   { slotId }: books a consultation for the patient (admin)
 *   POST  /api/admin/consultations/:id/move                { slotId } (admin)
 *   POST  /api/admin/consultations/:id/cancel              { reason } (admin)
 *   GET   /api/admin/consultations/:id/recording           -> { url }: a link to watch it, good for an hour (admin)
 *   PUT   /api/admin/medicine/patients/:id/doctors/:doctorId     adds a doctor to the patient's care team (admin)
 *   DELETE /api/admin/medicine/patients/:id/doctors/:doctorId    takes one off it (admin)
 *   GET   /api/admin/medicine/orders                       deliveries (admin)
 *   POST  /api/admin/medicine/orders/:id/move              { to, courier?, trackingNo?, trackingUrl?, expectedAt?, note? } (admin)
 *   POST  /api/admin/medicine/orders/:id/delay             { expectedAt } (admin)
 *   POST  /api/admin/medicine/orders/:id/cancel            { reason }: full refund (admin)
 *   GET   /api/admin/medicine/messages                     every message sent or skipped
 *   POST  /api/admin/medicine/messages/:id/reply           { code?, text? }: plays the patient's reply while WhatsApp is mocked (admin)
 *   GET   /api/admin/medicine/numbers?days=                the measures (admin)
 *   GET   /api/admin/coaches   POST /api/admin/coaches     the coaches; PATCH /api/admin/coaches/:id { kind } (admin)
 *   GET   /api/admin/team   POST /api/admin/team   PATCH /api/admin/team/:id   the operations team and their desks (admin)
 *   POST  /api/admin/medicine/patients/:id/payment-links   the sales form: makes a payment link -> { url } (admin)
 *   POST  /api/admin/payment-links/:id/check|cancel|simulate-paid  asks Razorpay, withdraws, or plays a test payment (admin)
 *   GET   /api/admin/payments                              every payment link, and payments matched to no order or link (admin)
 *   POST  /api/admin/received-payments/:id/set-aside       hides one that is not for a plan (admin)
 *   GET   /api/admin/plans   PATCH /api/admin/plans/:id    what each plan includes, and the sales discount allowed (admin)
 *   GET   /api/admin/calls                                 consultations coming up, and who is due a follow-up (admin)
 *   GET   /api/admin/consultations/:id/links               the video links for the patient, the doctor and the salesperson (admin)
 *   GET   /api/admin/pipeline                              who to call next, by where they are stuck (admin)
 *   GET   /api/admin/patients/:id/lab                      what booking a blood test for them needs, and their bookings (admin)
 *   GET   /api/admin/lab/places?q=                         address search (admin)
 *   POST  /api/admin/patients/:id/addresses                { addressLine, pincode, city, state, landmark, eloc } (admin)
 *   GET   /api/admin/patients/:id/lab/slots?addressId=&date=   free collection times (admin)
 *   POST  /api/admin/patients/:id/lab/bookings             { addressId, collectionDate, slotId, person } holds a time (admin)
 *   POST  /api/admin/lab-bookings/:id/payment-link|paid|move|cancel   (admin)
 *   GET   /api/admin/salespeople                           the sales team, best first, with each one's numbers (admin)
 *   POST  /api/admin/salespeople                           { fullName, mobile? } -> the list (admin)
 *   PATCH /api/admin/salespeople/:id                       any of { fullName, mobile, active, rank } -> the list (admin)
 */

import { apiRequest, listFrom, type ApiEnvelope } from "@/lib/http/apiClient";
import type { LinkForm, PlanOnSale } from "@/types/sales";
import type { Desk } from "@/lib/session/authSession";
import type {
  CallLinks,
  Coach,
  CoachKind,
  TeamMember,
  LabPlace,
  LabSlot,
  OpsPipeline,
  PatientLab,
  OpsCalls,
  OpsPayments,
  OpsMeasure,
  OpsMessage,
  OpsOrder,
  OpsPatient,
  OpsPatientRow,
  OpsSummary,
  OpsTask,
  OpsSlot,
  OrderMove,
  SalesForm,
  Salesperson,
  TaskOutcome,
  UnmatchedLine,
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

export async function getUnmatched(id: string): Promise<UnmatchedLine[]> {
  const body = await apiRequest<ApiEnvelope<{ lines: UnmatchedLine[] }>>(
    `${base}/tasks/${id}/unmatched`,
  );
  return body.data?.lines ?? [];
}

export async function matchMedicine(
  id: string,
  line: number,
  medicineId: string,
): Promise<number> {
  const body = await apiRequest<ApiEnvelope<{ left: number }>>(
    `${base}/tasks/${id}/match`,
    { method: "POST", body: { line, medicineId } },
  );
  return body.data?.left ?? 0;
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

export async function setSalesperson(
  patientId: string,
  salespersonId: string | null,
) {
  await apiRequest(`${base}/patients/${patientId}/salesperson`, {
    method: "PATCH",
    body: { salespersonId },
  });
}

export async function setFitnessCoach(
  patientId: string,
  coachId: string | null,
) {
  await apiRequest(`${base}/patients/${patientId}/fitness-coach`, {
    method: "PATCH",
    body: { coachId },
  });
}

export async function addCoachRemark(patientId: string, text: string) {
  await apiRequest(`${base}/patients/${patientId}/remarks`, {
    method: "POST",
    body: { text },
  });
}

/**
 * The sales form: puts the patient on a plan to pay for in the app, or starts it at once when the money was
 * taken outside the app. `null` withdraws a plan not yet paid for. Returns the server's words.
 */
export async function assignPlan(
  patientId: string,
  form: SalesForm | null,
): Promise<string> {
  const body = await apiRequest<{ message?: string }>(
    `${base}/patients/${patientId}/plan`,
    { method: "PUT", body: form ?? { planId: null } },
  );
  return body?.message ?? (form ? "Plan assigned" : "Plan withdrawn");
}

/** A doctor's times on a day (YYYY-MM-DD), free or taken. */
export async function listDoctorSlots(
  doctorId: string,
  date: string,
): Promise<OpsSlot[]> {
  type Raw = { SlotId: number; StartTime: string; Status: string };
  return listFrom<Raw>(
    await apiRequest(`/api/schedule/slots/${doctorId}/${date}`),
  ).map((slot) => ({
    id: String(slot.SlotId),
    startTime: slot.StartTime,
    free: slot.Status === "Available",
  }));
}

/**
 * Books (no `consultationId`) or moves a consultation for the patient; returns the server's words. A booking
 * may name the salesperson who joins the call (`salespersonId`; leave undefined to keep the patient's own).
 */
export async function bookConsultation(
  patientId: string,
  slotId: string,
  consultationId?: string,
  salespersonId?: string | null,
): Promise<string> {
  const body = await apiRequest<{ message?: string }>(
    consultationId
      ? `/api/admin/consultations/${consultationId}/move`
      : `${base}/patients/${patientId}/consultations`,
    {
      method: "POST",
      body:
        consultationId || salespersonId === undefined
          ? { slotId }
          : { slotId, salespersonId },
    },
  );
  return body?.message ?? "Done";
}

export async function cancelConsultation(
  consultationId: string,
  reason: string,
): Promise<string> {
  const body = await apiRequest<{ message?: string }>(
    `/api/admin/consultations/${consultationId}/cancel`,
    { method: "POST", body: { reason } },
  );
  return body?.message ?? "Cancelled";
}

/** A link to watch a recorded consultation, good for an hour. */
export async function getRecordingLink(consultationId: string) {
  const body = await apiRequest<ApiEnvelope<{ url: string }>>(
    `/api/admin/consultations/${consultationId}/recording`,
  );
  return body.data!.url;
}

/** Adds a doctor to the patient's care team, or takes one off it; returns the server's words. */
export async function setCareTeamDoctor(
  patientId: string,
  doctorId: string,
  on: boolean,
): Promise<string> {
  const body = await apiRequest<{ message?: string }>(
    `${base}/patients/${patientId}/doctors/${doctorId}`,
    { method: on ? "PUT" : "DELETE" },
  );
  return body?.message ?? (on ? "Doctor added" : "Doctor removed");
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

export async function setCoachKind(
  id: string,
  kind: CoachKind,
): Promise<Coach[]> {
  return listFrom<Coach>(
    await apiRequest(`/api/admin/coaches/${id}`, {
      method: "PATCH",
      body: { kind },
    }),
    "coaches",
  );
}

export async function listTeam(): Promise<TeamMember[]> {
  return listFrom<TeamMember>(await apiRequest("/api/admin/team"), "team");
}

/** Adds someone to the operations team; they sign in with this number. Returns the server's words. */
export async function addTeamMember(input: {
  fullName: string;
  mobile: string;
  desks: Desk[];
}): Promise<string> {
  const body = await apiRequest<{ message?: string }>("/api/admin/team", {
    method: "POST",
    body: input,
  });
  return body?.message ?? "Added";
}

/** Changes their desks; none takes them off the team and signs them out. */
export async function setTeamDesks(id: string, desks: Desk[]): Promise<string> {
  const body = await apiRequest<{ message?: string }>(`/api/admin/team/${id}`, {
    method: "PATCH",
    body: { desks },
  });
  return body?.message ?? "Saved";
}

export async function addCoach(input: {
  fullName: string;
  mobile: string;
  kind?: CoachKind;
}): Promise<Coach> {
  const body = await apiRequest<ApiEnvelope<Coach>>("/api/admin/coaches", {
    method: "POST",
    body: input,
  });
  return body.data!;
}

/** Makes a payment link for the patient; returns the link and the server's words. */
export async function makePaymentLink(patientId: string, form: LinkForm) {
  const body = await apiRequest<
    ApiEnvelope<{ url: string }> & { message?: string }
  >(`${base}/patients/${patientId}/payment-links`, {
    method: "POST",
    body: form,
  });
  return { url: body.data!.url, message: body.message ?? "Link made" };
}

/** `check` asks Razorpay whether it was paid, `cancel` withdraws it, `simulate` plays a test patient's payment. */
export async function actOnPaymentLink(
  id: string,
  action: "check" | "cancel" | "simulate",
): Promise<string> {
  const body = await apiRequest<{ message?: string }>(
    `/api/admin/payment-links/${id}/${action === "simulate" ? "simulate-paid" : action}`,
    { method: "POST" },
  );
  return body?.message ?? "Done";
}

export async function getPayments(): Promise<OpsPayments> {
  return (await apiRequest<ApiEnvelope<OpsPayments>>("/api/admin/payments"))
    .data!;
}

export async function setPaymentAside(id: string) {
  await apiRequest(`/api/admin/received-payments/${id}/set-aside`, {
    method: "POST",
  });
}

export async function listStaffPlans(): Promise<PlanOnSale[]> {
  return listFrom<PlanOnSale>(await apiRequest("/api/admin/plans"), "plans");
}

export async function updatePlan(
  id: string,
  changes: Partial<
    Pick<
      PlanOnSale,
      "doctorConsults" | "coachCalls" | "fitnessCalls" | "maxDiscountPercent"
    >
  >,
): Promise<PlanOnSale[]> {
  return listFrom<PlanOnSale>(
    await apiRequest(`/api/admin/plans/${id}`, {
      method: "PATCH",
      body: changes,
    }),
    "plans",
  );
}

export async function getCalls(): Promise<OpsCalls> {
  return (await apiRequest<ApiEnvelope<OpsCalls>>("/api/admin/calls")).data!;
}

export async function getCallLinks(consultationId: string): Promise<CallLinks> {
  return (
    await apiRequest<ApiEnvelope<CallLinks>>(
      `/api/admin/consultations/${consultationId}/links`,
    )
  ).data!;
}

export async function getPipeline(): Promise<OpsPipeline> {
  return (await apiRequest<ApiEnvelope<OpsPipeline>>("/api/admin/pipeline"))
    .data!;
}

export async function getPatientLab(patientId: string): Promise<PatientLab> {
  return (
    await apiRequest<ApiEnvelope<PatientLab>>(
      `/api/admin/patients/${patientId}/lab`,
    )
  ).data!;
}

export async function searchLabPlaces(q: string): Promise<LabPlace[]> {
  return listFrom<LabPlace>(
    await apiRequest(`/api/admin/lab/places?q=${encodeURIComponent(q)}`),
  );
}

export async function addPatientAddress(
  patientId: string,
  address: {
    addressLine: string;
    pincode: string;
    city: string;
    state: string;
    landmark: string;
    eloc: string;
  },
): Promise<string> {
  const body = await apiRequest<ApiEnvelope<{ addressId: string }>>(
    `/api/admin/patients/${patientId}/addresses`,
    { method: "POST", body: address },
  );
  return body.data!.addressId;
}

export async function listLabSlots(
  patientId: string,
  addressId: string,
  date: string,
): Promise<LabSlot[]> {
  return listFrom<LabSlot>(
    await apiRequest(
      `/api/admin/patients/${patientId}/lab/slots?addressId=${addressId}&date=${date}`,
    ),
  );
}

/** The blood tests were paid for outside the app (`paymentRef`), or that payment was refunded (null). Returns the server's words. */
export async function setLabCredit(
  patientId: string,
  paymentRef: string | null,
): Promise<string> {
  const body = await apiRequest<{ message?: string }>(
    `/api/admin/patients/${patientId}/lab/credit`,
    paymentRef === null
      ? { method: "DELETE" }
      : { method: "POST", body: { paymentRef } },
  );
  return body?.message ?? "Saved";
}

/** Holds a collection time for the patient; returns the server's words. */
export async function holdLabBooking(
  patientId: string,
  booking: {
    addressId: string;
    collectionDate: string;
    slotId: number;
    person: { name: string; age: number; gender: string };
  },
): Promise<string> {
  const body = await apiRequest<{ message?: string }>(
    `/api/admin/patients/${patientId}/lab/bookings`,
    { method: "POST", body: booking },
  );
  return body?.message ?? "Time held";
}

/** A held or booked blood test: a payment link, marked paid, moved or cancelled. Returns the link (if any) and the server's words. */
export async function actOnLabBooking(
  id: string,
  action: "payment-link" | "paid" | "move" | "cancel",
  input: Record<string, unknown> = {},
) {
  const body = await apiRequest<
    ApiEnvelope<{ url?: string }> & { message?: string }
  >(`/api/admin/lab-bookings/${id}/${action}`, { method: "POST", body: input });
  return { url: body.data?.url ?? null, message: body.message ?? "Done" };
}

export async function listSalespeople(): Promise<Salesperson[]> {
  return listFrom<Salesperson>(
    await apiRequest("/api/admin/salespeople"),
    "salespeople",
  );
}

export async function addSalesperson(input: {
  fullName: string;
  mobile: string;
}): Promise<Salesperson[]> {
  return listFrom<Salesperson>(
    await apiRequest("/api/admin/salespeople", { method: "POST", body: input }),
    "salespeople",
  );
}

export async function updateSalesperson(
  id: string,
  changes: Partial<
    Pick<Salesperson, "fullName" | "active"> & { mobile: string; rank: number }
  >,
): Promise<Salesperson[]> {
  return listFrom<Salesperson>(
    await apiRequest(`/api/admin/salespeople/${id}`, {
      method: "PATCH",
      body: changes,
    }),
    "salespeople",
  );
}
