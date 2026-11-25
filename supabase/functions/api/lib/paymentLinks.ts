// Payment links for a plan (23 Nov 2026 call): the salesperson (or admin) makes a link for one patient, one plan
// and an agreed price, and sends it to the customer. The link knows who it is for, so when it is paid the plan
// starts by itself and the sale is recorded from what the link carries: nobody types a payment ID.
// A payment reaches us three ways, and each only makes us ask Razorpay what the link's state is (check):
// the webhook (payment_link.paid), the customer's return from Razorpay's page, and the scheduler every 5 minutes.
// One link waits per patient: a new one cancels the last, and so does putting the patient on a plan another way.
import type { TransactionSql } from "postgres";
import { sql } from "./db.ts";
import { env, isTestMobile } from "./env.ts";
import { fail } from "./http.ts";
import { onPlan, startPlan } from "./pharmacy.ts";
import * as rzp from "../integrations/razorpay.ts";
import * as notices from "./notices.ts";
import { sendNow } from "./notify.ts";
import { openTask } from "./medicineFlow.ts";
import { fulfilLabBooking } from "../routes/labs.ts";

const DAYS_OPEN = 7;
const words = (v: unknown, max: number) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max) || null;

export type LinkInput = { planId: unknown; discountPercent?: unknown; coachPreference?: unknown; note?: unknown };
type Maker = { userId: number; seller: { id: number; full_name: string } | null; isAdmin: boolean };

const view = sql`
  l.id, l.patient_id::text as "patientId", l.plan_id::text as "planId", l.purpose,
  coalesce(p.name, 'Blood tests and consultation') as "planName", l.status, l.short_url as url,
  l.list_paise / 100 as "listRupees", l.amount_paise / 100 as "amountRupees", l.salesperson, l.coach_preference as "coachPreference",
  l.note, l.provider_payment_id as "paymentId", l.needs_attention as "needsAttention", l.provider = 'mock' as test,
  to_char(l.created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') as "createdAt",
  to_char(l.expires_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') as "expiresAt",
  to_char(l.paid_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') as "paidAt"`;

/** A patient's links, newest first. */
export const linksFor = (patientId: number) => sql`
  select ${view} from payment_links l left join plans p on p.id = l.plan_id where l.patient_id = ${patientId} order by l.created_at desc limit 10`;

/** Every link, newest first, with who it is for (admin's Payments view). */
export const allLinks = () => sql`
  select ${view}, coalesce(nullif(trim(concat_ws(' ', pp.first_name, pp.last_name)), ''), u.full_name, 'Patient ' || u.id) as "patientName", u.mobile as "patientMobile"
  from payment_links l left join plans p on p.id = l.plan_id join users u on u.id = l.patient_id
  left join patient_profiles pp on pp.user_id = l.patient_id
  order by (l.status = 'CREATED') desc, l.created_at desc limit 150`;

/**
 * Cancels the patient's waiting link for a plan, or for a blood test, here and at Razorpay (best effort there: one
 * already paid is left to check()). The two kinds never touch each other: a patient can owe both at once.
 */
export async function cancelOpen(tx: TransactionSql | typeof sql, patientId: number, purpose: "PLAN" | "LAB_BOOKING" = "PLAN") {
  const open = await tx`update payment_links set status = 'CANCELLED'
                        where patient_id = ${patientId} and status = 'CREATED' and purpose = ${purpose} returning id`;
  // one Razorpay will not cancel may have just been paid: look, so the money is never lost
  for (const l of open) if (!(await rzp.cancelPaymentLink(l.id))) await check(l.id).catch((e) => console.error("link check", l.id, (e as Error).message));
}

export async function createLink(patient: { id: number; name: string; mobile: string }, input: LinkInput, by: Maker) {
  const [plan] = await sql`select id, name, price_rupees, max_sales_discount_percent from plans
                           where id = ${Number(input.planId) || 0} and active and price_rupees > 0`;
  if (!plan) fail(400, "That plan is not available.");
  if (await onPlan(sql, patient.id)) fail(409, "This patient is already on a plan.");
  const percent = input.discountPercent == null || input.discountPercent === "" ? 0 : Number(input.discountPercent);
  // a salesperson gives up to what admin allowed on the plan; admin, anything short of free
  const most = by.isAdmin ? 90 : plan.max_sales_discount_percent;
  if (!Number.isInteger(percent) || percent < 0) fail(400, "The discount is a whole number of percent.");
  if (percent > most) fail(400, most ? `The most you can take off this plan is ${most}%.` : "This plan has no discount. Ask admin for one.");
  const listPaise = plan.price_rupees * 100;
  // whole rupees, so the customer never sees paise
  const amountPaise = Math.round(plan.price_rupees * (100 - percent) / 100) * 100;
  const expiresAt = new Date(Date.now() + DAYS_OPEN * 86_400_000);
  // one waiting link per patient, and never beside a plan waiting to be paid for in the app
  await cancelOpen(sql, patient.id);
  const test = isTestMobile(patient.mobile);
  const made = await rzp.createPaymentLink({
    amountPaise, description: `inrange ${plan.name}`, referenceId: `P${patient.id}-${Date.now().toString(36)}`,
    customer: { name: patient.name, mobile: patient.mobile }, expiresAt,
    notes: { patientId: String(patient.id), planId: String(plan.id), purpose: "PLAN_LINK" },
    callbackUrl: `${env.supabaseUrl}/functions/v1/api/payments/link-return`,
    // Razorpay texts the link to a real customer; a test number is never texted
    textTheCustomer: !test,
  }).catch(() => fail(502, "The payment link could not be made. Please try again."));
  await sql.begin(async (tx) => {
    await tx`delete from plan_recommendations where patient_id = ${patient.id}
             and created_at > coalesce((select max(s.created_at) from subscriptions s where s.user_id = ${patient.id}), '-infinity')`;
    await tx`insert into payment_links (id, patient_id, plan_id, list_paise, amount_paise, short_url, provider, salesperson_id, salesperson,
               coach_preference, note, created_by, expires_at)
             values (${made.id}, ${patient.id}, ${plan.id}, ${listPaise}, ${amountPaise}, ${made.shortUrl}, ${made.provider},
               ${by.seller?.id ?? null}, ${by.seller?.full_name ?? null}, ${words(input.coachPreference, 200)}, ${words(input.note, 1000)},
               ${by.userId}, ${expiresAt})`;
    if (by.seller)
      await tx`insert into patient_profiles (user_id, salesperson, salesperson_id) values (${patient.id}, ${by.seller.full_name}, ${by.seller.id})
               on conflict (user_id) do update set salesperson = excluded.salesperson, salesperson_id = excluded.salesperson_id`;
    await tx`insert into audit_log (patient_id, actor_id, action) values (${patient.id}, ${by.userId},
               ${`Made a payment link for ${plan.name}, Rs ${amountPaise / 100}${percent ? ` (${percent}% off)` : ""}`})`;
  });
  return { id: made.id, url: made.shortUrl, amountRupees: amountPaise / 100, texted: made.provider === "razorpay" && !test };
}

/**
 * A link for a blood test the team held for the patient: the amount is the booking's own. Paid, the collection is
 * confirmed as a payment in the app would (settle). The hold lasts 30 minutes; a payment after that books the time
 * again if it is still free, and is flagged for the team if it is not.
 */
export async function createLabLink(patient: { id: number; name: string; mobile: string }, booking: { id: string; amount_paise: number }, userId: number) {
  if (!(booking.amount_paise >= 100)) fail(409, "This booking has no amount to pay.");
  await cancelOpen(sql, patient.id, "LAB_BOOKING");
  const test = isTestMobile(patient.mobile);
  const expiresAt = new Date(Date.now() + 86_400_000);
  const made = await rzp.createPaymentLink({
    amountPaise: booking.amount_paise, description: "inrange blood tests and consultation", referenceId: `L${patient.id}-${Date.now().toString(36)}`,
    customer: { name: patient.name, mobile: patient.mobile }, expiresAt,
    notes: { patientId: String(patient.id), labBookingId: booking.id, purpose: "LAB_LINK" },
    callbackUrl: `${env.supabaseUrl}/functions/v1/api/payments/link-return`, textTheCustomer: !test,
  }).catch(() => fail(502, "The payment link could not be made. Please try again."));
  await sql`insert into payment_links (id, patient_id, purpose, lab_booking_id, list_paise, amount_paise, short_url, provider, created_by, expires_at)
            values (${made.id}, ${patient.id}, 'LAB_BOOKING', ${booking.id}, ${booking.amount_paise}, ${booking.amount_paise}, ${made.shortUrl},
              ${made.provider}, ${userId}, ${expiresAt})`;
  await sql`insert into audit_log (patient_id, actor_id, action) values (${patient.id}, ${userId}, ${`Made a payment link for the blood test, Rs ${booking.amount_paise / 100}`})`;
  return { id: made.id, url: made.shortUrl, amountRupees: booking.amount_paise / 100, texted: made.provider === "razorpay" && !test };
}

/**
 * The link was paid: the plan starts, once (the row lock and the status guard it). The sale is written from the
 * link: who sold it, the coach asked for, the note, the amount and Razorpay's payment ID. A patient who got onto
 * a plan another way in the meantime keeps that plan; the payment is flagged for the team to refund.
 */
export async function settle(linkId: string, paymentId: string) {
  const messages = await sql.begin(async (tx) => {
    const [l] = await tx`select l.*, p.name as plan_name from payment_links l left join plans p on p.id = l.plan_id where l.id = ${linkId} for update of l`;
    if (!l || l.status === "PAID") return [];
    const paid = { status: "PAID", paid_at: new Date(), provider_payment_id: paymentId };
    await tx`delete from received_payments where id = ${paymentId}`;
    if (l.purpose === "LAB_BOOKING") {
      // the booking was paid another way meanwhile, or cancelled: this money has nothing to book. Kept, flagged, refunded by the team.
      const [b] = await tx`select status, paid_at from lab_bookings where id = ${l.lab_booking_id} for update`;
      const [credit] = await tx`select 1 from eligibility where user_id = ${l.patient_id} and lab_credit`;
      if (!b || b.paid_at || b.status === "CANCELLED" || credit) {
        const why = b?.paid_at || credit ? "Paid on a link, but this blood test was already paid for. Refund it."
          : "Paid on a link, but this blood test was cancelled. Book a new time on this payment, or refund it.";
        await tx`update payment_links set ${tx({ ...paid, needs_attention: why })} where id = ${l.id}`;
        await openTask(tx, { kind: "RECONCILE", priority: "CRITICAL", patientId: l.patient_id, title: "A blood test payment link was paid with nothing to book",
          detail: `Link ${l.id}, payment ${paymentId}, Rs ${l.amount_paise / 100}. ${why}`, dueAt: new Date(), dedupeKey: `plink:${l.id}:lab` });
        return [];
      }
      // the blood test the team held: recorded and confirmed exactly as a payment in the app (routes/payments.ts fulfil)
      await tx`update payment_links set ${tx(paid)} where id = ${l.id}`;
      const [{ n }] = await tx`select nextval('invoice_seq') as n`;
      await tx`insert into payment_orders (id, user_id, purpose, reference_id, amount_paise, title, line_items, status, provider,
                 provider_payment_id, paid_at, invoice_number, fulfilled_at, meta)
               values (${l.id}, ${l.patient_id}, 'LAB_BOOKING', ${l.lab_booking_id}, ${l.amount_paise}, 'Blood tests and consultation',
                 ${tx.json([{ label: "Blood tests and consultation", amountPaise: l.amount_paise }])}, 'PAID', ${l.provider},
                 ${paymentId}, now(), ${`INR-${new Date().getUTCFullYear()}-${String(n).padStart(6, "0")}`}, now(), ${tx.json({ paymentLink: true })})
               on conflict (id) do nothing`;
      await fulfilLabBooking(tx, l.lab_booking_id, l.patient_id);
      await tx`insert into audit_log (patient_id, actor_id, action) values (${l.patient_id}, ${l.created_by}, ${`Blood test paid on a payment link (${paymentId})`})`;
      return await notices.within(tx, (sp) => notices.labBooked(sp, l.lab_booking_id));
    }
    if (await onPlan(tx, l.patient_id)) {
      const why = "Paid, but the patient was already on a plan. Refund it, or sort it out with them.";
      await tx`update payment_links set ${tx({ ...paid, needs_attention: why })} where id = ${l.id}`;
      await openTask(tx, { kind: "RECONCILE", priority: "CRITICAL", patientId: l.patient_id, title: "A payment link was paid by someone already on a plan",
        detail: `Link ${l.id}, payment ${paymentId}, Rs ${l.amount_paise / 100}. ${why}`, dueAt: new Date(), dedupeKey: `plink:${l.id}:on-plan` });
      return [];
    }
    await tx`update payment_links set ${tx(paid)} where id = ${l.id}`;
    // any plan waiting to be paid for in the app gives way: this is the sale
    await tx`delete from plan_recommendations where patient_id = ${l.patient_id}
             and created_at > coalesce((select max(s.created_at) from subscriptions s where s.user_id = ${l.patient_id}), '-infinity')`;
    await tx`insert into plan_recommendations (patient_id, plan_id, assigned_by, salesperson, salesperson_id, coach_preference, note, amount_paise, payment_ref)
             values (${l.patient_id}, ${l.plan_id}, ${l.created_by}, ${l.salesperson}, ${l.salesperson_id}, ${l.coach_preference}, ${l.note},
               ${l.amount_paise}, ${paymentId})`;
    // the patient's own record of the payment, with an invoice number, beside what they paid in the app
    const [{ n }] = await tx`select nextval('invoice_seq') as n`;
    const lines = [{ label: l.plan_name, amountPaise: l.list_paise },
      ...(l.list_paise > l.amount_paise ? [{ label: "Discount", amountPaise: l.amount_paise - l.list_paise }] : [])];
    await tx`insert into payment_orders (id, user_id, purpose, reference_id, amount_paise, title, line_items, status, provider,
               provider_payment_id, paid_at, invoice_number, fulfilled_at, meta)
             values (${l.id}, ${l.patient_id}, 'PLAN', ${String(l.plan_id)}, ${l.amount_paise}, ${l.plan_name}, ${tx.json(lines)}, 'PAID', ${l.provider},
               ${paymentId}, now(), ${`INR-${new Date().getUTCFullYear()}-${String(n).padStart(6, "0")}`}, now(), ${tx.json({ paymentLink: true })})
             on conflict (id) do nothing`;
    await startPlan(tx, l.patient_id, l.plan_id, l.id);
    await tx`insert into audit_log (patient_id, actor_id, action) values (${l.patient_id}, ${l.created_by},
               ${`${l.plan_name} started: payment link paid (${paymentId})${l.salesperson ? `, sold by ${l.salesperson}` : ""}`})`;
    return await notices.within(tx, (sp) => notices.planStarted(sp, l.patient_id, l.plan_name, l.id));
  });
  await sendNow(messages);
}

/** Asks Razorpay where the link stands and acts on it. Safe to call any number of times, from anywhere. */
export async function check(linkId: string) {
  const [l] = await sql`select id, status, amount_paise, provider from payment_links where id = ${linkId}`;
  if (!l) return null;
  if (l.status === "PAID" || l.provider !== "razorpay") return l.status as string;
  const now = await rzp.fetchPaymentLink(l.id);
  await sql`update payment_links set checked_at = now() where id = ${l.id}`;
  // money that arrived on a link we had cancelled or let lapse still starts the plan
  if (now.status === "paid" && now.paymentId && now.amountPaidPaise >= l.amount_paise) {
    await settle(l.id, now.paymentId);
    return "PAID";
  }
  if (l.status === "CREATED" && (now.status === "cancelled" || now.status === "expired")) {
    const status = now.status === "expired" ? "EXPIRED" : "CANCELLED";
    await sql`update payment_links set status = ${status} where id = ${l.id} and status = 'CREATED'`;
    return status;
  }
  return l.status as string;
}

/** The scheduler's step: the links still waiting, least recently looked at first. A missed webhook costs minutes. */
export async function checkOpen() {
  const rows = await sql`select id from payment_links where status = 'CREATED' and provider = 'razorpay'
    and (checked_at is null or checked_at < now() - interval '4 minutes') order by checked_at nulls first limit 25`;
  let paid = 0;
  for (const r of rows) if (await check(r.id).catch((e) => (console.error("link check", r.id, (e as Error).message), null)) === "PAID") paid++;
  // a mock link has nobody to ask: it ends by the clock
  await sql`update payment_links set status = 'EXPIRED' where status = 'CREATED' and provider = 'mock' and expires_at < now()`;
  return { checked: rows.length, paid };
}

/**
 * A Razorpay payment someone already made, by its ID (a link from the Razorpay dashboard, a QR code): the plan
 * starts only when Razorpay itself says that payment is captured, is for at least `floorPaise`, and no plan was
 * started from it before. Returns the amount, or fails with words for the person typing.
 */
export async function provePayment(paymentId: string, floorPaise: number) {
  if (!/^pay_[A-Za-z0-9]{6,}$/.test(paymentId)) fail(400, "A Razorpay payment ID starts with pay_.");
  const [used] = await sql`select 1 from plan_recommendations where payment_ref = ${paymentId}
                           union all select 1 from payment_orders where provider_payment_id = ${paymentId} limit 1`;
  if (used) fail(409, "That payment has been used already.");
  const p = await rzp.fetchPayment(paymentId);
  if (!p) fail(400, "Razorpay has no payment with that ID. Check it, or ask admin to record the payment.");
  if (p!.status !== "captured" || p!.currency !== "INR") fail(409, "That payment has not gone through.");
  if (p!.amountPaise < floorPaise) fail(409, `That payment is for Rs ${p!.amountPaise / 100}, which is less than this plan can be sold for.`);
  return p!.amountPaise;
}
