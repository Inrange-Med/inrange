// The pharmacy: catalogue search and cart pricing. docs/backend/medicine-cart.md.
// Customer prices only leave this file. The internal cost (medicine_costs) is read for one thing: no
// line is ever sold below what it costs us, whatever the discount table says.
import type { TransactionSql } from "postgres";
import { sql } from "./db.ts";

type Tx = TransactionSql | typeof sql;
export type CartLine = { medicineId: number; quantity: number; prescribed: number };

/** The catalogue row as the doctor's search and the prescription see it. */
export const medicineColumns = (tx: Tx) => tx`
  m.id, m.brand, m.molecule, m.form, m.strength, m.pack, m.pack_days, m.route, m.default_frequency, m.mrp_paise, m.active`;

export const toInventoryItem = (m: Record<string, unknown>) => ({
  id: String(m.id), brand: m.brand, molecule: m.molecule, form: m.form, strength: m.strength, pack: m.pack,
  packDays: m.pack_days, route: m.route, defaultFrequency: m.default_frequency, mrpPaise: m.mrp_paise,
});

export async function searchInventory(query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 4);
  const rows = await sql`
    select ${medicineColumns(sql)} from medicines m
    where m.active ${words.length
      ? sql`and ${words.map((w) => sql`(lower(m.brand || ' ' || m.molecule || ' ' || m.strength) like ${`%${w}%`})`)
          .reduce((a, b) => sql`${a} and ${b}`)}`
      : sql``}
    order by m.brand, nullif(regexp_replace(m.strength, '[^0-9.]', '', 'g'), '')::numeric limit 20`;
  return rows.map(toInventoryItem);
}

/** Whole months the prescription covers -> the default discount percent. */
export async function discountPercent(tx: Tx, months: number): Promise<number> {
  const [d] = await tx`select percent from medicine_discounts where min_months <= ${months} order by min_months desc limit 1`;
  return Number(d?.percent ?? 0);
}

/**
 * Unit price after the discount, in whole rupees (no paise on a patient's bill), never below cost (the
 * guard is logged: the discount table needs a look).
 */
export function unitPrice(mrpPaise: number, percent: number, costPaise: number | null): number {
  const discounted = Math.round((mrpPaise * (1 - percent / 100)) / 100) * 100;
  if (costPaise != null && discounted < costPaise) {
    console.error("pharmacy: discount below cost, sold at cost", { mrpPaise, percent });
    return costPaise;
  }
  return discounted;
}

/**
 * Prices a cart from the live catalogue: its medicines (a withdrawn item comes back unavailable) and the plan admin
 * assigned and the patient has not paid for (or the cart's own `plan_id`, from before 20 Nov 2026), so the plan and
 * the medicines are one bill and one payment whichever way the cart was made. Home, checkout and the payment all
 * price through here, so they always agree. The plan is never charged to someone already on a plan.
 */
export async function priceCart(tx: Tx, cart: { lines: CartLine[]; months: number; plan_id?: number | null; patient_id?: number }) {
  const { lines, months } = cart;
  const ids = lines.map((l) => l.medicineId);
  const rows = ids.length
    ? await tx`select ${medicineColumns(tx)}, c.cost_paise from medicines m
               left join medicine_costs c on c.medicine_id = m.id where m.id in ${tx(ids)}`
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const percent = await discountPercent(tx, months);
  const priced = lines.map((l) => {
    const m = byId.get(l.medicineId);
    // an item on the master list without a price is not sold (doctor portal v2): never in a bill
    const available = Boolean(m?.active) && m?.mrp_paise != null;
    const unit = m && available ? unitPrice(m.mrp_paise, percent, m.cost_paise ?? null) : 0;
    return {
      medicineId: String(l.medicineId), brand: m?.brand ?? "", molecule: m?.molecule ?? "", strength: m?.strength ?? "",
      form: m?.form ?? "", pack: m?.pack ?? "", quantity: available ? l.quantity : 0, prescribed: l.prescribed,
      mrpPaise: m?.mrp_paise ?? 0, pricePaise: unit, available,
    };
  });
  const mrpTotalPaise = priced.reduce((n, l) => n + l.mrpPaise * l.quantity, 0);
  const medicinesPaise = priced.reduce((n, l) => n + l.pricePaise * l.quantity, 0);
  const planId = cart.plan_id ?? (cart.patient_id ? (await pendingPlan(tx, cart.patient_id))?.plan_id ?? null : null);
  const [p] = planId
    ? await tx`select id, name, price_rupees, mrp_rupees from plans where id = ${planId} and active and price_rupees > 0
               and not exists (select 1 from subscriptions s where s.user_id = ${cart.patient_id ?? 0} and s.status = 'Active' and s.ends_at > now())`
    : [];
  const plan = p ? { id: String(p.id), name: String(p.name), pricePaise: Math.round(Number(p.price_rupees) * 100),
    mrpPaise: p.mrp_rupees ? Math.round(Number(p.mrp_rupees) * 100) : null } : null;
  return {
    lines: priced, discountPercent: percent, mrpTotalPaise, discountPaise: mrpTotalPaise - medicinesPaise, plan,
    totalPaise: medicinesPaise + (plan?.pricePaise ?? 0),
  };
}

/** Whether the patient has an active plan. Every cart opens the moment its prescription is sent, plan or not (19 Nov 2026). */
export async function onPlan(tx: Tx, patientId: number) {
  const [plan] = await tx`select 1 from subscriptions where user_id = ${patientId} and status = 'Active' and ends_at > now()`;
  return Boolean(plan);
}

/**
 * The plan admin put the patient on that they have not paid for yet: the latest assignment (or older doctor
 * suggestion) made after their last plan was bought, so a lapsed plan never brings an old one back.
 */
export async function pendingPlan(tx: Tx, patientId: number) {
  const [r] = await tx`
    select r.plan_id, r.salesperson, r.salesperson_id, r.created_at, p.name, p.price_rupees, p.mrp_rupees, p.duration_months
    from plan_recommendations r join plans p on p.id = r.plan_id
    where r.patient_id = ${patientId} and p.active
      and r.created_at > coalesce((select max(s.created_at) from subscriptions s where s.user_id = ${patientId}), '-infinity')
    order by r.created_at desc limit 1`;
  return r ?? null;
}

if (import.meta.main) {
  // deno run lib/pharmacy.ts: the below-cost guard and the rounding
  const assert = (ok: boolean, what: string) => { if (!ok) throw new Error(what); };
  assert(unitPrice(1312500, 13, 1014300) === 1141900, "13% off Mounjaro 2.5 mg, whole rupees");
  assert(unitPrice(1312500, 30, 1014300) === 1014300, "never below cost");
  assert(unitPrice(566000, 14, null) === 486800, "no cost row: plain discount");
  console.log("pharmacy ok");
}
