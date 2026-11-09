// Redcliffe Labs (home blood tests), API v2. LIVE when REDCLIFFE_API_KEY is set (REDCLIFFE_BASE_URL
// picks the host); otherwise MOCK: a fixed Delhi NCR catalogue, places, slots and "RC-MOCK-..." ids, so
// the whole lab flow works in the pilot. Functions answer InRange's shapes (src/types/labTest.ts).
// Field names sent to Redcliffe are exactly theirs (typos included); see src/server/redcliffe/ for the
// annotated reference client this is ported from.
import { env, live } from "../lib/env.ts";
import { sql } from "../lib/db.ts";

export const redcliffeLive = live.redcliffe;

/** httpStatus null = refused before sending (bad input); the route answers 422 then, else 502. */
export class RedcliffeError extends Error {
  constructor(message: string, readonly httpStatus: number | null = null, readonly body: unknown = null) {
    super(message);
  }
}

export type LabPackage = {
  code: string; name: string; description: string; testCount: number; fastingNote: string; reportTime: string;
  forGender: "Both" | "Male" | "Female"; ageRange: { min: number; max: number } | null; price: number; listPrice: number;
  coveredByPlan: boolean;
};
export type LabPackageTests = { code: string; name: string; groups: { name: string; tests: string[] }[] };
export type LabPlace = { eloc: string; name: string; address: string; city: string; state: string; pincode: string };
export type LabSlot = { slotId: number; startTime: string; endTime: string; available: number };
export type NewPartnerBooking = {
  collectionDate: string; slotId: number; packageCode: string;
  patient: { name: string; age: number; gender: string; mobile: string; email: string };
  address: { line: string; line2: string; landmark: string; pincode: string; latitude: number; longitude: number };
  clientRefId: string;
};
export type PartnerBooking = { partnerBookingId: string; packageName: string; packagePrice: number; total: number; collectionCharge: number };
export type PartnerStatus = {
  collector: { name: string; phone: string; trackingUrl: string | null } | null;
  tests: { code: string; name: string; status: "PENDING" | "COMPLETED" | "REJECTED" | "DISMISSED" }[];
};

// ---------------------------------------------------------------- HTTP (live)

async function call<T>(method: "GET" | "POST", path: string, opts: { query?: Record<string, unknown>; body?: unknown } = {}): Promise<T> {
  const url = new URL(env.redcliffeBaseUrl.replace(/\/+$/, "") + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: { key: env.redcliffeApiKey, "Content-Type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: AbortSignal.timeout(15_000),
  }).catch((e) => { throw new RedcliffeError(`The lab could not be reached: ${e instanceof Error ? e.message : e}`, 503); });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch {
    throw new RedcliffeError(`The lab answered HTTP ${res.status} with a non-JSON body`, res.status, text.slice(0, 300));
  }
  const failure = failureMessage(body);
  if (failure) throw new RedcliffeError(failure, res.status, body);
  if (!res.ok) throw new RedcliffeError(`The lab answered HTTP ${res.status}`, res.status, body);
  return body as T;
}

/** Redcliffe's failure shapes: status false/"failure"/"error", {errors}, {error}, {detail}. */
function failureMessage(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const r = body as Record<string, unknown>;
  const said = typeof r.message === "string" && r.message ? r.message : null;
  if (r.status === false || (typeof r.status === "string" && /^(fail|error)/i.test(r.status))) return said ?? "The lab reported a failure";
  if (Array.isArray(r.errors)) return r.errors.join("; ") || "The lab reported a failure";
  if (typeof r.error === "string") return r.error;
  if (typeof r.detail === "string") return r.detail;
  return null;
}

const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

// ---------------------------------------------------------------- mock data

type MockPackage = LabPackage & { groups: { name: string; tests: string[] }[] };
const pkg = (code: string, name: string, description: string, price: number, listPrice: number, fasting: string,
  forGender: LabPackage["forGender"], groups: MockPackage["groups"]): MockPackage => ({
  code, name, description, price, listPrice, fastingNote: fasting, reportTime: "Within 24-48 hrs.", forGender,
  ageRange: { min: 18, max: 99 }, coveredByPlan: false, groups,
  testCount: groups.reduce((n, g) => n + g.tests.length, 0),
});

const MOCK_PACKAGES: MockPackage[] = [
  pkg("MD028", "Metabolic Health Panel", "The blood tests a doctor reads before a first metabolic consultation.", 1299, 2499,
    "8-10 Hrs Fasting Required", "Both", [
      { name: "Diabetes", tests: ["HbA1c", "Fasting Blood Sugar", "Estimated Average Glucose"] },
      { name: "Lipid Profile", tests: ["Total Cholesterol", "HDL Cholesterol", "LDL Cholesterol", "Triglycerides", "VLDL Cholesterol"] },
      { name: "Liver Function", tests: ["SGOT (AST)", "SGPT (ALT)", "Bilirubin Total", "Alkaline Phosphatase"] },
      { name: "Kidney Function", tests: ["Creatinine", "Urea", "Uric Acid", "eGFR"] },
      { name: "Thyroid", tests: ["TSH"] },
    ]),
  pkg("MD031", "Diabetes Check", "Blood sugar control over the last three months.", 499, 899, "8-10 Hrs Fasting Required", "Both", [
    { name: "Diabetes", tests: ["HbA1c", "Fasting Blood Sugar", "Estimated Average Glucose"] },
  ]),
  pkg("MD034", "Lipid and Liver Panel", "Cholesterol, triglycerides and liver enzymes.", 799, 1399, "10-12 Hrs Fasting Required", "Both", [
    { name: "Lipid Profile", tests: ["Total Cholesterol", "HDL Cholesterol", "LDL Cholesterol", "Triglycerides"] },
    { name: "Liver Function", tests: ["SGOT (AST)", "SGPT (ALT)", "GGT", "Albumin"] },
  ]),
  pkg("MD040", "Thyroid Profile", "Thyroid hormones (T3, T4 and TSH).", 449, 799, "", "Both", [
    { name: "Thyroid", tests: ["T3 Total", "T4 Total", "TSH"] },
  ]),
  pkg("MD045", "PCOS Panel", "Hormones a doctor checks for PCOS.", 1599, 2899, "", "Female", [
    { name: "Hormones", tests: ["LH", "FSH", "Prolactin", "Testosterone Total", "DHEA-S"] },
    { name: "Diabetes", tests: ["Fasting Blood Sugar", "Fasting Insulin"] },
  ]),
];

const MOCK_PLACES: (LabPlace & { latitude: number; longitude: number })[] = [
  { eloc: "MMI0A1", name: "DLF Phase 3", address: "DLF Phase 3, Gurugram, Haryana", city: "Gurugram", state: "Haryana", pincode: "122002", latitude: 28.4933, longitude: 77.0937 },
  { eloc: "MMI0A2", name: "Sector 56", address: "Sector 56, Gurugram, Haryana", city: "Gurugram", state: "Haryana", pincode: "122011", latitude: 28.4237, longitude: 77.1035 },
  { eloc: "MMI0B1", name: "Hauz Khas", address: "Hauz Khas, New Delhi, Delhi", city: "New Delhi", state: "Delhi", pincode: "110016", latitude: 28.5494, longitude: 77.2001 },
  { eloc: "MMI0B2", name: "Vasant Kunj", address: "Vasant Kunj, New Delhi, Delhi", city: "New Delhi", state: "Delhi", pincode: "110070", latitude: 28.5293, longitude: 77.1530 },
  { eloc: "MMI0B3", name: "Greater Kailash II", address: "Greater Kailash II, New Delhi, Delhi", city: "New Delhi", state: "Delhi", pincode: "110048", latitude: 28.5311, longitude: 77.2420 },
  { eloc: "MMI0B4", name: "Connaught Place", address: "Connaught Place, New Delhi, Delhi", city: "New Delhi", state: "Delhi", pincode: "110001", latitude: 28.6315, longitude: 77.2167 },
  { eloc: "MMI0C1", name: "Sector 62", address: "Sector 62, Noida, Uttar Pradesh", city: "Noida", state: "Uttar Pradesh", pincode: "201309", latitude: 28.6270, longitude: 77.3725 },
  { eloc: "MMI0C2", name: "Indirapuram", address: "Indirapuram, Ghaziabad, Uttar Pradesh", city: "Ghaziabad", state: "Uttar Pradesh", pincode: "201014", latitude: 28.6415, longitude: 77.3711 },
];

// ponytail: a bounding box around Delhi NCR stands in for Redcliffe's serviceability map in mock mode
const inNcr = (lat: number, lng: number) => lat > 28.2 && lat < 28.95 && lng > 76.8 && lng < 77.6;

const mockPackage = (code: string) => {
  const found = MOCK_PACKAGES.find((p) => p.code === code);
  if (!found) throw new RedcliffeError("That test package is not offered.");
  return found;
};

// ---------------------------------------------------------------- input checks (Redcliffe's own limits)

const ensure = (ok: boolean, message: string) => { if (!ok) throw new RedcliffeError(message); };

export function checkCollectionDate(date: string) {
  ensure(/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)), "Choose a collection day.");
  const today = todayIST();
  const last = new Date(`${today}T00:00:00Z`);
  last.setUTCDate(last.getUTCDate() + 4);
  ensure(date >= today && date <= last.toISOString().slice(0, 10), "The lab collects from today up to 4 days ahead. Choose another day.");
}

export function checkPatient(p: NewPartnerBooking["patient"]) {
  ensure(/^[A-Za-z ]{3,30}$/.test(p.name.trim()), "The name must be 3 to 30 letters.");
  ensure(Number.isInteger(p.age) && p.age > 0 && p.age <= 120, "Enter the age in whole years.");
  ensure(/^(male|female)$/i.test(p.gender), "The lab needs Male or Female.");
  ensure(/^[6-9]\d{9}$/.test(p.mobile), "Enter a 10-digit mobile number.");
  ensure(/^\S+@\S+\.\S+$/.test(p.email.trim()), "Enter a valid email address.");
}

// ---------------------------------------------------------------- packages

type RcPackagePage = {
  links: { next: string | null };
  data: { name: string; description: string; recommended_gender: string; recommended_age: string; tat_time: string;
    fasting_time: string; code: string; parameters: number; package_center_prices: { package_price: number; offer_price: number } }[];
};

let packageCache: { at: number; list: LabPackage[] } | null = null;

export async function listPackages(): Promise<LabPackage[]> {
  if (!redcliffeLive()) return MOCK_PACKAGES.map(({ groups: _g, ...p }) => p);
  if (packageCache && Date.now() - packageCache.at < 10 * 60_000) return packageCache.list;
  const list: LabPackage[] = [];
  for (let page = 1; page <= 20; page++) {
    const body = await call<RcPackagePage>("GET", "/api/external/v2/center-package-data/", { query: { search: "", page } });
    for (const p of body.data ?? []) {
      const [min, max] = String(p.recommended_age ?? "").split("-").map(Number);
      const gender = String(p.recommended_gender ?? "").toLowerCase();
      list.push({
        code: p.code, name: p.name, description: p.description ?? "", testCount: p.parameters ?? 0,
        fastingNote: /no fasting/i.test(p.fasting_time ?? "") ? "" : p.fasting_time ?? "",
        reportTime: p.tat_time ?? "", forGender: gender === "male" ? "Male" : gender === "female" ? "Female" : "Both",
        ageRange: Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null,
        price: p.package_center_prices?.offer_price ?? 0, listPrice: p.package_center_prices?.package_price ?? 0, coveredByPlan: false,
      });
    }
    if (!body.links?.next) break;
  }
  packageCache = { at: Date.now(), list };
  return list;
}

export async function findPackage(code: string): Promise<LabPackage> {
  const found = (await listPackages()).find((p) => p.code === code);
  if (!found) throw new RedcliffeError("That test package is not offered.");
  return found;
}

export async function packageTests(code: string): Promise<LabPackageTests> {
  if (!redcliffeLive()) {
    const p = mockPackage(code);
    return { code: p.code, name: p.name, groups: p.groups };
  }
  const body = await call<{ code: string; name: string; data: { name: string; package_detail: { name: string }[] }[] }>(
    "GET", "/api/external/v2/package-parameter-data/", { query: { code } });
  return {
    code: body.code ?? code, name: body.name ?? "",
    groups: (body.data ?? []).map((g) => ({ name: g.name, tests: (g.package_detail ?? []).map((t) => t.name) })),
  };
}

// ---------------------------------------------------------------- places, serviceability, slots

// ---- mock-mode places: real Indian addresses from Photon (OpenStreetMap), cached so an eloc resolves
// ponytail: Photon's public instance (fair use, no key). Point PHOTON_URL at a self-hosted one if pilot traffic grows.
const PHOTON_URL = "https://photon.komoot.io";
type PhotonFeature = { properties: Record<string, string | undefined>; geometry: { coordinates: [number, number] } };

const uniq = (parts: (string | undefined)[]) => {
  const seen = new Set<string>();
  return parts.map((x) => x?.trim()).filter((x): x is string => {
    if (!x || seen.has(x.toLowerCase())) return false;
    seen.add(x.toLowerCase());
    return true;
  });
};

async function photon(path: string, params: Record<string, string | number>): Promise<PhotonFeature[]> {
  const url = `${PHOTON_URL}${path}?` + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(url, { headers: { "User-Agent": "InRange-pilot/0.1" }, signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  return ((await res.json()).features ?? []).filter((f: PhotonFeature) => f.properties.countrycode === "IN");
}

/** Maps Photon features to places and caches each one's point under a fresh 6-character eloc. */
async function cachePlaces(features: PhotonFeature[]): Promise<LabPlace[]> {
  const places: (LabPlace & { latitude: number; longitude: number })[] = [];
  for (const f of features) {
    const p = f.properties;
    // OSM's "district" in Indian cities is often a sector or ward, so the county comes first
    const city = p.city ?? p.town ?? p.county ?? p.district ?? "";
    const street = p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street;
    const name = p.name ?? street ?? city;
    const address = uniq([name, street, p.locality, p.district, city, p.state]).join(", ");
    if (!name || places.some((x) => x.address === address)) continue;
    const eloc = "P" + Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
    places.push({ eloc, name, address, city, state: p.state ?? "", pincode: [p.postcode, p.name].find((x) => /^\d{6}$/.test(x ?? "")) ?? "",
      longitude: f.geometry.coordinates[0], latitude: f.geometry.coordinates[1] });
  }
  if (places.length)
    await sql`insert into place_cache ${sql(places.map(({ eloc, latitude, longitude, ...place }) =>
      ({ eloc, latitude, longitude, place: sql.json({ eloc, ...place }) })))} on conflict (eloc) do nothing`;
  return places.map(({ latitude: _a, longitude: _b, ...p }) => p);
}

// Last resort when Photon is down: what the person typed, in each NCR city ("MQ" + city index + 3 chars).
const MOCK_CITIES = [
  { city: "Gurugram", state: "Haryana", pincode: "122002", latitude: 28.4595, longitude: 77.0266 },
  { city: "New Delhi", state: "Delhi", pincode: "110001", latitude: 28.6139, longitude: 77.2090 },
  { city: "Noida", state: "Uttar Pradesh", pincode: "201301", latitude: 28.5355, longitude: 77.3910 },
  { city: "Ghaziabad", state: "Uttar Pradesh", pincode: "201001", latitude: 28.6692, longitude: 77.4538 },
  { city: "Faridabad", state: "Haryana", pincode: "121001", latitude: 28.4089, longitude: 77.3178 },
];

function typedPlaces(q: string): LabPlace[] {
  const name = q.replace(/\s+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()).slice(0, 80);
  const tag = Array.from(name.toLowerCase()).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 46656, 7).toString(36).padStart(3, "0");
  return MOCK_CITIES.map((c, i) => ({
    eloc: `MQ${i}${tag}`, name, address: `${name}, ${c.city}, ${c.state}`, city: c.city, state: c.state, pincode: c.pincode,
  }));
}

export type Bias = { latitude: number; longitude: number } | null;

export async function searchPlaces(query: string, bias: Bias = null): Promise<LabPlace[]> {
  const q = query.trim();
  if (!q) return [];
  if (!redcliffeLive()) {
    const words = q.toLowerCase().split(/\s+/);
    const known = MOCK_PLACES.filter((p) => words.every((w) => `${p.name} ${p.address} ${p.pincode}`.toLowerCase().includes(w)))
      .map(({ latitude: _a, longitude: _b, ...p }) => p);
    try {
      const found = await cachePlaces(await photon("/api/", {
        q, limit: 10, lang: "en", bbox: "68.1,6.5,97.5,35.7", ...(bias ? { lat: bias.latitude, lon: bias.longitude } : {}),
      }));
      return found.length ? found : known;
    } catch (e) {
      console.error("photon search", e);
      return q.length >= 3 ? [...known, ...typedPlaces(q)] : known;
    }
  }
  try {
    const body = await call<{ results?: { eloc: string; placeName: string; placeAddress: string; address: Record<string, string> }[] }>(
      "GET", "/api/partner/v2/get-partner-location-2-eloc/", { query: { place_query: q } });
    return (body.results ?? []).map((r) => ({
      eloc: r.eloc.trim(), name: r.placeName, address: r.placeAddress,
      city: r.address?.city ?? "", state: r.address?.state ?? "", pincode: r.address?.pincode ?? "",
    }));
  } catch (e) {
    if (e instanceof RedcliffeError && /no record/i.test(e.message)) return [];
    throw e;
  }
}

/** For "Use my current location": the place at a point (mock mode only; Redcliffe has no reverse lookup). */
export async function reversePlace(latitude: number, longitude: number): Promise<LabPlace | null> {
  ensure(Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180,
    "That location is not valid.");
  const [place] = await cachePlaces(await photon("/reverse", { lat: latitude, lon: longitude, lang: "en" }));
  if (!place) return null;
  // keep where the person stands, not the street's centre point
  await sql`update place_cache set latitude = ${latitude}, longitude = ${longitude} where eloc = ${place.eloc}`;
  return place;
}

export async function coordinates(eloc: string): Promise<{ latitude: number; longitude: number }> {
  const id = eloc.trim();
  ensure(/^[A-Za-z0-9]{6}$/.test(id), "That place is not valid. Search again.");
  if (!redcliffeLive()) {
    const [cached] = id.startsWith("P") ? await sql`select latitude, longitude from place_cache where eloc = ${id}` : [];
    const p = cached ?? MOCK_PLACES.find((m) => m.eloc === id) ?? (id.startsWith("MQ") ? MOCK_CITIES[Number(id[2])] : undefined);
    if (!p) throw new RedcliffeError("That place is not valid. Search again.");
    return { latitude: p.latitude, longitude: p.longitude };
  }
  const body = await call<{ latitude: number | string; longitude: number | string }>(
    "GET", "/api/partner/v2/get-partner-loc-2-eloc/", { query: { eloc: id } });
  if (body.latitude === "" || body.longitude === "") throw new RedcliffeError("That place is not valid. Search again.", 200, body);
  return { latitude: Number(body.latitude), longitude: Number(body.longitude) };
}

export async function serviceability(latitude: number, longitude: number): Promise<{ serviceable: boolean; message: string }> {
  ensure(Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180,
    "That location is not valid.");
  if (!redcliffeLive())
    return inNcr(latitude, longitude)
      ? { serviceable: true, message: "Home collection is available here." }
      : { serviceable: false, message: "Home collection is not available here yet. The pilot covers Delhi NCR." };
  try {
    const body = await call<{ message: string }>("GET", "/api/center/v2/is-location-serviceable/", { query: { longitude, latitude } });
    return { serviceable: true, message: body.message ?? "Home collection is available here." };
  } catch (e) {
    if (e instanceof RedcliffeError && e.httpStatus !== null && e.httpStatus < 500) return { serviceable: false, message: e.message };
    throw e;
  }
}

export async function slots(date: string, latitude: number, longitude: number): Promise<LabSlot[]> {
  checkCollectionDate(date);
  if (!redcliffeLive()) {
    // one-hour windows 06:00 to 18:00; today, anything starting within 2 hours is closed
    const nowHour = date === todayIST() ? new Date(Date.now() + 5.5 * 3600_000).getUTCHours() + 2 : -1;
    return Array.from({ length: 12 }, (_, i) => {
      const h = 6 + i;
      const pad = (n: number) => String(n).padStart(2, "0");
      return { slotId: h, startTime: `${pad(h)}:00`, endTime: `${pad(h + 1)}:00`, available: h > nowHour ? 3 : 0 };
    });
  }
  const body = await call<{ results?: RcSlot[]; data?: RcSlot[] }>("GET", "/api/booking/v2/get-time-slot-list/", {
    query: { collection_date: date, latitude, longitude },
  });
  return (body.results ?? body.data ?? []).map((s) => ({
    slotId: s.id, startTime: s.format_24_hrs.start_time.slice(0, 5), endTime: s.format_24_hrs.end_time.slice(0, 5), available: s.available_slot,
  }));
}
type RcSlot = { id: number; available_slot: number; format_24_hrs: { start_time: string; end_time: string } };

// ---------------------------------------------------------------- bookings

/** A TEMPORARY booking: Redcliffe locks the slot for 30 minutes until confirmBooking(id, true). */
export async function createBooking(b: NewPartnerBooking): Promise<PartnerBooking> {
  checkCollectionDate(b.collectionDate);
  ensure(Number.isInteger(b.slotId) && b.slotId > 0, "Choose a collection time.");
  checkPatient(b.patient);
  ensure(b.address.line.trim() !== "", "The address needs a street line.");
  ensure(b.address.landmark.trim() !== "", "Add a landmark to this address. The lab needs one.");
  ensure(/^\d{6}$/.test(b.address.pincode), "The address needs a 6-digit pincode.");
  ensure(Number.isFinite(b.address.latitude) && Number.isFinite(b.address.longitude), "Pick this address on the map first.");
  if (!redcliffeLive()) {
    const p = mockPackage(b.packageCode);
    return { partnerBookingId: `RC-MOCK-${100000 + Math.floor(Math.random() * 900000)}`, packageName: p.name, packagePrice: p.price, total: p.price, collectionCharge: 0 };
  }
  const gender = b.patient.gender.toLowerCase();
  const body = await call<{
    booking_id?: number; message?: string; packages?: { name: string }[];
    discounted_price?: { total_price_package: number; final_total_price: number; phlebo_cost: number };
  }>("POST", "/api/external/v2/center-create-booking/", {
    body: {
      booking_date: todayIST(), collection_date: b.collectionDate, collection_slot: b.slotId, package_code: [b.packageCode],
      customer_name: b.patient.name.trim(), customer_age: b.patient.age, customer_gender: gender,
      customer_email: b.patient.email.trim(), customer_phonenumber: b.patient.mobile,
      customer_altphonenumber: b.patient.mobile, customer_whatsappnumber: b.patient.mobile,
      customer_address: b.address.line, address_line2: b.address.line2, customer_landmark: b.address.landmark,
      pincode: b.address.pincode, customer_latitude: b.address.latitude, customer_longitude: b.address.longitude,
      is_credit: true, client_refid: b.clientRefId, reference_data: b.clientRefId, additional_member: [],
    },
  });
  // a full slot comes back as status "Sucess" with a message and no booking
  if (typeof body.booking_id !== "number") throw new RedcliffeError(body.message || "The lab could not hold that time. Choose another.", 200, body);
  const d = body.discounted_price;
  return {
    partnerBookingId: String(body.booking_id), packageName: body.packages?.[0]?.name ?? b.packageCode,
    packagePrice: d?.total_price_package ?? 0, total: d?.final_total_price ?? 0, collectionCharge: d?.phlebo_cost ?? 0,
  };
}

const partnerNumber = (id: string) => {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new RedcliffeError("This booking has no lab reference yet.");
  return n;
};

/** true after payment makes the hold permanent; false releases it. No-op for mock bookings. */
export async function confirmBooking(partnerId: string, isConfirmed: boolean): Promise<void> {
  if (!redcliffeLive() || partnerId.startsWith("RC-MOCK")) return;
  await call("POST", "/api/external/v2/center-confirm-booking/", { body: { booking_id: partnerNumber(partnerId), is_confirmed: isConfirmed } });
}

export async function rescheduleBooking(partnerId: string, date: string, slotId: number): Promise<void> {
  checkCollectionDate(date);
  ensure(Number.isInteger(slotId) && slotId > 0, "Choose a collection time.");
  if (!redcliffeLive() || partnerId.startsWith("RC-MOCK")) return;
  await call("POST", "/api/external/v2/center-update-booking/", {
    body: { booking_id: partnerNumber(partnerId), booking_status: "rescheduled", remark: "Patient asked for a new time", collection_date: date, collection_slot: slotId },
  });
}

export async function cancelBooking(partnerId: string, reason: string): Promise<void> {
  if (!redcliffeLive() || partnerId.startsWith("RC-MOCK")) return;
  await call("POST", "/api/external/v2/center-update-booking/", {
    body: { booking_id: partnerNumber(partnerId), booking_status: "cancelled", remark: reason.trim() || "Cancelled by the patient" },
  });
}

/** Collector and per-test status. Mock bookings keep what the database already has. */
export async function bookingStatus(partnerId: string): Promise<PartnerStatus | null> {
  if (!redcliffeLive() || partnerId.startsWith("RC-MOCK")) return null;
  const id = partnerNumber(partnerId);
  const [bookings, tracking, tests] = await Promise.all([
    call<{ data?: { phlebo_detail: { name: string; contact: string } | null }[] }>("GET", "/api/external/v2/center-get-booking", { query: { booking_id: id } }).catch(() => ({ data: [] })),
    call<{ data?: { tracking_link?: string } }>("GET", "/api/external/v2/corporate-phlebo-tracking/", { query: { booking_id: id } }).catch(() => ({ data: undefined })),
    call<{ data?: Record<string, string[]> }>("GET", "/api/external/v2/booking-test-status/", { query: { booking_id: id } }).catch(() => ({ data: undefined })),
  ]);
  const phlebo = bookings.data?.[0]?.phlebo_detail ?? null;
  const t: Record<string, string[] | undefined> = tests.data ?? {};
  const list = (codes: string[] | undefined, status: PartnerStatus["tests"][number]["status"]) =>
    (codes ?? []).map((code) => ({ code, name: code, status }));
  return {
    collector: phlebo ? { name: phlebo.name, phone: String(phlebo.contact ?? ""), trackingUrl: tracking.data?.tracking_link ?? null } : null,
    tests: [...list(t.pending_tests, "PENDING"), ...list(t.completed_tests, "COMPLETED"), ...list(t.rejected_tests, "REJECTED"), ...list(t.dismissed_tests, "DISMISSED")],
  };
}

/** A fresh link to the consolidated report PDF (Redcliffe's links expire). */
export async function reportUrl(partnerId: string): Promise<string> {
  const body = await call<{ Report_url?: string }>("GET", `/api/external/v2/get-consolidated-report/${partnerNumber(partnerId)}`);
  if (!body.Report_url) throw new RedcliffeError("The report is not ready yet.", 200, body);
  return body.Report_url;
}

export function mockTests(code: string): PartnerStatus["tests"] {
  const p = MOCK_PACKAGES.find((m) => m.code === code);
  return (p?.groups ?? []).flatMap((g) => g.tests).map((name, i) => ({ code: `${code}-${i + 1}`, name, status: "PENDING" as const }));
}
