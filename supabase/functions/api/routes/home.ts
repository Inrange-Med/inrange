// The patient's Home (doctor portal v2 PRD, "Patient"): exactly one next step, from blood test to delivery,
// worked out here so the app, WhatsApp and support all read the same thing. The app words it and gives it
// one button. Mounted at /api. Role PATIENT. docs/backend/doctor-portal-v2.md, "The next step".
//   GET /patient/next-step       { stage, ...what that stage needs }
//   GET /care/prescriptions      every prescription the patient was sent, newest first (the PDF opens from each)
// Stages, checked in this order (the first that applies wins):
//   CALL_OPEN          a consultation opens within 10 minutes, or is on        appointment
//   PAYMENT_DUE        the plan admin assigned and the medicines, one bill     bill (one payment when both wait)
//   CALL_BOOKED        the next consultation (first or follow-up)              appointment
//   AFTER_CALL         the call happened, the prescription is not sent yet     appointment
//   ON_THE_WAY         medicines paid and moving                               order
//   PRESCRIPTION_SENT  sent, with nothing to order                             prescription
//   before the first consultation, from the eligibility review:
//   BLOOD_TEST_NEEDED  BOOK_BLOOD_TEST (paid, to book)  LAB_UNPAID  TEST_BOOKED  WAITING_FOR_REPORT  UNDER_REVIEW  NOT_APPROVED  BOOK_CONSULTATION
//   IN_CARE            nothing waiting: the next monthly review is theirs to book
import { Hono } from "hono";
import { sql } from "../lib/db.ts";
import { ok } from "../lib/http.ts";
import { requirePatient } from "../lib/auth.ts";
import { pendingPlan, priceCart } from "../lib/pharmacy.ts";
import { ist, lineView } from "../lib/prescriptions.ts";

export const homeRoutes = new Hono();

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
const MIN = 60_000;
const DAY = 86_400_000;

const appointmentView = (a: Row) => ({
  id: String(a.id), startsAt: ist(a.starts_at), doctorName: a.doctor ?? "", visitType: a.visit_type === "FOLLOW_UP" ? "FOLLOW_UP" : "FIRST",
  joinOpensAt: ist(new Date(new Date(a.starts_at).getTime() - 10 * MIN)),
});

export async function nextStep(patientId: number, now = new Date()) {
  const t = now.getTime();
  const [appointments, [e], [plan], rec, [rx], [cart], [order], [delivered], [link]] = await Promise.all([
    sql`select a.id, a.status, a.visit_type, a.started_at, a.ended_at, d.full_name as doctor,
          (s.slot_date + s.start_time) at time zone 'Asia/Kolkata' as starts_at,
          (s.slot_date + s.end_time) at time zone 'Asia/Kolkata' as ends_at
        from appointments a join doctor_slots s on s.id = a.slot_id join doctors d on d.id = a.doctor_id
        where a.patient_id = ${patientId} and a.status <> 'Cancelled' order by s.slot_date, s.start_time`,
    sql`select e.*, b.status as lab_status, to_char(b.slot_date, 'YYYY-MM-DD') as slot_date, b.slot_start, b.slot_end, b.collector, b.price, b.package_name, b.amount_paise
        from eligibility e left join lab_bookings b on b.id = e.lab_booking_id where e.user_id = ${patientId}`,
    sql`select 1 from subscriptions where user_id = ${patientId} and status = 'Active' and ends_at > now()`,
    pendingPlan(sql, patientId),
    sql`select x.id, x.appointment_id, coalesce(x.sent_at, x.signed_at) as sent_at, x.items, d.full_name as doctor
        from prescriptions x join doctors d on d.id = x.doctor_id
        where x.patient_id = ${patientId} and x.status = 'SIGNED' order by x.signed_at desc limit 1`,
    sql`select k.id, k.lines, k.elsewhere_at, k.address_id, k.plan_id, k.patient_id, p.months from medicine_carts k join prescriptions p on p.id = k.prescription_id
        where k.patient_id = ${patientId} and k.status = 'OPEN' and (p.valid_until is null or p.valid_until > now())
        order by k.id desc limit 1`,
    sql`select id, status, expected_at from medicine_orders where patient_id = ${patientId}
          and status in ('PLACED', 'PACKED', 'DISPATCHED', 'OUT_FOR_DELIVERY') order by placed_at desc limit 1`,
    sql`select id, delivered_at from medicine_orders where patient_id = ${patientId} and status = 'DELIVERED'
          and delivered_at > now() - interval '2 days' order by delivered_at desc limit 1`,
    // the payment link the sales team sent for a plan, still waiting (23 Nov 2026 call: shown in the app too)
    sql`select l.short_url, l.amount_paise, l.list_paise, p.name from payment_links l join plans p on p.id = l.plan_id
        where l.patient_id = ${patientId} and l.purpose = 'PLAN' and l.status = 'CREATED' and l.expires_at > now() limit 1`,
  ]);
  const live = appointments.filter((a) => ["Booked", "InProgress"].includes(a.status) && !a.ended_at &&
    new Date(a.ends_at ?? a.starts_at).getTime() + 60 * MIN > t);
  const open = live.find((a) => new Date(a.starts_at).getTime() - 10 * MIN <= t);
  if (open) return { stage: "CALL_OPEN", appointment: appointmentView(open) };

  // money: one bill. The plan admin assigned rides in the open cart with the medicines (one payment); with no cart
  // to pay (none, or its medicines bought elsewhere) the plan is billed on its own, at once (20 Nov 2026).
  // a plan sold on a payment link is paid on that link, at the price agreed on the call
  if (link && !plan)
    return {
      stage: "PAYMENT_DUE", payFor: "PLAN", referenceId: "", payUrl: link.short_url,
      bill: { lines: [{ key: "plan", label: link.name, mrpPaise: link.list_paise > link.amount_paise ? link.list_paise : null, amountPaise: link.amount_paise }],
              totalPaise: link.amount_paise },
      hasAddress: true,
      followedBy: null,
    };
  if (rec && !plan && !(cart && !cart.elsewhere_at)) {
    return {
      stage: "PAYMENT_DUE", payFor: "PLAN", referenceId: String(rec.plan_id),
      bill: { lines: [{ key: "plan", label: rec.name, mrpPaise: rec.mrp_rupees ? rec.mrp_rupees * 100 : null, amountPaise: rec.price_rupees * 100 }],
              totalPaise: rec.price_rupees * 100 },
      hasAddress: true,
      followedBy: null,
    };
  }
  if (cart && !cart.elsewhere_at) {
    const priced = await priceCart(sql, cart as never);
    const lines = priced.lines.filter((l) => l.available && l.quantity > 0);
    if (lines.length || priced.plan)
      return {
        stage: "PAYMENT_DUE", payFor: "MEDICINES", referenceId: String(cart.id), withPlan: Boolean(priced.plan),
        bill: {
          lines: [
            ...(priced.plan ? [{ key: "plan", label: priced.plan.name, mrpPaise: priced.plan.mrpPaise, amountPaise: priced.plan.pricePaise }] : []),
            ...lines.map((l) => ({ key: l.medicineId, label: `${l.brand} ${l.strength}`.trim(), quantity: l.quantity,
              mrpPaise: l.mrpPaise * l.quantity, amountPaise: l.pricePaise * l.quantity })),
          ],
          discountPercent: priced.discountPercent, totalPaise: priced.totalPaise,
        },
        // without a delivery address, Pay goes through the cart page to add one
        hasAddress: Boolean(cart.address_id),
        followedBy: null,
      };
  }

  if (live.length) return { stage: "CALL_BOOKED", appointment: appointmentView(live[0]) };

  // the last consultation that happened (or whose time passed after the doctor joined)
  const happened = [...appointments].reverse().find((a) => a.status === "Completed" || a.ended_at || a.started_at);
  if (happened && (!rx || (rx.appointment_id !== happened.id && new Date(rx.sent_at) < new Date(happened.starts_at)))
      && t - new Date(happened.starts_at).getTime() < 7 * DAY)
    return { stage: "AFTER_CALL", appointment: appointmentView(happened) };

  if (order) return { stage: "ON_THE_WAY", order: { id: String(order.id), status: order.status, expectedAt: ist(order.expected_at) } };
  const rxView = rx ? { id: String(rx.id), sentAt: ist(rx.sent_at), doctorName: rx.doctor, pdf: `/api/files/prescriptions/${rx.id}`,
    medicines: (rx.items as Row[]).length } : null;
  if (delivered) return { stage: "DELIVERED", order: { id: String(delivered.id), deliveredAt: ist(delivered.delivered_at) }, prescription: rxView };
  if (rx && t - new Date(rx.sent_at).getTime() < 30 * DAY)
    return { stage: "PRESCRIPTION_SENT", prescription: rxView };

  if (!happened) {
    const stage = e?.stage ?? "NOT_STARTED";
    const lab = e?.lab_status as string | undefined;
    const collection = e?.slot_date
      ? { date: e.slot_date as string, from: e.slot_start as string | null, to: e.slot_end as string | null }
      : null;
    // paid for, no collection booked on it yet (24 Nov 2026: pay first, then book)
    if (e?.lab_credit) return { stage: "BOOK_BLOOD_TEST" };
    if (stage === "AWAITING_PAYMENT" && e?.lab_booking_id)
      return {
        stage: "LAB_UNPAID", labBookingId: e.lab_booking_id, collection,
        bill: { lines: [{ key: "lab", label: e.package_name || "Home blood tests", amountPaise: Number(e.price?.total ?? 0) * 100 || e.amount_paise }],
                totalPaise: Number(e.price?.total ?? 0) * 100 || e.amount_paise },
      };
    if (stage === "LAB_SCHEDULED" || stage === "SAMPLE_COLLECTED") {
      if (stage === "SAMPLE_COLLECTED" || lab === "SAMPLE_COLLECTED" || lab === "PROCESSING" || lab === "REPORT_READY")
        return { stage: "WAITING_FOR_REPORT", labBookingId: e.lab_booking_id };
      return { stage: "TEST_BOOKED", labBookingId: e.lab_booking_id, collection, collectorName: e?.collector?.name ?? null };
    }
    if (stage === "UNDER_REVIEW") return { stage: "UNDER_REVIEW" };
    if (stage === "NOT_APPROVED") return { stage: "NOT_APPROVED", note: e?.review_note ?? null };
    if (stage === "APPROVED") return { stage: "BOOK_CONSULTATION", paid: Boolean(e?.consultation_paid) && !e?.consultation_used };
    return { stage: "BLOOD_TEST_NEEDED" };
  }
  return { stage: "IN_CARE", prescription: rxView };
}

homeRoutes.get("/patient/next-step", async (c) => {
  const me = await requirePatient(c);
  return ok(c, await nextStep(me.id));
});

homeRoutes.get("/care/prescriptions", async (c) => {
  const me = await requirePatient(c);
  const rows = await sql`
    select x.id, x.version, x.status, coalesce(x.sent_at, x.signed_at) as sent_at, x.valid_until, x.items, x.diagnosis,
      d.full_name as doctor, d.qualification
    from prescriptions x join doctors d on d.id = x.doctor_id
    where x.patient_id = ${me.id} and x.status in ('SIGNED', 'SUPERSEDED') and x.pdf_path is not null
    order by coalesce(x.sent_at, x.signed_at) desc`;
  return ok(c, {
    prescriptions: rows.map((x) => ({
      id: String(x.id), version: x.version, current: x.status === "SIGNED", sentAt: ist(x.sent_at), validUntil: ist(x.valid_until),
      doctorName: x.doctor, doctorQualification: x.qualification ?? "", medicines: (x.items as Row[]).map(lineView),
      // only the current prescription is handed out; a replaced one is read here (19 Nov 2026 call)
      pdf: x.status === "SIGNED" ? `/api/files/prescriptions/${x.id}` : null,
    })),
  });
});
