// The pharmacy: catalogue search, cart pricing and when a cart may be shown. docs/backend/medicine-cart.md.
// Customer prices only leave this file. The internal cost (medicine_costs) is read for one thing: no
// line is ever sold below what it costs us, whatever the discount table says.
import type { TransactionSql } from "postgres";
import { sql } from "./db.ts";

type Tx = TransactionSql | typeof sql;
export type CartLine = { medicineId: number; quantity: number; prescribed: number };

const get = (name: string) => Deno.env.get(name)?.trim() || "";
/** First consultation without a plan: hours between the prescription and its cart (12 Nov 2026 call: pilot 24 or 48). */
export const nanoCartDelayHours = () => {
  const n = Number(get("NANO_CART_DELAY_HOURS") || 48);
  return Number.isFinite(n) && n >= 0 ? n : 48;
};

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

/** Prices a cart's lines from the live catalogue. Lines whose item was withdrawn come back unavailable. */
export async function priceCart(tx: Tx, lines: CartLine[], months: number) {
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
  const totalPaise = priced.reduce((n, l) => n + l.pricePaise * l.quantity, 0);
  return { lines: priced, discountPercent: percent, mrpTotalPaise, discountPaise: mrpTotalPaise - totalPaise, totalPaise };
}

/** A patient with an active plan gets the cart at once; anyone else (the nano plan) after the delay. */
export async function cartAvailableAt(tx: Tx, patientId: number, signedAt: Date) {
  const [plan] = await tx`select 1 from subscriptions where user_id = ${patientId} and status = 'Active' and ends_at > now()`;
  return { onPlan: Boolean(plan), availableAt: plan ? signedAt : new Date(signedAt.getTime() + nanoCartDelayHours() * 3600_000) };
}

if (import.meta.main) {
  // deno run lib/pharmacy.ts: the below-cost guard and the rounding
  const assert = (ok: boolean, what: string) => { if (!ok) throw new Error(what); };
  assert(unitPrice(1312500, 13, 1014300) === 1141900, "13% off Mounjaro 2.5 mg, whole rupees");
  assert(unitPrice(1312500, 30, 1014300) === 1014300, "never below cost");
  assert(unitPrice(566000, 14, null) === 486800, "no cost row: plain discount");
  console.log("pharmacy ok");
}
