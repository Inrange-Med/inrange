// Prescriptions: the PDF, signing and sending. Two ways in:
// - Doctor portal v2 (routes/consultations.ts, 17 Nov 2026 call): the consultation page saves a DRAFT as the
//   doctor types, "Create PDF" renders the patient's copy (makePdf) and "Send to patient" issues exactly that
//   PDF (issueRx). The form's own fields (diagnosis, history, remarks, advice, medicine lines) print.
// - The call note (routes/doctor.ts, kept for the back office): signing a note signs its prescription in one
//   step (signRx), the clinical words taken from the note's sections.
// Issuing: the previous prescription is superseded, the patient's unpaid cart closes with its follow-ups,
// a new cart holds every line the pharmacy sells (a first consultation without a plan: one month, held
// NANO_CART_DELAY_HOURS), a medicine typed by hand opens a MATCH_MEDICINE task for admin, and the patient
// gets the prescription on WhatsApp and in the app. docs/backend/doctor-portal-v2.md.
import { sql } from "./db.ts";
import { fail } from "./http.ts";
import { uploadFile } from "./storage.ts";
import { cartAvailableAt, type CartLine } from "./pharmacy.ts";
import { prescriptionPdf, type RxPdfItem } from "./prescriptionPdf.ts";
import { closeTasks, openTask, startMedicineFlow } from "./medicineFlow.ts";
import { deliver } from "./notify.ts";
import { daysOf, displayName, packsFor } from "./medicineSearch.ts";
import { workingDue } from "./hours.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
export type Doctor = { id: number; name: string; qualification: string };

/** ISO 8601 in India time, e.g. 2026-10-28T10:30:00+05:30. */
export const ist = (d: unknown): string | null =>
  d ? new Date(new Date(d as string).getTime() + 19_800_000).toISOString().slice(0, 19) + "+05:30" : null;

const IST = { timeZone: "Asia/Kolkata" } as const;
const dayOf = (d: Date) => new Intl.DateTimeFormat("en-IN", { ...IST, day: "numeric", month: "short", year: "numeric" }).format(d);
const timeOf = (d: Date) => new Intl.DateTimeFormat("en-IN", { ...IST, hour: "numeric", minute: "2-digit", hour12: true }).format(d).toLowerCase();
const monthsWord = (m: number) => `${m} ${m === 1 ? "month" : "months"}`;
const daysWord = (d: number) => (d % 7 === 0 ? `${d / 7} ${d === 7 ? "week" : "weeks"}` : `${d} days`);
const sentences = (sections: Row[], key: string): Row[] => sections.find((s) => s.key === key)?.current ?? [];

// ---------------------------------------------------------------- the v2 form's medicine lines

/** How often, as the doctor taps it; the words print and drive dose reminders (medicineFlow cadenceOf). */
export const FREQUENCIES: Record<string, string> = {
  "1-0-0": "Once a day, in the morning (1-0-0)",
  "0-0-1": "Once a day, at night (0-0-1)",
  "1-0-1": "Twice a day, morning and night (1-0-1)",
  "1-1-1": "Three times a day (1-1-1)",
  WEEKLY: "Once a week",
};
export const INTAKES: Record<string, string> = {
  BEFORE_FOOD: "Before food", AFTER_FOOD: "After food", EMPTY_STOMACH: "On an empty stomach",
};
export const DURATION_UNITS = ["DAYS", "WEEKS", "MONTHS"] as const;
const unitWords = (n: number, unit: string) =>
  `${n} ${unit === "MONTHS" ? (n === 1 ? "month" : "months") : unit === "WEEKS" ? (n === 1 ? "week" : "weeks") : n === 1 ? "day" : "days"}`;

/**
 * One medicine line from the form, checked against the master list. A listed item brings its generic name,
 * form, route and pack; the packs that cover the duration go to the cart if the pharmacy sells it. A name
 * typed by hand prints as written and is marked unlisted (admin matches it before it can be ordered).
 */
export function lineOf(input: Row, listed: Row | undefined, index: number): Row {
  const name = String(input.name ?? "").trim().slice(0, 120);
  const code = String(input.frequency ?? "");
  const other = String(input.frequencyOther ?? "").trim().slice(0, 80);
  const unit = DURATION_UNITS.includes(input.durationUnit) ? input.durationUnit : "DAYS";
  const value = Math.max(1, Math.min(365, Math.round(Number(input.durationValue) || 30)));
  const days = daysOf(value, unit);
  const intake = INTAKES[input.intake] ? String(input.intake) : "";
  const base = {
    key: String(input.key ?? `l${index + 1}`).slice(0, 40),
    dose: String(input.dose ?? "").trim().slice(0, 60),
    frequencyCode: FREQUENCIES[code] || code === "OTHER" ? code : "",
    frequencyOther: code === "OTHER" ? other : "",
    frequency: code === "OTHER" ? other : FREQUENCIES[code] ?? "",
    durationValue: value, durationUnit: unit, duration: unitWords(value, unit), durationDays: days,
    intake, instructions: intake ? INTAKES[intake] : "", reason: "",
  };
  if (!listed)
    return { ...base, medicineId: null, unlisted: true, orderable: false, medicineName: name, genericName: null,
             form: "", strength: "", route: "", quantity: null, quantityLabel: "" };
  const packs = packsFor(days, listed.pack_days);
  const [, unitName] = /^(.*?)\s*(?:\((.*)\))?$/.exec(String(listed.pack)) ?? [];
  return {
    ...base, medicineId: listed.id, unlisted: false, orderable: listed.mrp_paise != null,
    medicineName: listed.brand, genericName: listed.molecule, form: listed.form, strength: listed.strength,
    route: listed.route ?? "", quantity: packs, quantityLabel: `${packs} x ${unitName || listed.pack}`,
    name: displayName(listed as { brand: string; strength: string }),
  };
}

/** The months a prescription covers: its longest line, 1 to 12. */
export const monthsOf = (items: Row[]) =>
  Math.min(12, Math.max(1, ...items.map((i) => Math.ceil((Number(i.durationDays) || 30) / 30))));

/** What a line says to a reader (the record, the history, the patient app). */
export const lineView = (i: Row) => ({
  key: String(i.key ?? ""), medicineId: i.medicineId != null ? String(i.medicineId) : null,
  name: i.name ?? ([i.medicineName, i.strength].filter(Boolean).join(" ") || ""),
  genericName: i.genericName ?? null, dose: i.dose ?? "", frequency: i.frequencyCode ?? "", frequencyOther: i.frequencyOther ?? "",
  frequencyWords: i.frequency ?? "", durationValue: i.durationValue ?? null, durationUnit: i.durationUnit ?? null,
  duration: i.duration ?? "", intake: i.intake ?? "", intakeWords: i.instructions ?? "", unlisted: Boolean(i.unlisted),
});

// ---------------------------------------------------------------- the call note's lines (back office)

/** A note's medicine as a prescription line; a catalogue item brings its generic name, form, route and pack. */
export function rxItem(m: Row, stocked: Row | undefined): Row {
  if (!stocked)
    return { medicineName: m.name, strength: m.strength, dose: "", frequency: m.detail, route: "", instructions: "",
             reason: "", genericName: null, form: "", medicineId: null, quantity: null };
  const quantity = Math.min(12, Math.max(1, Math.round(Number(m.quantity) || 1)));
  // "pen (4 weekly doses)": the unit counts in Qty, its contents read with the form
  const [, unit, contents] = /^(.*?)\s*(?:\((.*)\))?$/.exec(stocked.pack) ?? [];
  return {
    medicineId: stocked.id, medicineName: stocked.brand, genericName: stocked.molecule,
    form: contents ? `${stocked.form}, ${contents} a ${unit}` : stocked.form,
    strength: stocked.strength, dose: "", frequency: m.detail || stocked.default_frequency, route: stocked.route,
    instructions: "", reason: "", quantity, quantityLabel: `${quantity} x ${unit || stocked.pack}`,
    duration: daysWord(quantity * stocked.pack_days),
  };
}

// ---------------------------------------------------------------- the PDF

/** Renders and stores the PDF for a prescription row; returns its storage path. */
export async function renderRx(doctor: Doctor, patientId: number, rx: Row, signedAt: Date, months: number): Promise<string> {
  const items = rx.items as Row[];
  const v2 = rx.diagnosis != null;
  const validUntil = new Date(signedAt);
  validUntil.setMonth(validUntil.getMonth() + months);
  const ids = items.map((i) => Number(i.medicineId)).filter((id) => Number.isInteger(id) && id > 0);
  const [[d], [u], [addr], [appt], [note], [clinical], [weight], [series], [previous], stockRows] = await Promise.all([
    sql`select full_name, qualification, registration_no, council, practice_address, contact from doctors where id = ${doctor.id}`,
    sql`select u.mobile, coalesce(u.full_name, nullif(concat_ws(' ', p.first_name, p.last_name), '')) as full_name,
          p.age_years, p.gender, p.height_cm, p.weight_kg
        from users u left join patient_profiles p on p.user_id = u.id where u.id = ${patientId}`,
    sql`select * from addresses where user_id = ${patientId} order by is_default desc, id desc limit 1`,
    sql`select a.visit_type, a.reason, coalesce(a.started_at, (s.slot_date + s.start_time) at time zone 'Asia/Kolkata', a.created_at) as at
        from appointments a left join doctor_slots s on s.id = a.slot_id where a.id = ${rx.appointment_id}`,
    v2 ? [] : sql`select sections, follow_ups from clinical_notes where prescription_id = ${rx.id} or appointment_id = ${rx.appointment_id}
        order by id desc limit 1`,
    sql`select allergies, outside_medicines from patient_clinical where patient_id = ${patientId}`,
    sql`select weight_kg from weight_logs where user_id = ${patientId} order by logged_at desc limit 1`,
    // one Rx number per patient (their first prescription's), versions under it
    sql`select min(id) as n from prescriptions where patient_id = ${patientId}`,
    sql`select version, signed_at from prescriptions where patient_id = ${patientId} and status = 'SIGNED' and id <> ${rx.id}
        order by version desc limit 1`,
    ids.length ? sql`select id, molecule, brand, form, strength, pack, pack_days, route, storage, seek_help from medicines where id in ${sql(ids)}` : [],
  ]);
  const stock = new Map(stockRows.map((m: Row) => [m.id, m]));
  const sections = (note?.sections ?? []) as Row[];
  const said = (key: string) => sentences(sections, key).map((x) => String(x.text));
  const kg = weight?.weight_kg ?? u?.weight_kg;
  const bmi = kg && u?.height_cm ? (kg / (u.height_cm / 100) ** 2).toFixed(1) : null;
  const outside = clinical?.outside_medicines as string[] | null | undefined;
  const callAt = appt?.at ? new Date(appt.at) : signedAt;
  const rxNumber = series?.n ?? rx.id;
  const env = (name: string) => Deno.env.get(name)?.trim() || "";

  // "pen (4 weekly doses)": the unit that counts, and what one holds
  const packOf = (m: Row) => { const [, unit, holds] = /^(.*?)\s*(?:\((.*)\))?$/.exec(String(m.pack)) ?? []; return { unit: unit || "pack", holds }; };
  const qtyOf = (m: Row, q: number) => `${q} ${packOf(m).unit}${q === 1 ? "" : "s"}`;
  // a dose step-up: two or more strengths of one molecule follow each other, the lowest first
  const lines = items.map((i, at) => ({ i, at, m: stock.get(Number(i.medicineId)) as Row | undefined, q: Number(i.quantity) || 1 }));
  const byMolecule = new Map<string, typeof lines>();
  for (const l of lines) if (l.m) byMolecule.set(l.m.molecule, [...(byMolecule.get(l.m.molecule) ?? []), l]);
  const steps = new Map<number, { step: number; when: string }>();
  const callouts: string[] = [];
  for (const [molecule, group] of byMolecule) {
    if (group.length < 2) continue;
    group.sort((a, b) => parseFloat(a.m!.strength) - parseFloat(b.m!.strength));
    let week = 1;
    group.forEach((l, k) => {
      const weeks = Math.max(1, Math.round((l.q * l.m!.pack_days) / 7));
      const unit = packOf(l.m!).unit;
      steps.set(l.at, { step: k + 1, when: `Weeks ${week} to ${week + weeks - 1}${k ? `, after Step ${k} ${unit}s are finished` : ""}` });
      week += weeks;
    });
    const unit = packOf(group[0].m!).unit;
    callouts.push(group.length === 2
      ? `Take only one ${molecule.toLowerCase()} strength at a time. Move to ${group[1].m!.strength} only after the ${group[0].m!.strength} ${unit}s are finished.`
      : `Take only one ${molecule.toLowerCase()} strength at a time. Move to each next step only after the ${unit}s of the step before are finished.`);
  }
  // step-ups print in step order, where their first strength was prescribed
  const firstAt = new Map<string, number>();
  for (const l of lines) if (l.m && !firstAt.has(l.m.molecule)) firstAt.set(l.m.molecule, l.at);
  lines.sort((a, b) => (a.m ? firstAt.get(a.m.molecule)! : a.at) - (b.m ? firstAt.get(b.m.molecule)! : b.at) ||
    (steps.get(a.at)?.step ?? 0) - (steps.get(b.at)?.step ?? 0));
  // v2: "1 tablet, Once a day, in the morning (1-0-0)" and the doctor's own duration
  const how = (i: Row) => {
    if (!v2) return i.frequency ?? "";
    const f = String(i.frequency ?? "");
    // "1 tablet, once a day, in the morning (1-0-0)": one sentence, so the frequency starts lower case after a dose
    return [i.dose, i.dose && /^[A-Z][a-z]/.test(f) ? f.charAt(0).toLowerCase() + f.slice(1) : f].filter(Boolean).join(", ");
  };
  const pdfItems: RxPdfItem[] = lines.map(({ i, at, m, q }) => m
    ? { generic: m.molecule, brand: m.brand, form: packOf(m).holds ? `${m.form}, ${packOf(m).holds} per ${packOf(m).unit}` : m.form,
        strength: m.strength, how: how(i), route: m.route ?? "", step: steps.get(at)?.step ?? null,
        when: steps.get(at)?.when ?? (v2 && i.duration ? `For ${i.duration}` : daysWord(q * m.pack_days)), quantity: qtyOf(m, q),
        instructions: i.instructions ?? "" }
    : { generic: i.medicineName ?? "", brand: null, form: i.form ?? "", strength: i.strength ?? "", how: how(i),
        route: i.route ?? "", step: null, when: v2 && i.duration ? `For ${i.duration}` : monthsWord(months), quantity: "",
        instructions: i.instructions ?? "" });
  const unique = (key: string) => [...new Set(lines.map((l) => l.m?.[key]).filter(Boolean))].join(" ");
  const followUps = ((note?.follow_ups ?? []) as Row[]).filter((f) => f.include).map((f) => String(f.text));
  const advice = v2 ? (rx.advice ? [String(rx.advice)] : []) : said("patient").length ? said("patient") : said("plan");
  // ponytail: placeholders until inrange confirms them (16 Nov 2026); set the secret or doctor column, no deploy needed
  const pdf = await prescriptionPdf({
    rxNumber, version: rx.version,
    supersedes: previous ? `Supersedes Rx ${rxNumber} version ${previous.version}, issued ${dayOf(new Date(previous.signed_at))}` : null,
    practice: {
      name: "inrange, by Novaxis Lifesciences Pvt Ltd",
      address: `Registered office: ${env("PRACTICE_ADDRESS") || "to be confirmed"}`,
      supportPhone: `Support: ${env("SUPPORT_PHONE") || "phone number to be confirmed"}`,
      pharmacyLicence: `Pharmacy drug licence (Forms 20, 21): ${env("PHARMACY_LICENCE") || "to be confirmed"}`,
    },
    doctor: {
      name: d?.full_name ?? doctor.name, qualification: d?.qualification ?? "",
      registration: `Reg. No. ${d?.registration_no ?? "not recorded"}${d?.council ? ` · ${d.council}` : ""}`,
      practiceAddress: d?.practice_address || "Practice address: to be confirmed", contact: d?.contact || "Contact: to be confirmed",
    },
    patient: {
      name: u?.full_name ?? `Patient ${patientId}`,
      ageSex: [u?.age_years ? `${u.age_years} years` : null, u?.gender].filter(Boolean).join(", ") || "Not recorded",
      patientId: `IR-${String(patientId).padStart(6, "0")}`, mobile: u?.mobile ? `+91 ${u.mobile}` : "",
      city: addr?.city ?? null,
      vitals: [kg ? `Weight ${kg} kg` : null, u?.height_cm ? `Height ${u.height_cm} cm` : null, bmi ? `BMI ${bmi}` : null]
        .filter(Boolean).join("  ·  ") || null,
    },
    consult: { mode: "Video teleconsultation", type: appt?.visit_type === "FOLLOW_UP" ? "Follow-up" : "First consultation",
      dateTime: `${dayOf(callAt)}, ${timeOf(callAt)}`, signedAt: `${dayOf(signedAt)}, ${timeOf(signedAt)}` },
    clinical: {
      complaint: String(appt?.reason ?? "").split(" | Note:")[0] || "Weight and metabolic care",
      diagnosis: (v2 ? rx.diagnosis : said("assessment").join(" ")) || "Not recorded",
      history: v2 ? rx.patient_history || null : null,
      allergies: clinical?.allergies || "Not recorded",
      otherMedicines: outside == null ? "Not recorded" : outside.length ? outside.join(", ") : "None",
    },
    items: pdfItems,
    callout: callouts.join(" ") || null,
    advice: [
      ...(advice.length ? [["Advice", advice.join(" ")] as [string, string]] : []),
      ...(v2 && rx.remarks ? [["Doctor's remarks", String(rx.remarks)] as [string, string]] : []),
      ...(unique("storage") ? [["Storage", unique("storage")] as [string, string]] : []),
      ...(unique("seek_help") ? [["Contact us if", unique("seek_help")] as [string, string]] : []),
      ...(followUps.length ? [["Investigations", followUps.join("; ")] as [string, string]] : []),
      ["Follow-up", "Review with your doctor in 1 month"],
      ["Valid until", dayOf(validUntil)],
    ],
    signature: { method: env("ESIGN_METHOD") || "Aadhaar eSign or DSC, to be confirmed", reference: "to be confirmed" },
  });
  // one file per render: storage never overwrites, and "Create PDF" may run again after an edit
  const path = `${patientId}/rx-${rx.id}-v${rx.version}-${signedAt.getTime()}.pdf`;
  await uploadFile("prescriptions", path, new Blob([pdf as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), "application/pdf");
  return path;
}

/** The months a prescription is issued for: a first consultation without a plan (the nano plan) is one month. */
export async function issueMonths(patientId: number, asked: number, at: Date) {
  const { onPlan, availableAt } = await cartAvailableAt(sql, patientId, at);
  return { onPlan, availableAt, months: onPlan ? Math.min(12, Math.max(1, Math.round(asked))) : 1 };
}

// ---------------------------------------------------------------- issuing

/**
 * Issues a rendered prescription: SIGNED (the time on the PDF), the previous one superseded, the cart, the
 * follow-up and the patient's WhatsApp. `sentAt` is set by the v2 page (its "Sent to patient, 7:42 pm").
 */
export async function issueRx(doctor: Doctor, patientId: number, rxId: number,
  o: { signedAt: Date; months: number; path: string; sentAt?: Date }) {
  const [rx] = await sql`select * from prescriptions where id = ${rxId} and patient_id = ${patientId}`;
  if (!rx) fail(400, "That prescription was not found for this patient.");
  if (rx.status !== "DRAFT") fail(409, "This prescription was sent already.");
  const items = rx.items as Row[];
  const at = o.sentAt ?? o.signedAt;
  const { onPlan, availableAt } = await cartAvailableAt(sql, patientId, at);
  const validUntil = new Date(o.signedAt);
  validUntil.setMonth(validUntil.getMonth() + o.months);
  const ids = items.map((i) => Number(i.medicineId)).filter((id) => Number.isInteger(id) && id > 0);
  const [[addr], sold] = await Promise.all([
    sql`select id from addresses where user_id = ${patientId} order by is_default desc, id desc limit 1`,
    ids.length ? sql`select id, pack_days from medicines where id in ${sql(ids)} and active and mrp_paise is not null` : [],
  ]);
  const packDays = new Map(sold.map((m: Row) => [m.id, m.pack_days as number]));
  // only what the pharmacy sells reaches the cart; a first consultation without a plan carries one month
  const merged = new Map<number, CartLine>();
  for (const i of items.filter((x) => packDays.has(Number(x.medicineId)))) {
    const id = Number(i.medicineId);
    const q = onPlan ? Number(i.quantity) || 1 : Math.min(Number(i.quantity) || 1, packsFor(30, packDays.get(id)!));
    const prev = merged.get(id);
    merged.set(id, { medicineId: id, quantity: (prev?.quantity ?? 0) + q, prescribed: (prev?.prescribed ?? 0) + q });
  }
  const unlisted = items.filter((i) => i.unlisted).map((i) => String(i.medicineName));
  let carted = false;
  const messageId = await sql.begin(async (tx) => {
    // one send at a time: a second press, or an edit that landed after the PDF, finds this and stops here
    const [locked] = await tx`
      select status, saved_at, pdf_made_at from prescriptions where id = ${rxId} for update`;
    if (locked?.status !== "DRAFT") fail(409, "This prescription was sent already.");
    // the PDF was made again between reading it and this lock: send only the one the doctor saw
    if (o.sentAt && new Date(locked.pdf_made_at ?? 0).getTime() !== o.signedAt.getTime())
      fail(409, "The PDF was made again a moment ago. Check it, then send.");
    // an older consultation's prescription never replaces the one a later consultation issued
    if (rx.appointment_id) {
      const [newer] = await tx`
        select 1 from prescriptions x join appointments a on a.id = x.appointment_id join doctor_slots s on s.id = a.slot_id
        where x.patient_id = ${patientId} and x.status = 'SIGNED' and x.appointment_id <> ${rx.appointment_id}
          and (s.slot_date + s.start_time) > (select s2.slot_date + s2.start_time from appointments a2
                                              join doctor_slots s2 on s2.id = a2.slot_id where a2.id = ${rx.appointment_id})`;
      if (newer) fail(409, "This patient has a newer prescription from a later consultation, so this one cannot be sent.");
    }
    if (o.sentAt && locked.saved_at && locked.pdf_made_at && new Date(locked.saved_at) > new Date(locked.pdf_made_at))
      fail(409, "The prescription changed after the PDF was made. Create the PDF again, then send it.");
    const superseded = await tx`
      update prescriptions set status = 'SUPERSEDED' where patient_id = ${patientId} and status = 'SIGNED' returning id, appointment_id`;
    // a replaced prescription is never ordered from, so its hand-typed medicines need no matching
    if (superseded.length)
      await tx`
        update ops_tasks set status = 'DONE', outcome = 'RESOLVED', outcome_note = 'A newer prescription replaced this one',
          done_at = now(), history = history || ${tx.json([{ at: new Date().toISOString(), what: "Closed: a newer prescription replaced this one" }])}
        where status = 'OPEN' and kind = 'MATCH_MEDICINE' and prescription_id in ${tx(superseded.map((r) => r.id))}`;
    await tx`update prescriptions set status = 'SIGNED', signed_at = ${o.signedAt}, pdf_path = ${o.path}, months = ${o.months},
               valid_until = ${validUntil}, sent_at = ${o.sentAt ?? null} where id = ${rxId}`;
    // a new version of the same consultation's prescription ("Edit and send new version"): what the patient already
    // paid for stays bought. Its paid order moves to the new version (so refills follow it), and the new order
    // carries only what is left to buy.
    const sameVisit = superseded.filter((r) => rx.appointment_id && r.appointment_id === rx.appointment_id).map((r) => r.id);
    if (sameVisit.length) {
      const paid = await tx`select id, lines from medicine_carts where prescription_id in ${tx(sameVisit)} and status = 'PAID'`;
      for (const k of paid) {
        for (const l of k.lines as CartLine[]) {
          const line = merged.get(l.medicineId);
          if (!line) continue;
          const left = Math.max(0, line.quantity - l.quantity);
          if (left) merged.set(l.medicineId, { ...line, quantity: left, prescribed: left });
          else merged.delete(l.medicineId);
        }
      }
      if (paid.length) {
        const ids = paid.map((k) => k.id);
        await tx`update medicine_carts set prescription_id = ${rxId} where id in ${tx(ids)}`;
        await tx`update medicine_orders set prescription_id = ${rxId} where cart_id in ${tx(ids)}`;
      }
    }
    carted = merged.size > 0;
    const replaced = await tx`update medicine_carts set status = 'CLOSED' where patient_id = ${patientId} and status = 'OPEN' returning id`;
    // the replaced orders' follow-ups and calls close with them: nobody calls about an order that is gone
    for (const { id } of replaced) {
      await tx`update medicine_followups set stage = 'DONE', next_at = null, closed_reason = 'SUPERSEDED', closed_at = now()
               where cart_id = ${id} and closed_at is null`;
      await closeTasks(tx, { cartId: id }, ["NO_REPLY", "PLAN_CALL", "PAYMENT_FAILED", "QUESTIONS"], "RESOLVED", "A newer prescription replaced this order");
    }
    const [cart] = merged.size
      ? await tx`insert into medicine_carts (patient_id, prescription_id, available_at, lines, address_id)
               values (${patientId}, ${rxId}, ${availableAt}, ${tx.json([...merged.values()])}, ${addr?.id ?? null}) returning id`
      : [];
    if (unlisted.length)
      await openTask(tx, {
        kind: "MATCH_MEDICINE", priority: "HIGH", patientId, prescriptionId: rxId, cartId: cart?.id ?? null,
        title: unlisted.length === 1 ? `Match "${unlisted[0]}" to the list` : `Match ${unlisted.length} medicines to the list`,
        detail: `${doctor.name} added ${unlisted.map((n) => `"${n}"`).join(", ")}, which ${unlisted.length === 1 ? "is" : "are"} not on the master list. It prints on the prescription but cannot be ordered until it is matched.`,
        dueAt: workingDue(new Date(), 4), dedupeKey: `match:rx:${rxId}`,
      });
    await tx`insert into audit_log (patient_id, actor_id, action) values (${patientId}, ${doctor.id}, ${`Signed prescription version ${rx.version}, ${doctor.name}`})`;
    // the prescription on WhatsApp now (a link into the app; the PDF stays with us), and the follow-up (lib/medicineFlow.ts)
    return await startMedicineFlow(tx, {
      patientId, prescriptionId: rxId, version: rx.version, cartId: cart?.id ?? null, onPlan, signedAt: at, availableAt,
      doctorName: doctor.name,
    });
  });
  if (messageId) await deliver(messageId).catch((e) => console.error("prescription message", e.message));
  return { id: String(rxId), version: rx.version, status: "SIGNED", signedAt: ist(o.signedAt), months: o.months,
           validUntil: ist(validUntil), cartAvailableAt: carted ? ist(availableAt) : null };
}

/**
 * The call note's one-step signature (back office): renders the PDF now and issues it. The first consultation
 * without a plan is one month and its cart waits NANO_CART_DELAY_HOURS (12 Nov 2026 call); on a plan, the
 * doctor's months stand and the cart is ready at once. A newer prescription closes the patient's unpaid cart.
 */
export async function signRx(doctor: Doctor, patientId: number, rxId: number, monthsAsked: number) {
  const [rx] = await sql`select * from prescriptions where id = ${rxId} and patient_id = ${patientId}`;
  if (!rx) fail(400, "That prescription was not found for this patient.");
  if (rx.status !== "DRAFT") fail(409, "Only a draft prescription can be signed.");
  if (!(rx.items as Row[]).length) fail(422, "This prescription has no medicines to sign.");
  const signedAt = new Date();
  const { months } = await issueMonths(patientId, monthsAsked, signedAt);
  const path = await renderRx(doctor, patientId, rx, signedAt, months);
  return await issueRx(doctor, patientId, rxId, { signedAt, months, path });
}
