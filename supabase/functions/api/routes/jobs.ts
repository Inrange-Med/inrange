// The scheduler and WhatsApp's webhook. Mounted at /api. docs/backend/medicine-flow.md, "The tick".
//   POST /jobs/tick           x-jobs-secret: JOBS_SECRET. Supabase cron calls it every 5 minutes; every step
//                             is idempotent and bounded, so a repeated, late or overlapping tick is harmless
//   GET  /webhooks/whatsapp   Meta's one-time verification (hub.verify_token = WHATSAPP_VERIFY_TOKEN)
//   POST /webhooks/whatsapp   replies and delivery statuses, signed with WHATSAPP_APP_SECRET
import { Hono } from "hono";
import { sql } from "../lib/db.ts";
import { env } from "../lib/env.ts";
import * as flow from "../lib/medicineFlow.ts";
import { sendDue } from "../lib/notify.ts";
import { handleReply } from "../lib/replies.ts";
import { capturedPaymentFor, safeEqual } from "../integrations/razorpay.ts";
import * as wa from "../integrations/whatsapp.ts";
import { fulfil } from "./payments.ts";

export const jobRoutes = new Hono();

/**
 * Daily: anything the payment provider and our records disagree on (PRD 11.5). A captured payment whose
 * webhook never arrived is fulfilled now, as the webhook would have; anything else becomes a task.
 */
export async function reconcile() {
  const out = { fulfilled: 0, tasks: 0 };
  const unfilled = await sql`
    select p.id, p.user_id, p.reference_id from payment_orders p
    where p.purpose = 'MEDICINE_ORDER' and p.status = 'PAID'
      and not exists (select 1 from medicine_orders o where o.payment_order_id = p.id)`;
  for (const p of unfilled)
    if (await flow.openTask(sql, {
      kind: "RECONCILE", priority: "CRITICAL", patientId: p.user_id, paymentOrderId: p.id, cartId: Number(p.reference_id) || null,
      title: "Paid for medicines, but no delivery order exists", detail: `Payment ${p.id}. Create the delivery or refund.`,
      dueAt: new Date(), dedupeKey: `reconcile:${p.id}:no-order`,
    })) out.tasks++;
  const stuck = await sql`
    select id, user_id, amount_paise, purpose from payment_orders
    where status = 'CREATED' and created_at between now() - interval '3 days' and now() - interval '30 minutes'
    order by created_at limit 40`;
  for (const p of stuck) {
    const paymentId = await capturedPaymentFor(p.id, p.amount_paise).catch((e) => (console.error("reconcile", p.id, e.message), null));
    if (!paymentId) continue;
    await fulfil(p.id, paymentId);
    out.fulfilled++;
    await flow.openTask(sql, {
      kind: "RECONCILE", priority: "NORMAL", patientId: p.user_id, paymentOrderId: p.id,
      title: "A payment was confirmed by the nightly check", detail: `Razorpay captured ${paymentId} but its webhook never arrived. It is fulfilled now; check the Razorpay webhook settings.`,
      dueAt: flow.todayAt("12:00"), dedupeKey: `reconcile:${p.id}:late`,
    });
  }
  return out;
}

jobRoutes.post("/jobs/tick", async (c) => {
  if (!env.jobsSecret) return c.json({ success: false, message: "JOBS_SECRET is not set." }, 503);
  if (!safeEqual(c.req.header("x-jobs-secret") ?? "", env.jobsSecret)) return c.json({ success: false, message: "Unauthorised" }, 401);
  const started = Date.now();
  const steps: Record<string, unknown> = {};
  // each step on its own: one failing never stops the others
  const run = async (name: string, fn: () => Promise<unknown>) => {
    try { steps[name] = await fn(); } catch (e) { steps[name] = { error: (e as Error).message }; console.error("tick", name, e); }
  };
  await run("followups", () => flow.advanceDueFollowups());
  await run("orders", () => flow.checkOrders());
  await run("doses", () => flow.checkDoses());
  if (await flow.firstRunToday("refills")) await run("refills", () => flow.checkRefills());
  if (await flow.firstRunToday("reconcile")) await run("reconcile", () => reconcile());
  await run("messages", () => sendDue());
  await sql`insert into job_runs (name, last_run_at, summary) values ('tick', now(), ${sql.json(steps as never)})
            on conflict (name) do update set last_run_at = now(), summary = excluded.summary`;
  return c.json({ success: true, data: { ms: Date.now() - started, steps } });
});

jobRoutes.get("/webhooks/whatsapp", (c) => {
  const q = c.req.query();
  if (q["hub.mode"] === "subscribe" && env.whatsappVerifyToken && safeEqual(q["hub.verify_token"] ?? "", env.whatsappVerifyToken))
    return c.text(q["hub.challenge"] ?? "");
  return c.text("Forbidden", 403);
});

jobRoutes.post("/webhooks/whatsapp", async (c) => {
  const raw = await c.req.text();
  if (!(await wa.webhookSignatureValid(raw, c.req.header("X-Hub-Signature-256") ?? "")))
    return c.json({ success: false, message: "Invalid signature" }, 401);
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return c.json({ success: true }); }
  for (const event of wa.parseWebhook(payload)) {
    try {
      if (event.type === "status") {
        const column = { sent: null, delivered: "delivered_at", read: "read_at", failed: null }[event.status];
        // statuses can arrive out of order: a later one never moves a message back
        await sql`update patient_messages set
            status = case when ${event.status} = 'failed' then 'FAILED'
                          when ${event.status} = 'read' then 'READ'
                          when ${event.status} = 'delivered' and status <> 'READ' then 'DELIVERED' else status end,
            delivered_at = case when ${column} = 'delivered_at' or ${column} = 'read_at' then coalesce(delivered_at, now()) else delivered_at end,
            read_at = case when ${column} = 'read_at' then coalesce(read_at, now()) else read_at end,
            error = coalesce(${event.error}, error)
          where provider_id = ${event.providerId}`;
      } else {
        const [u] = await sql`select id from users where mobile = ${event.from} and role = 'PATIENT'`;
        if (u) await handleReply({ patientId: u.id, ref: event.ref, code: event.code, text: event.text, eventId: event.eventId });
      }
    } catch (e) {
      console.error("whatsapp webhook", (e as Error).message);
    }
  }
  // always 200 once the signature is good: Meta retries anything else for days
  return c.json({ success: true });
});
