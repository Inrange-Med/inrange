// Home blood tests (Redcliffe Labs). Contract: docs/backend/lab-tests-redcliffe.md, shapes src/types/labTest.ts.
//   GET  /labs/packages                         bookable packages
//   GET  /labs/packages/:code                   what a package tests
//   GET  /labs/locations/search?query=&latitude=&longitude=   area search (optional point to rank nearby first)
//   GET  /labs/locations/reverse?latitude&longitude  the place at a point, for Use my current location (mock mode)
//   GET  /labs/locations/:eloc                  a place's coordinates
//   GET  /labs/serviceability?latitude&longitude
//   GET  /labs/slots?date&addressId             collection windows at a saved address
//   POST /labs/bookings                         holds a slot for 30 minutes (PAYMENT_PENDING)
//   GET  /labs/bookings                         the patient's bookings, newest first
//   GET  /labs/bookings/:id                     one booking (live: refreshed from Redcliffe)
//   POST /labs/bookings/:id/reschedule          { collectionDate, slotId }
//   POST /labs/bookings/:id/cancel              { reason }
//   GET  /labs/bookings/:id/report              { url } a fresh link to the PDF
//   POST /labs/bookings/:id/simulate            MOCK ONLY { event: SAMPLE_COLLECTED | REPORT_READY }, walks the pilot lab path
// A booking that is not the caller's answers 404, as the doc asks.
import { Hono } from "hono";
import type { Sql, TransactionSql } from "postgres";
import { sql } from "../lib/db.ts";
import { body, fail, ok, todayIST } from "../lib/http.ts";
import { requirePatient } from "../lib/auth.ts";
import { env } from "../lib/env.ts";
import { setEligibility } from "../lib/eligibility.ts";
import { signedUrl, uploadFile } from "../lib/storage.ts";
import * as rc from "../integrations/redcliffe.ts";

export const labRoutes = new Hono();

type Db = Sql | TransactionSql;
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const HOLD_MINUTES = 30;
const MAX_RESCHEDULES = 2;
const RANK: Record<string, number> = {
  PAYMENT_PENDING: 0, BOOKED: 1, COLLECTOR_ASSIGNED: 2, SAMPLE_COLLECTED: 3, PROCESSING: 4, REPORT_READY: 5,
};

/** Redcliffe failures as readable answers: our own refusal 422, the lab's 502. */
async function lab<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (e) {
    if (e instanceof rc.RedcliffeError) {
      if (e.httpStatus !== null) console.error("redcliffe", e.httpStatus, e.message, JSON.stringify(e.body)?.slice(0, 500));
      return fail(e.httpStatus === null ? 422 : 502, e.message);
    }
    throw e;
  }
}

const at = (date: string | null, time: string | null) => (date && time ? `${date}T${time}:00+05:30` : null);
const isoDate = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d).slice(0, 10) : null);

export function toLabBooking(r: Row) {
  const date = isoDate(r.slot_date);
  const price = { packagePrice: 0, discount: 0, collectionCharge: 0, total: 0, ...(r.price ?? {}) };
  const left = Math.max(0, MAX_RESCHEDULES - (r.reschedule_count ?? 0));
  const person = r.person ?? {};
  return {
    id: r.id,
    partnerBookingId: r.provider_booking_id ?? null,
    status: r.status,
    packageCode: r.lab_package_code,
    packageName: r.package_name ?? r.lab_package_code,
    fastingNote: r.fasting_note ?? "",
    collectionStartsAt: at(date, r.slot_start) ?? "",
    collectionEndsAt: at(date, r.slot_end),
    addressId: r.address_id,
    // the app saves "street, place, city, state" as line1, so city and state are added only when missing
    address: [r.line1, r.line2, ...[r.city, r.state].filter((part) => part && !String(r.line1 ?? "").includes(part)), r.pincode]
      .filter(Boolean).join(", "),
    patient: { name: person.name ?? "", age: person.age ?? 0, gender: person.gender ?? "Male" },
    price,
    paymentRequired: r.status === "PAYMENT_PENDING" && price.total > 0,
    holdExpiresAt: r.status === "PAYMENT_PENDING" && r.hold_expires_at ? new Date(r.hold_expires_at).toISOString() : null,
    reschedulesLeft: left,
    canReschedule: r.status === "BOOKED" && left > 0,
    canCancel: r.status === "PAYMENT_PENDING" || r.status === "BOOKED",
    collector: r.collector ?? null,
    tests: r.tests ?? [],
  };
}

const bookingQuery = (db: Db, id: string) => db`
  select b.*, a.line1, a.line2, a.city, a.state, a.pincode, a.landmark, a.latitude, a.longitude
  from lab_bookings b left join addresses a on a.id = b.address_id where b.id = ${id}`;

async function ownedBooking(userId: number, id: string): Promise<Row> {
  await expireHolds(userId);
  const [row] = await bookingQuery(sql, id);
  if (!row || row.user_id !== userId) fail(404, "That lab booking was not found.");
  return row;
}

/** Unpaid holds past their 30 minutes become EXPIRED (checked whenever bookings are read). */
async function expireHolds(userId: number) {
  await sql`update lab_bookings set status = 'EXPIRED', updated_at = now()
    where user_id = ${userId} and status = 'PAYMENT_PENDING' and hold_expires_at < now()`;
}

async function ownedAddress(userId: number, addressId: unknown): Promise<Row> {
  const id = Number(addressId);
  if (!Number.isInteger(id) || id <= 0) fail(400, "Choose an address.");
  const [a] = await sql`select * from addresses where id = ${id} and user_id = ${userId}`;
  if (!a) fail(404, "That address was not found.");
  return a;
}

function coords(a: Row) {
  if (a.latitude == null || a.longitude == null) fail(400, "Pick this address on the map first. The lab needs its location.");
  return { latitude: Number(a.latitude), longitude: Number(a.longitude) };
}

async function findSlot(date: string, slotId: number, a: Row) {
  const { latitude, longitude } = coords(a);
  const slot = (await lab(rc.slots(date, latitude, longitude))).find((s) => s.slotId === slotId);
  if (!slot) fail(400, "Choose a collection time.");
  if (slot!.available <= 0) fail(409, "That time was just taken. Choose another.");
  return slot!;
}

// ---------------------------------------------------------------- catalogue and places

labRoutes.get("/labs/packages", async (c) => {
  await requirePatient(c);
  return ok(c, await lab(rc.listPackages()));
});

labRoutes.get("/labs/packages/:code", async (c) => {
  await requirePatient(c);
  return ok(c, await lab(rc.packageTests(c.req.param("code"))));
});

labRoutes.get("/labs/locations/search", async (c) => {
  await requirePatient(c);
  const lat = Number(c.req.query("latitude")), lng = Number(c.req.query("longitude"));
  const bias = c.req.query("latitude") && Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
  return ok(c, await lab(rc.searchPlaces(c.req.query("query") ?? "", bias)));
});

// registered before /:eloc so that "reverse" is never read as an eloc
labRoutes.get("/labs/locations/reverse", async (c) => {
  await requirePatient(c);
  if (rc.redcliffeLive()) fail(404, "This feature is not available yet.");
  const place = await lab(rc.reversePlace(Number(c.req.query("latitude")), Number(c.req.query("longitude"))));
  if (!place) fail(422, "We could not find an address here. Search for it instead.");
  return ok(c, place);
});

labRoutes.get("/labs/locations/:eloc", async (c) => {
  await requirePatient(c);
  return ok(c, await lab(rc.coordinates(c.req.param("eloc"))));
});

labRoutes.get("/labs/serviceability", async (c) => {
  await requirePatient(c);
  return ok(c, await lab(rc.serviceability(Number(c.req.query("latitude")), Number(c.req.query("longitude")))));
});

labRoutes.get("/labs/slots", async (c) => {
  const me = await requirePatient(c);
  const a = await ownedAddress(me.id, c.req.query("addressId"));
  const { latitude, longitude } = coords(a);
  return ok(c, await lab(rc.slots(c.req.query("date") ?? "", latitude, longitude)));
});

// ---------------------------------------------------------------- bookings

labRoutes.post("/labs/bookings", async (c) => {
  const me = await requirePatient(c);
  const input = await body<{
    packageCode?: string; addressId?: number; collectionDate?: string; slotId?: string | number; carePackageCode?: string;
    patient?: { name?: string; age?: number; gender?: string; mobile?: string; email?: string };
  }>(c);
  const packageCode = String(input.packageCode ?? "").trim();
  if (!packageCode) fail(400, "Choose a test package.");
  const collectionDate = String(input.collectionDate ?? "");
  const slotId = Number(input.slotId);
  const p = input.patient ?? {};
  const patient = {
    name: String(p.name ?? "").trim(), age: Number(p.age), mobile: String(p.mobile ?? "").replace(/\D/g, "").slice(-10),
    email: String(p.email ?? "").trim(), gender: /^f/i.test(String(p.gender ?? "")) ? "Female" : /^m/i.test(String(p.gender ?? "")) ? "Male" : "",
  };
  await lab((async () => { rc.checkCollectionDate(collectionDate); rc.checkPatient(patient); })());

  let care: Row | null = null;
  if (input.carePackageCode) {
    [care = null] = (await sql`select * from care_packages where code = ${input.carePackageCode}`) as Row[];
    if (!care || !care.includes_lab_tests) fail(400, "That care package does not include lab tests.");
    if (care!.lab_package_code !== packageCode) fail(400, "That test package is not part of this care package.");
  }
  const a = await ownedAddress(me.id, input.addressId);
  if (!String(a.landmark ?? "").trim()) fail(400, "Add a landmark to this address. The lab needs one.");
  const pkg = await lab(rc.findPackage(packageCode));
  const slot = await findSlot(collectionDate, slotId, a);

  // one unpaid hold at a time: release older ones at the lab first
  const older = await sql`select id, provider_booking_id from lab_bookings where user_id = ${me.id} and status = 'PAYMENT_PENDING'`;
  for (const o of older) {
    if (o.provider_booking_id) await rc.confirmBooking(o.provider_booking_id, false).catch((e) => console.error("release hold", o.id, e.message));
    await sql`update lab_bookings set status = 'CANCELLED', updated_at = now() where id = ${o.id}`;
  }

  const [row] = await sql`
    insert into lab_bookings (user_id, care_package_code, lab_package_code, address_id, slot_date, slot_id, slot_start, slot_end,
      slot_time, status, person, package_name, fasting_note, provider, tests)
    values (${me.id}, ${care?.code ?? null}, ${packageCode}, ${a.id}, ${collectionDate}, ${slotId}, ${slot.startTime}, ${slot.endTime},
      ${slot.startTime}, 'PAYMENT_PENDING', ${sql.json(patient)}, ${pkg.name}, ${pkg.fastingNote},
      ${rc.redcliffeLive() ? "redcliffe" : "mock"}, ${sql.json(rc.redcliffeLive() ? [] : rc.mockTests(packageCode))})
    returning id`;

  let partner: rc.PartnerBooking;
  try {
    partner = await lab(rc.createBooking({
      collectionDate, slotId, packageCode, patient, clientRefId: row.id,
      address: {
        line: a.line1, line2: [a.city, a.state].filter(Boolean).join(", "), landmark: a.landmark, pincode: a.pincode ?? "",
        latitude: Number(a.latitude), longitude: Number(a.longitude),
      },
    }));
  } catch (e) {
    await sql`delete from lab_bookings where id = ${row.id}`;
    throw e;
  }

  const price = care
    ? { packagePrice: care.price_rupees, discount: 0, collectionCharge: 0, total: care.price_rupees }
    : {
      packagePrice: partner.packagePrice, collectionCharge: partner.collectionCharge, total: partner.total,
      discount: Math.max(0, partner.packagePrice + partner.collectionCharge - partner.total),
    };
  await sql`
    update lab_bookings set provider_booking_id = ${partner.partnerBookingId}, package_name = ${partner.packageName || pkg.name},
      price = ${sql.json(price)}, amount_paise = ${Math.round(price.total * 100)},
      hold_expires_at = now() + make_interval(mins => ${HOLD_MINUTES}), updated_at = now()
    where id = ${row.id}`;
  if (care) await setEligibility(sql, me.id, { path: "LAB_TEST", stage: "AWAITING_PAYMENT", lab_booking_id: row.id });

  const [saved] = await bookingQuery(sql, row.id);
  return c.json({ success: true, message: "Collection time held for 30 minutes", data: toLabBooking(saved) }, 201);
});

labRoutes.get("/labs/bookings", async (c) => {
  const me = await requirePatient(c);
  await expireHolds(me.id);
  const rows = await sql`
    select b.*, a.line1, a.line2, a.city, a.state, a.pincode from lab_bookings b left join addresses a on a.id = b.address_id
    where b.user_id = ${me.id} order by b.created_at desc`;
  return ok(c, rows.map(toLabBooking));
});

labRoutes.get("/labs/bookings/:id", async (c) => {
  const me = await requirePatient(c);
  let row = await ownedBooking(me.id, c.req.param("id"));
  if (row.provider_booking_id && rc.redcliffeLive() && RANK[row.status] >= 1) {
    const fresh = await rc.bookingStatus(row.provider_booking_id).catch((e) => (console.error("redcliffe refresh", e.message), null));
    if (fresh) {
      await sql`update lab_bookings set collector = ${fresh.collector ? sql.json(fresh.collector) : null},
        tests = ${sql.json(fresh.tests)}, updated_at = now() where id = ${row.id}`;
      row = { ...row, collector: fresh.collector, tests: fresh.tests };
    }
  }
  return ok(c, toLabBooking(row));
});

labRoutes.post("/labs/bookings/:id/reschedule", async (c) => {
  const me = await requirePatient(c);
  const row = await ownedBooking(me.id, c.req.param("id"));
  const input = await body<{ collectionDate?: string; slotId?: string | number }>(c);
  if (row.status !== "BOOKED") fail(400, "This booking can no longer be moved. Call the lab to change it.");
  if ((row.reschedule_count ?? 0) >= MAX_RESCHEDULES) fail(400, "This booking has been moved twice already, the most the lab allows.");
  const date = String(input.collectionDate ?? "");
  const slotId = Number(input.slotId);
  const slot = await findSlot(date, slotId, row);
  await lab(rc.rescheduleBooking(row.provider_booking_id ?? "", date, slotId));
  await sql`update lab_bookings set slot_date = ${date}, slot_id = ${slotId}, slot_start = ${slot.startTime}, slot_end = ${slot.endTime},
    slot_time = ${slot.startTime}, reschedule_count = reschedule_count + 1, updated_at = now() where id = ${row.id}`;
  const [saved] = await bookingQuery(sql, row.id);
  return ok(c, toLabBooking(saved), "Collection moved");
});

labRoutes.post("/labs/bookings/:id/cancel", async (c) => {
  const me = await requirePatient(c);
  const row = await ownedBooking(me.id, c.req.param("id"));
  const { reason } = await body<{ reason?: string }>(c);
  if (row.status === "PAYMENT_PENDING") {
    if (row.provider_booking_id) await lab(rc.confirmBooking(row.provider_booking_id, false));
    const [e] = await sql`select lab_booking_id from eligibility where user_id = ${me.id}`;
    if (e?.lab_booking_id === row.id) await setEligibility(sql, me.id, { stage: "NOT_STARTED", lab_booking_id: null });
  } else if (row.status === "BOOKED") {
    await lab(rc.cancelBooking(row.provider_booking_id ?? "", String(reason ?? "")));
  } else {
    fail(400, "This booking can no longer be cancelled. Call the lab.");
  }
  await sql`update lab_bookings set status = 'CANCELLED', updated_at = now() where id = ${row.id}`;
  const [saved] = await bookingQuery(sql, row.id);
  return ok(c, toLabBooking(saved), "Booking cancelled");
});

labRoutes.get("/labs/bookings/:id/report", async (c) => {
  const me = await requirePatient(c);
  const row = await ownedBooking(me.id, c.req.param("id"));
  if (row.report_path) return ok(c, { url: await signedUrl("reports", row.report_path, 600) });
  if (row.status !== "REPORT_READY" || !row.provider_booking_id) fail(400, "The report is not ready yet.");
  return ok(c, { url: await lab(rc.reportUrl(row.provider_booking_id)) });
});

labRoutes.post("/labs/bookings/:id/simulate", async (c) => {
  if (rc.redcliffeLive()) fail(404, "This feature is not available.");
  const me = await requirePatient(c);
  const row = await ownedBooking(me.id, c.req.param("id"));
  const { event } = await body<{ event?: string }>(c);
  if (RANK[row.status] === undefined || row.status === "PAYMENT_PENDING") fail(400, "Pay for the booking first.");
  if (event === "SAMPLE_COLLECTED") {
    await sql`update lab_bookings set collector = ${sql.json({ name: "Ravi Kumar (pilot collector)", phone: "9000000000", trackingUrl: null })}
      where id = ${row.id}`;
    await applyLabEvent(row.id, "SAMPLE_COLLECTED");
  } else if (event === "REPORT_READY") {
    if (RANK[row.status] < RANK.SAMPLE_COLLECTED) await applyLabEvent(row.id, "SAMPLE_COLLECTED");
    await sql`update lab_bookings set tests = (select coalesce(jsonb_agg(t || '{"status":"COMPLETED"}'), '[]') from jsonb_array_elements(tests) t)
      where id = ${row.id}`;
    await applyLabEvent(row.id, "REPORT_READY");
  } else {
    fail(400, "event must be SAMPLE_COLLECTED or REPORT_READY.");
  }
  const [saved] = await bookingQuery(sql, row.id);
  return ok(c, toLabBooking(saved), "Simulated");
});

// ---------------------------------------------------------------- lab events (webhooks, simulation) and payment

export type LabEvent = "BOOKED" | "COLLECTOR_ASSIGNED" | "SAMPLE_COLLECTED" | "PROCESSING" | "REPORT_READY" | "CANCELLED";

/** Moves a booking forward (never backwards, except a resample back to BOOKED) and updates eligibility. */
export async function applyLabEvent(bookingId: string, event: LabEvent) {
  const [row] = await bookingQuery(sql, bookingId);
  if (!row) return;
  const current = RANK[row.status];
  if (current === undefined) return; // CANCELLED / EXPIRED stay put
  if (event !== "CANCELLED" && event !== "BOOKED" && RANK[event] <= current) return;
  await sql`update lab_bookings set status = ${event}, updated_at = now() where id = ${bookingId}`;
  const forEligibility = Boolean(row.care_package_code);
  if (event === "SAMPLE_COLLECTED" && forEligibility) await setEligibility(sql, row.user_id, { stage: "SAMPLE_COLLECTED" });
  if (event === "REPORT_READY") await attachReport(row, forEligibility);
}

async function attachReport(row: Row, forEligibility: boolean) {
  if (row.report_path) return;
  let pdf: Uint8Array<ArrayBuffer>;
  if (rc.redcliffeLive() && row.provider_booking_id && !String(row.provider_booking_id).startsWith("RC-MOCK")) {
    const url = await rc.reportUrl(row.provider_booking_id);
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`report download ${res.status}`);
    pdf = new Uint8Array(await res.arrayBuffer());
  } else {
    pdf = placeholderPdf([
      "InRange pilot: sample lab report",
      `Booking ${row.id}  ·  ${row.package_name ?? row.lab_package_code}`,
      `Collected for ${row.person?.name ?? "the patient"} on ${isoDate(row.slot_date)}`,
      "",
      "This is a placeholder generated in pilot mode. No sample was tested.",
      "When Redcliffe Labs is connected, the lab's own report replaces this file.",
    ]);
  }
  const path = `lab/${row.user_id}/${row.id}.pdf`;
  await uploadFile("reports", path, new Blob([pdf as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), "application/pdf").catch((e) => {
    if (!/exists/i.test(e.message)) throw e;
  });
  await sql`update lab_bookings set report_path = ${path}, updated_at = now() where id = ${row.id}`;
  await sql`
    insert into reports (user_id, purpose, source, title, file_path, file_name, mime_type, size_bytes, lab_booking_id, review_status, report_date)
    values (${row.user_id}, ${forEligibility ? "ELIGIBILITY" : "GENERAL"}, 'LAB', ${row.package_name ?? "Lab report"}, ${path},
      ${`${row.id}.pdf`}, 'application/pdf', ${pdf.byteLength}, ${row.id},
      ${forEligibility ? (env.pilotAutoApprove ? "APPROVED" : "UNDER_REVIEW") : null}, ${todayIST()})`;
  if (forEligibility) await setEligibility(sql, row.user_id, { stage: "UNDER_REVIEW" });
}

/**
 * After a verified LAB_BOOKING payment: make the hold permanent at the lab (re-creating it if the hold
 * lapsed), mark it BOOKED and move eligibility to LAB_SCHEDULED with the consultation prepaid.
 * If the lab refuses, the payment stays PAID and the booking is flagged (needs_attention) for the care team.
 */
export async function fulfilLabBooking(tx: TransactionSql, bookingId: string, userId: number) {
  const [row] = await tx`
    select b.*, a.line1, a.city, a.state, a.pincode, a.landmark, a.latitude, a.longitude
    from lab_bookings b left join addresses a on a.id = b.address_id where b.id = ${bookingId} for update of b`;
  if (!row || row.user_id !== userId) throw new Error(`lab booking ${bookingId} not found for payment`);
  if (RANK[row.status] >= 1) return; // already booked
  let partnerId: string = row.provider_booking_id ?? "";
  let problem: string | null = null;
  try {
    await rc.confirmBooking(partnerId, true);
  } catch (first) {
    try {
      const again = await rc.createBooking({
        collectionDate: isoDate(row.slot_date) ?? "", slotId: row.slot_id, packageCode: row.lab_package_code, patient: row.person,
        clientRefId: row.id, address: {
          line: row.line1, line2: [row.city, row.state].filter(Boolean).join(", "), landmark: row.landmark ?? "",
          pincode: row.pincode ?? "", latitude: Number(row.latitude), longitude: Number(row.longitude),
        },
      });
      partnerId = again.partnerBookingId;
      await rc.confirmBooking(partnerId, true);
    } catch (second) {
      problem = `Paid but the lab refused: ${(first as Error).message} / ${(second as Error).message}`;
      console.error("lab confirm", bookingId, problem);
    }
  }
  await tx`update lab_bookings set status = ${problem ? row.status : "BOOKED"}, provider_booking_id = ${partnerId || null},
    paid_at = now(), hold_expires_at = null, needs_attention = ${problem}, updated_at = now() where id = ${bookingId}`;
  if (row.care_package_code)
    await setEligibility(tx, userId, {
      path: "LAB_TEST", stage: "LAB_SCHEDULED", lab_booking_id: bookingId, consultation_paid: true,
    });
}

/** A one-page PDF (Helvetica, ASCII) for pilot placeholder reports. */
function placeholderPdf(lines: string[]): Uint8Array<ArrayBuffer> {
  const esc = (s: string) => s.replace(/[^\x20-\x7e]/g, "-").replace(/[()\\]/g, "\\$&");
  const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 16 : 11} Tf 56 ${780 - i * 24} Td (${esc(l)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
