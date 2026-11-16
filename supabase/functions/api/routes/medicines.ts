// The patient's side of the medicine flow, the same actions WhatsApp's buttons take, for anyone who uses
// the app instead (or has WhatsApp off). Mounted at /api. docs/backend/medicine-flow.md.
//   POST  /care/cart/open-now                     the held nano order, opened early because the patient asked
//   POST  /care/cart/elsewhere                    "I bought them elsewhere": no more reminders about this order
//   POST  /care/medicine-orders/:orderId/feedback { rating: "GOOD" | "ISSUE", note? } after delivery
//   GET   /care/doses                             the dose schedules and the last and next doses (patients on a plan)
//   PATCH /care/doses/:scheduleId                 { weekday?, time?, paused? } the day and time of the reminder
//   POST  /care/doses/events/:eventId             { status: "TAKEN" | "SKIPPED", reason? }
import { Hono } from "hono";
import { sql } from "../lib/db.ts";
import { body, fail, intParam, ok } from "../lib/http.ts";
import { requirePatient } from "../lib/auth.ts";
import { whenWords } from "../lib/hours.ts";
import * as flow from "../lib/medicineFlow.ts";

export const medicineRoutes = new Hono();

const iso = (col: string) => sql`to_char(${sql(col)} at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"')`;
const SKIP_REASONS = ["UNWELL", "FORGOT", "SIDE_EFFECTS", "OTHER"];

async function openCart(patientId: number) {
  const [k] = await sql`
    select k.* from medicine_carts k join prescriptions p on p.id = k.prescription_id
    where k.patient_id = ${patientId} and k.status = 'OPEN' and (p.valid_until is null or p.valid_until > now())
    order by k.id desc limit 1`;
  if (!k) fail(404, "There is no medicines order waiting.");
  return k;
}

medicineRoutes.post("/care/cart/open-now", async (c) => {
  const me = await requirePatient(c);
  const k = await openCart(me.id);
  await flow.orderNow(k.id, me.id, "APP", `app:${k.id}:open`);
  return ok(c, { cartId: String(k.id) }, "Your order is ready");
});

medicineRoutes.post("/care/cart/elsewhere", async (c) => {
  const me = await requirePatient(c);
  const k = await openCart(me.id);
  await flow.boughtElsewhere(k.id, me.id, "app");
  return ok(c, null, "We will not remind you about this order again");
});

medicineRoutes.post("/care/medicine-orders/:orderId/feedback", async (c) => {
  const me = await requirePatient(c);
  const id = intParam(c.req.param("orderId"), "order");
  const b = await body<{ rating?: string; note?: unknown }>(c);
  if (b.rating !== "GOOD" && b.rating !== "ISSUE") fail(400, "Choose All good or Something is wrong.");
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 1000) || null : null;
  const [o] = await sql`select status, feedback from medicine_orders where id = ${id} and patient_id = ${me.id}`;
  if (!o) fail(404, "That order was not found.");
  if (o.status !== "DELIVERED") fail(409, "You can tell us once the order is delivered.");
  const due = await flow.orderFeedback(id, me.id, b.rating as "GOOD" | "ISSUE", note);
  return ok(c, { feedback: b.rating, callBy: due ? due.toISOString() : null },
    due ? `Sorry about that. Someone from your care team will call you ${whenWords(due)}.` : "Thank you for telling us.");
});

medicineRoutes.get("/care/doses", async (c) => {
  const me = await requirePatient(c);
  const schedules = await sql`
    select id::text as id, medicine, cadence, weekday, times, paused,
      to_char(starts_on, 'YYYY-MM-DD') as "startsOn", to_char(ends_on, 'YYYY-MM-DD') as "endsOn"
    from dose_schedules where patient_id = ${me.id} and (ends_on is null or ends_on >= (now() at time zone 'Asia/Kolkata')::date)
    order by id`;
  const events = await sql`
    select e.id::text as id, e.schedule_id::text as "scheduleId", s.medicine, ${iso("e.due_at")} as "dueAt", e.status,
      e.skip_reason as "skipReason"
    from dose_events e join dose_schedules s on s.id = e.schedule_id
    where e.patient_id = ${me.id} and e.due_at > now() - interval '35 days' and e.due_at < now() + interval '3 days'
    order by e.due_at desc limit 40`;
  return ok(c, { schedules, events });
});

medicineRoutes.patch("/care/doses/:scheduleId", async (c) => {
  const me = await requirePatient(c);
  const id = intParam(c.req.param("scheduleId"), "schedule");
  const b = await body<{ weekday?: unknown; time?: unknown; paused?: unknown }>(c);
  const [s] = await sql`select * from dose_schedules where id = ${id} and patient_id = ${me.id}`;
  if (!s) fail(404, "That reminder was not found.");
  const weekday = b.weekday === undefined ? s.weekday : Number(b.weekday);
  if (s.cadence === "WEEKLY" && !(Number.isInteger(weekday) && weekday >= 1 && weekday <= 7)) fail(400, "Choose a day of the week.");
  let times = s.times as string[];
  if (b.time !== undefined) {
    const time = String(b.time);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail(400, "Choose a time.");
    // one time for a once-a-day or weekly dose; a twice-a-day dose keeps its second time twelve hours on
    times = s.cadence === "TWICE_DAILY"
      ? [time, `${String((Number(time.slice(0, 2)) + 12) % 24).padStart(2, "0")}${time.slice(2)}`].sort()
      : [time];
  }
  const paused = b.paused === undefined ? s.paused : Boolean(b.paused);
  await sql.begin(async (tx) => {
    await tx`update dose_schedules set weekday = ${s.cadence === "WEEKLY" ? weekday : null}, times = ${times}, paused = ${paused} where id = ${id}`;
    // upcoming doses follow the new day and time; anything already logged stays as it was
    await tx`delete from dose_events where schedule_id = ${id} and status = 'DUE' and due_at > now()`;
  });
  if (!paused) await flow.makeDoseEvents(id);
  return ok(c, { id: String(id), weekday: s.cadence === "WEEKLY" ? weekday : null, times, paused }, paused ? "Reminders paused" : "Reminder saved");
});

medicineRoutes.post("/care/doses/events/:eventId", async (c) => {
  const me = await requirePatient(c);
  const id = intParam(c.req.param("eventId"), "dose");
  const b = await body<{ status?: string; reason?: string }>(c);
  if (b.status !== "TAKEN" && b.status !== "SKIPPED") fail(400, "Choose Taken or Skipped.");
  if (b.status === "SKIPPED" && b.reason && !SKIP_REASONS.includes(b.reason)) fail(400, "Choose a reason.");
  const [e] = await sql`select due_at from dose_events where id = ${id} and patient_id = ${me.id}`;
  if (!e) fail(404, "That dose was not found.");
  if (new Date(e.due_at).getTime() > Date.now() + 12 * 3600_000) fail(409, "You can log this dose on the day.");
  const due = await flow.recordDose(id, me.id, b.status as "TAKEN" | "SKIPPED", b.status === "SKIPPED" ? b.reason ?? "OTHER" : null);
  return ok(c, { status: b.status, callBy: due ? due.toISOString() : null },
    due ? `Thanks for telling us. Your care team will call you ${whenWords(due)}. If it feels severe, call 112.` : b.status === "TAKEN" ? "Logged" : "Thanks. Your health coach will see this.");
});
