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
  const out = { fulfilled: 0, tasks: 0, failed: 0 };
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
  // newest first: each order is checked on three nights, so a busy day never pushes a recent one out
  const stuck = await sql`
    select id, user_id, amount_paise, purpose from payment_orders
    where status = 'CREATED' and created_at between now() - interval '3 days' and now() - interval '30 minutes'
    order by created_at desc limit 100`;
  for (const p of stuck) {
    const paymentId = await capturedPaymentFor(p.id, p.amount_paise).catch((e) => (console.error("reconcile", p.id, e.message), null));
    if (!paymentId) continue;
    try {
      await fulfil(p.id, paymentId);
    } catch (e) {
      out.failed++;
      console.error("reconcile fulfil", p.id, (e as Error).message);
      continue;
    }
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
  // a daily step that fails is not marked done for the day, so the next tick tries it again
  const run = async (name: string, fn: () => Promise<unknown>, daily = false) => {
    try { steps[name] = await fn(); } catch (e) {
      steps[name] = { error: (e as Error).message };
      console.error("tick", name, e);
      if (daily) await sql`delete from job_runs where name = ${name}`.catch(() => {});
    }
  };
  // every step only queues; sendDue sends last within its own budget, so the tick ends well inside the
  // function's limit and what is left goes on the next one
  await run("followups", () => flow.advanceDueFollowups());
  await run("orders", () => flow.checkOrders());
  await run("doses", () => flow.checkDoses());
  if (await flow.firstRunToday("refills")) await run("refills", () => flow.checkRefills(), true);
  if (await flow.firstRunToday("reconcile")) await run("reconcile", () => reconcile(), true);
  await run("messages", () => sendDue(Math.max(10_000, 100_000 - (Date.now() - started))));
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
  let failed = 0;
  for (const event of wa.parseWebhook(payload)) {
    try {
      if (event.type === "status") {
        const column = { sent: null, delivered: "delivered_at", read: "read_at", failed: null }[event.status];
        // statuses can arrive out of order, and before our own write of the provider id: match on either,
        // and a later status never moves a message back
        await sql`update patient_messages set
            status = case when ${event.status} = 'failed' then 'FAILED'
                          when ${event.status} = 'read' then 'READ'
                          when ${event.status} = 'delivered' and status <> 'READ' then 'DELIVERED'
                          when ${event.status} = 'sent' and status = 'QUEUED' then 'SENT' else status end,
            provider_id = coalesce(provider_id, ${event.providerId || null}),
            delivered_at = case when ${column} = 'delivered_at' or ${column} = 'read_at' then coalesce(delivered_at, now()) else delivered_at end,
            read_at = case when ${column} = 'read_at' then coalesce(read_at, now()) else read_at end,
            error = coalesce(${event.error}, error)
          where provider_id = ${event.providerId} or (${event.ref}::int is not null and id = ${event.ref})`;
      } else {
        // patients act on their messages; anyone (a doctor too) can opt out with STOP
        const [u] = await sql`select id, role from users where mobile = ${event.from}`;
        if (u) await handleReply({ userId: u.id, role: u.role, ref: event.ref, code: event.code, text: event.text, eventId: event.eventId });
      }
    } catch (e) {
      failed++;
      console.error("whatsapp webhook", (e as Error).message);
    }
  }
  // a failure before the event was recorded (the database was away) asks Meta to send it again; recorded
  // events are dropped on the retry by their id, so nothing acts twice
  if (failed) return c.json({ success: false }, 500);
  return c.json({ success: true });
});
