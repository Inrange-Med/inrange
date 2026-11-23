// Payments (Razorpay) and the two vendor webhooks. Contract: docs/backend/payments-razorpay.md.
//   POST /payments/orders        { purpose, referenceId, reason? } -> PaymentOrder (the server prices it)
//   POST /payments/verify        { orderId, razorpayPaymentId, razorpaySignature } -> { status: "PAID", purpose, referenceId }
//   GET  /payments               the patient's paid orders (invoices), newest first
//   GET  /payments/link-return   where Razorpay sends the customer after a payment link; checks the link, then the app
//   POST /webhooks/razorpay      X-Razorpay-Signature over the raw body; payment.captured / order.paid / payment.failed,
//                                and payment_link.paid / .cancelled / .expired (lib/paymentLinks.ts)
//                                (register ...?forceFunctionRegion=ap-south-1 in the Dashboard, Test and Live separately)
//   POST /webhooks/redcliffe     x-redcliffe-secret header or ?token=; moves lab bookings and eligibility along
// Mock mode (no Razorpay keys): orders are "order_mock_..." with razorpayKeyId "rzp_mock"; verify accepts them unsigned.
import { Hono } from "hono";
import type { TransactionSql } from "postgres";
import { sql } from "../lib/db.ts";
import { body, fail, HttpError, ok } from "../lib/http.ts";
import { requirePatient } from "../lib/auth.ts";
import { env } from "../lib/env.ts";
import { setEligibility } from "../lib/eligibility.ts";
import { bookAppointment, holdSlot } from "../lib/booking.ts";
import * as rzp from "../integrations/razorpay.ts";
import { applyLabEvent, fulfilLabBooking, type LabEvent } from "./labs.ts";
import * as rc from "../integrations/redcliffe.ts";
import { priceCart, startPlan, type CartLine } from "../lib/pharmacy.ts";
import { deliverQueued, onMedicinePaid, onMedicinePaymentFailed } from "../lib/medicineFlow.ts";
import { spokenSlot } from "../lib/hours.ts";
import * as notices from "../lib/notices.ts";
import { sendNow } from "../lib/notify.ts";
import * as links from "../lib/paymentLinks.ts";

export const paymentRoutes = new Hono();

const PURPOSES = ["PLAN", "LAB_BOOKING", "CONSULTATION_FEE", "MEDICINE_ORDER"] as const;
type Purpose = typeof PURPOSES[number];
type Priced = { amountPaise: number; title: string; lineItems: { label: string; amountPaise: number }[]; meta?: Record<string, unknown> };

const rupees = (r: number) => Math.round(Number(r) * 100);

async function price(tx: TransactionSql, userId: number, purpose: Purpose, referenceId: string, reason: string | null): Promise<Priced> {
  if (purpose === "PLAN") {
    const [plan] = await tx`select * from plans where id = ${Number(referenceId) || 0}`;
    if (!plan || !plan.active || !(plan.price_rupees > 0)) fail(400, "This plan is not available any more.");
    const [active] = await tx`select 1 from subscriptions where user_id = ${userId} and status = 'Active' and ends_at > now()`;
    if (active) fail(409, "You already have an active plan.");
    const amountPaise = rupees(plan.price_rupees);
    return { amountPaise, title: plan.name, lineItems: [{ label: plan.name, amountPaise }] };
  }

  if (purpose === "LAB_BOOKING") {
    const [b] = await tx`select * from lab_bookings where id = ${referenceId} for update`;
    if (!b || b.user_id !== userId) fail(400, "That lab booking was not found.");
    if (b.paid_at || b.status !== "PAYMENT_PENDING" && b.status !== "EXPIRED") {
      if (b.paid_at) fail(409, "This lab booking is already paid.");
      fail(400, "This lab booking was cancelled. Book a new time.");
    }
    const left = b.hold_expires_at ? new Date(b.hold_expires_at).getTime() - Date.now() : 0;
    if (b.status === "EXPIRED" || left <= 0) fail(400, "The 30-minute hold on this time has ended. Book the time again.");
    if (left < 2 * 60_000) fail(409, "The hold on this time ends in under 2 minutes. Book the time again.");
    const p = { packagePrice: 0, discount: 0, collectionCharge: 0, total: 0, ...(b.price ?? {}) };
    let lineItems: Priced["lineItems"];
    if (b.care_package_code) {
      const [care] = await tx`select name from care_packages where code = ${b.care_package_code}`;
      const addOns = (p.addOns ?? []) as { name: string; price: number }[];
      lineItems = [
        { label: care?.name ?? "Lab tests and consultation", amountPaise: rupees(p.packagePrice) },
        ...addOns.map((a) => ({ label: a.name, amountPaise: rupees(a.price) })),
      ];
    } else {
      lineItems = [{ label: b.package_name ?? "Home blood test", amountPaise: rupees(p.packagePrice) }];
      if (p.collectionCharge > 0) lineItems.push({ label: "Home collection", amountPaise: rupees(p.collectionCharge) });
      if (p.discount > 0) lineItems.push({ label: "Discount", amountPaise: -rupees(p.discount) });
    }
    const amountPaise = rupees(p.total);
    if (lineItems.reduce((n, l) => n + l.amountPaise, 0) !== amountPaise) lineItems = [{ label: b.package_name ?? "Home blood test", amountPaise }];
    return { amountPaise, title: b.care_package_code ? lineItems[0].label : `Home blood test: ${b.package_name ?? b.lab_package_code}`, lineItems };
  }

  if (purpose === "MEDICINE_ORDER") {
    // referenceId: the cart. Priced from the live catalogue; the order keeps the lines it charged for.
    const [k] = await tx`
      select k.*, p.months, p.valid_until from medicine_carts k join prescriptions p on p.id = k.prescription_id
      where k.id = ${Number(referenceId) || 0} for update of k`;
    if (!k || k.patient_id !== userId) fail(400, "That cart was not found.");
    if (k.status === "PAID") fail(409, "These medicines are already paid for.");
    if (k.status !== "OPEN" || (k.valid_until && new Date(k.valid_until) <= new Date()))
      fail(400, "This prescription has ended. Your doctor will send a new one.");
    if (!k.address_id) fail(400, "Add a delivery address first.");
    const priced = await priceCart(tx, k as never);
    const bought = priced.lines.filter((l) => l.quantity > 0);
    if (!bought.length && !priced.plan) fail(400, "Your cart is empty.");
    // one payment for everything the prescription carries: the plan and the medicines (19 Nov 2026)
    const lineItems = [
      ...(priced.plan ? [{ label: priced.plan.name, amountPaise: priced.plan.pricePaise }] : []),
      ...bought.map((l) => ({ label: `${l.brand} ${l.strength} x ${l.quantity}`, amountPaise: l.mrpPaise * l.quantity })),
    ];
    if (priced.discountPaise > 0) lineItems.push({ label: `Discount, ${priced.discountPercent}%`, amountPaise: -priced.discountPaise });
    return {
      amountPaise: priced.totalPaise, title: priced.plan ? "Your plan and medicines" : "Your medicines", lineItems,
      // `paid`: the quantities this payment is for; fulfil writes them back, so a cart changed in another tab
      // during checkout never decides the supply, the doses or the refill
      meta: { addressId: k.address_id, planId: priced.plan ? Number(priced.plan.id) : null,
        lines: bought.map((l) => ({ name: `${l.brand} ${l.strength}`, quantity: `${l.quantity} x ${l.pack}` })),
        paid: bought.map((l) => ({ medicineId: Number(l.medicineId), quantity: l.quantity })) },
    };
  }

  // CONSULTATION_FEE: a paid consultation (first or follow-up), for a patient cleared to book
  const [e] = await tx`select stage, consultation_paid, consultation_used from eligibility where user_id = ${userId}`;
  if (e?.stage !== "APPROVED") fail(400, "You can book once a doctor has reviewed your blood test.");
  if (e.consultation_paid && !e.consultation_used) fail(409, "Your first consultation is already paid. Book a time directly.");
  const slot = await holdSlot(tx, userId, Number(referenceId) || 0);
  const [fee] = await tx`select price_rupees from care_packages where code = 'CONSULT_ONLY'`;
  const amountPaise = rupees(fee?.price_rupees ?? slot.feeRupees);
  const [{ n: earlier }] = await tx`select count(*)::int as n from appointments where patient_id = ${userId} and status <> 'Cancelled'`;
  return {
    amountPaise,
    title: `Video consultation, ${spokenSlot(slot.slotDate, slot.startTime)}`,
    // never a length (client call, 12 Nov 2026): the first call runs about an hour, doctor then coach
    lineItems: [{ label: earlier ? "Follow-up consultation" : "First consultation", amountPaise }],
    meta: { reason, slotId: slot.slotId, doctorId: slot.doctorId },
  };
}

// deno-lint-ignore no-explicit-any
const toOrder = (o: Record<string, any>) => ({
  orderId: o.id,
  amountPaise: o.amount_paise,
  currency: o.currency,
  razorpayKeyId: o.provider === "razorpay" ? env.razorpayKeyId : rzp.MOCK_KEY_ID,
  title: o.title,
  lineItems: o.line_items,
});

paymentRoutes.post("/payments/orders", async (c) => {
  const me = await requirePatient(c);
  const input = await body<{ purpose?: string; referenceId?: string | number; reason?: string }>(c);
  const purpose = String(input.purpose ?? "").toUpperCase() as Purpose;
  const referenceId = String(input.referenceId ?? "").trim();
  if (!PURPOSES.includes(purpose) || !referenceId) fail(400, "This payment is missing what it is for.");
  const reason = typeof input.reason === "string" && input.reason.trim() ? input.reason.trim().slice(0, 1000) : null;

  const order = await sql.begin(async (tx) => {
    const priced = await price(tx, me.id, purpose, referenceId, reason);
    const provider = rzp.razorpayLive() ? "razorpay" : "mock";
    const [existing] = await tx`
      select * from payment_orders where user_id = ${me.id} and purpose = ${purpose} and reference_id = ${referenceId}
        and status = 'CREATED' and amount_paise = ${priced.amountPaise} and provider = ${provider}
      order by created_at desc limit 1`;
    if (existing) {
      if (priced.meta) await tx`update payment_orders set meta = ${tx.json(priced.meta as never)} where id = ${existing.id}`;
      return existing;
    }
    const receipt = `${purpose.slice(0, 4)}-${me.id}-${Date.now().toString(36)}`;
    const id = await rzp.createOrder(priced.amountPaise, receipt, { userId: String(me.id), purpose, referenceId })
      .catch(() => fail(502, "The payment could not be prepared. Please try again."));
    const [row] = await tx`
      insert into payment_orders (id, user_id, purpose, reference_id, amount_paise, title, line_items, provider, meta)
      values (${id}, ${me.id}, ${purpose}, ${referenceId}, ${priced.amountPaise}, ${priced.title},
        ${tx.json(priced.lineItems)}, ${provider}, ${tx.json((priced.meta ?? {}) as never)})
      returning *`;
    return row;
  });
  return ok(c, toOrder(order), "Order created");
});

/**
 * Marks the order PAID and fulfils it, once (guarded by fulfilled_at under a row lock). Shared by
 * /payments/verify and the webhook, so whichever arrives second does nothing. A fulfilment the
 * world refuses (slot taken, lab hold gone) keeps the payment PAID and is flagged in meta.needsAttention.
 */
export async function fulfil(orderId: string, paymentId: string) {
  let medicineOrderId: number | null = null;
  // WhatsApp messages queued with the fulfilment, sent once it has committed
  const messages: (number | null)[] = [];
  const done = await sql.begin(async (tx) => {
    const [o] = await tx`select * from payment_orders where id = ${orderId} for update`;
    if (!o) throw new HttpError(400, "That payment was not found.");
    if (o.fulfilled_at) return o;
    const [{ n }] = await tx`select nextval('invoice_seq') as n`;
    const invoice = `INR-${new Date().getUTCFullYear()}-${String(n).padStart(6, "0")}`;
    const meta: Record<string, unknown> = { ...(o.meta ?? {}) };

    if (o.purpose === "PLAN") {
      await startPlan(tx, o.user_id, Number(o.reference_id), o.id);
    } else if (o.purpose === "MEDICINE_ORDER") {
      // the plan the prescription carried was in this payment: it starts now
      if (meta.planId) await startPlan(tx, o.user_id, Number(meta.planId), o.id);
      // the cart keeps every prescribed line, with the quantities this payment was for
      const paid = (meta.paid ?? null) as { medicineId: number; quantity: number }[] | null;
      const [cart] = await tx`select lines from medicine_carts where id = ${Number(o.reference_id)} for update`;
      const lines = paid && cart
        ? (cart.lines as CartLine[]).map((l) => ({ ...l, quantity: paid.find((p) => p.medicineId === l.medicineId)?.quantity ?? 0 }))
        : cart?.lines ?? [];
      const [k] = await tx`update medicine_carts set status = 'PAID', paid_at = now(), lines = ${tx.json(lines as never)}
                           where id = ${Number(o.reference_id)} returning prescription_id`;
      const [mo] = !paid || paid.length ? await tx`insert into medicine_orders (patient_id, prescription_id, cart_id, address_id, payment_order_id, status, expected_at, items, history)
        values (${o.user_id}, ${k?.prescription_id ?? null}, ${Number(o.reference_id)}, ${(meta.addressId as number) ?? null}, ${o.id},
          'PLACED', now() + interval '3 days', ${tx.json((meta.lines ?? []) as never)},
          ${tx.json([{ status: "PLACED", at: new Date().toISOString(), note: "Order received by the pharmacy" }])})
        returning id` : [];
      // the follow-up closes, the supply and the dose rhythm are worked out, the confirmation is queued (lib/medicineFlow.ts)
      if (mo) await onMedicinePaid(tx, mo.id);
      medicineOrderId = mo?.id ?? null;
    } else if (o.purpose === "LAB_BOOKING") {
      await fulfilLabBooking(tx, o.reference_id, o.user_id);
      messages.push(...(await notices.within(tx, (sp) => notices.labBooked(sp, o.reference_id))));
    } else {
      await setEligibility(tx, o.user_id, { consultation_paid: true });
      try {
        const { appointmentId } = await tx.savepoint((sp) =>
          bookAppointment(sp, { patientId: o.user_id, slotId: Number(o.reference_id), reason: (meta.reason as string) ?? null, prepaid: true }));
        meta.appointmentId = appointmentId;
        await setEligibility(tx, o.user_id, { consultation_used: true });
        messages.push(...(await notices.within(tx, (sp) => notices.appointmentBooked(sp, appointmentId))));
      } catch (e) {
        meta.needsAttention = `Paid, but the slot could not be booked: ${(e as Error).message}`;
        console.error("consultation fulfil", o.id, meta.needsAttention);
      }
    }
    const [done] = await tx`
      update payment_orders set status = 'PAID', provider_payment_id = ${paymentId}, paid_at = coalesce(paid_at, now()),
        invoice_number = coalesce(invoice_number, ${invoice}), fulfilled_at = now(), meta = ${tx.json(meta as never)}
      where id = ${o.id} returning *`;
    return done;
  });
  // the confirmations go once the payment is committed
  if (medicineOrderId) await deliverQueued({ medicineOrderId }).catch((e) => console.error("order confirmation", e.message));
  await sendNow(messages);
  return done;
}

paymentRoutes.post("/payments/verify", async (c) => {
  const me = await requirePatient(c);
  const input = await body<{ orderId?: string; razorpayPaymentId?: string; razorpaySignature?: string }>(c);
  const [o] = await sql`select * from payment_orders where id = ${String(input.orderId ?? "")} and user_id = ${me.id}`;
  if (!o) fail(400, "That payment was not found.");
  if (!o.fulfilled_at) {
    const paymentId = String(input.razorpayPaymentId ?? "");
    // a mock order was never sent to Razorpay, so it has no signature; once live keys are set, leftover
    // mock orders can no longer be "paid" this way
    const valid = o.provider === "mock"
      ? !rzp.razorpayLive()
      : await rzp.checkoutSignatureValid(o.id, paymentId, String(input.razorpaySignature ?? ""));
    if (!valid || !paymentId) fail(400, "Payment could not be verified.");
    // a valid signature proves the payment was authorised; Razorpay says to deliver only once it is captured
    if (o.provider === "razorpay") {
      const captured = await rzp.paymentCaptured(paymentId, o.id, o.amount_paise)
        .catch(() => fail(502, "We could not reach the payment provider to confirm. Please try again."));
      if (!captured) fail(409, "Your payment is not confirmed yet. Please try again in a moment.");
    }
    await fulfil(o.id, paymentId);
  }
  return ok(c, { status: "PAID", purpose: o.purpose, referenceId: o.reference_id }, "Payment verified");
});

paymentRoutes.get("/payments", async (c) => {
  const me = await requirePatient(c);
  const rows = await sql`select * from payment_orders where user_id = ${me.id} and status = 'PAID' order by paid_at desc`;
  return ok(c, rows.map((r) => ({
    id: r.id, purpose: r.purpose, title: r.title, amountPaise: r.amount_paise,
    paidAt: new Date(r.paid_at).toISOString(), invoiceNumber: r.invoice_number ?? "", invoiceUrl: null,
  })), "Payments");
});

/**
 * Where Razorpay sends the customer after paying on a payment link. Nothing in the address is trusted: it only
 * names a link of ours, which is then checked with Razorpay (the plan starts there). Then on to the app.
 */
paymentRoutes.get("/payments/link-return", async (c) => {
  const id = String(c.req.query("razorpay_payment_link_id") ?? "");
  if (/^plink_[A-Za-z0-9]+$/.test(id)) await links.check(id).catch((e) => console.error("link return", id, (e as Error).message));
  return c.redirect(`${env.appUrl}/patient-dashboard`, 302);
});

// ---------------------------------------------------------------- webhooks (no user auth; trust is the signature)

paymentRoutes.post("/webhooks/razorpay", async (c) => {
  const raw = await c.req.text();
  if (!(await rzp.webhookSignatureValid(raw, c.req.header("X-Razorpay-Signature") ?? "")))
    return c.json({ success: false, message: "Invalid signature" }, 400);
  // an event is recorded only once handled, so a failed attempt is redone on Razorpay's retry
  // (handling twice is harmless: fulfil() runs once per order)
  const eventId = c.req.header("X-Razorpay-Event-Id") ?? null;
  if (eventId && (await sql`select 1 from razorpay_events where id = ${eventId}`).length) return c.json({ success: true });
  const event = JSON.parse(raw);
  const payment = event?.payload?.payment?.entity ?? {};
  // a payment link's events (payment_link.paid, .cancelled, .expired): the body only tells us which link to ask
  // Razorpay about; lib/paymentLinks.ts check() reads its real state and starts the plan
  const linkId = String(event.event ?? "").startsWith("payment_link.") ? String(event?.payload?.payment_link?.entity?.id ?? "") : "";
  if (linkId) {
    await links.check(linkId);
    if (eventId) await sql`insert into razorpay_events (id) values (${eventId}) on conflict do nothing`;
    return c.json({ success: true });
  }
  const orderId = payment.order_id ?? event?.payload?.order?.entity?.id;
  const [o] = orderId ? await sql`select * from payment_orders where id = ${orderId}` : [];
  if (!o) {
    // captured money that is no order of ours: one of our links (its own event may come later, so the payer's
    // waiting link is checked now), or a payment taken outside the app, kept for admin to put against a patient
    if (event.event === "payment.captured" && /^pay_[A-Za-z0-9]+$/.test(String(payment.id ?? "")) && payment.currency === "INR") {
      const mobile = rzp.mobileOf(payment.contact);
      const waiting = mobile ? await sql`select l.id from payment_links l join users u on u.id = l.patient_id
        where u.mobile = ${mobile} and l.status = 'CREATED' and l.amount_paise = ${Number(payment.amount)}` : [];
      for (const l of waiting) await links.check(l.id).catch((e) => console.error("link check", l.id, (e as Error).message));
      await sql`insert into received_payments (id, amount_paise, mobile, email, method, description)
        select ${payment.id}, ${Number(payment.amount)}, ${mobile}, ${String(payment.email ?? "").slice(0, 120) || null},
          ${String(payment.method ?? "").slice(0, 30) || null}, ${String(payment.description ?? "").slice(0, 200) || null}
        where not exists (select 1 from payment_orders where provider_payment_id = ${payment.id})
          and not exists (select 1 from plan_recommendations where payment_ref = ${payment.id})
        on conflict (id) do nothing`;
      if (eventId) await sql`insert into razorpay_events (id) values (${eventId}) on conflict do nothing`;
    }
    return c.json({ success: true }); // not ours (or another environment's)
  }
  if (event.event === "payment.captured" || event.event === "order.paid") {
    // both events mean the money is captured; it must be this order's exact amount in INR
    if (payment.amount !== undefined && (Number(payment.amount) !== o.amount_paise || payment.currency !== "INR")) {
      console.error("razorpay amount mismatch", orderId, payment.amount, payment.currency, o.amount_paise);
      return c.json({ success: true });
    }
    await fulfil(o.id, payment.id ?? o.provider_payment_id ?? "");
  } else if (event.event === "payment.failed" && o.status === "CREATED") {
    // not final: a UPI retry can still be captured later, and the order stays payable
    await sql`update payment_orders set failure_reason = ${payment.error_description ?? "Payment failed"} where id = ${o.id}`;
    // the patient hears it a quarter of an hour later unless it went through by then; for medicines the
    // team also checks in if it stays unpaid
    await notices.paymentFailed(o as { id: string; user_id: number; purpose: string }).catch((e) => console.error("payment failed message", e.message));
    if (o.purpose === "MEDICINE_ORDER") await onMedicinePaymentFailed(o.id).catch((e) => console.error("payment failed task", e.message));
  }
  if (eventId) await sql`insert into razorpay_events (id) values (${eventId}) on conflict do nothing`;
  return c.json({ success: true });
});

// Redcliffe's webhook type -> our booking event ("refresh" types only update tracking on the next read)
const REDCLIFFE_EVENTS: Record<string, LabEvent | null> = {
  phleboassigned: "COLLECTOR_ASSIGNED", pickup: "SAMPLE_COLLECTED", resample: "BOOKED",
  samplesync: "PROCESSING", partialreport: "PROCESSING", consolidatereport: "REPORT_READY", cancelled: "CANCELLED",
  booking_created: null, reportvalues: null, pickup_hold: null,
};

paymentRoutes.post("/webhooks/redcliffe", async (c) => {
  // ponytail: Redcliffe's create-update-webhook drops auth_key/auth_value (staging, Nov 2026), so the secret
  // also rides in the registered URL as ?token=. Prefer the header if they ever start sending it.
  const secret = c.req.header("x-redcliffe-secret") ?? c.req.query("token") ?? "";
  if (!env.redcliffeWebhookSecret || !rzp.safeEqual(secret, env.redcliffeWebhookSecret))
    return c.json({ success: false, message: "Unauthorised" }, 401);
  const event = await body<{ webhook_type?: string; data?: { booking_id?: number; client_refid?: string | null; data?: Record<string, unknown> } }>(c);
  const ref = event.data?.client_refid ?? null;
  const partner = event.data?.booking_id != null ? String(event.data.booking_id) : null;
  const [row] = await sql`select id from lab_bookings where (${ref}::text is not null and id = ${ref}) or provider_booking_id = ${partner} limit 1`;
  if (!row) return c.json({ success: true });
  const type = String(event.webhook_type ?? "");
  await sql`insert into lab_booking_events (lab_booking_id, webhook_type, payload) values (${row.id}, ${type}, ${sql.json(event as never)})`;
  // staging payloads carry: customer_status ("phlebo assigned"), phlebo_name, phlebo_contact,
  // sample_collection_date, start_time, ref_booking_end_time
  const d = event.data?.data ?? {};
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  if (type === "rescheduled") {
    const date = str(d.sample_collection_date) ?? str(d.collection_date);
    const start = str(d.start_time)?.slice(0, 5) ?? null;
    const end = str(d.ref_booking_end_time)?.slice(0, 5) ?? null;
    if (date) await sql`update lab_bookings set slot_date = ${date}, slot_start = coalesce(${start}, slot_start),
      slot_time = coalesce(${start}, slot_time), slot_end = coalesce(${end}, slot_end), updated_at = now() where id = ${row.id}`;
  }
  const journey = type === "phlebo_started_journey" ? "ON_THE_WAY" : type === "phlebo_end_journey" ? "ARRIVED" : null;
  if (str(d.phlebo_name) || journey) {
    await sql`update lab_bookings set collector = coalesce(collector, '{"trackingUrl": null}'::jsonb) || ${sql.json({
      ...(str(d.phlebo_name) ? { name: str(d.phlebo_name), phone: str(d.phlebo_contact) ?? "" } : {}),
      ...(journey ? { journey } : {}),
    })}, updated_at = now() where id = ${row.id}`;
  }
  const mapped = type in REDCLIFFE_EVENTS ? REDCLIFFE_EVENTS[type] : journey ? "COLLECTOR_ASSIGNED" : rc.stageFromWords(d.customer_status);
  // during a dry run (PILOT_LAB_SIMULATION) the admin walks the steps; the QA lab's events would fight them
  if (mapped && !env.pilotLabSimulation) await applyLabEvent(row.id, mapped).catch((e) => console.error("redcliffe webhook event", row.id, type, e.message));
  return c.json({ success: true });
});
