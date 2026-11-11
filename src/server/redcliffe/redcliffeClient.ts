import "server-only";

/**
 * Redcliffe Labs API v2 client (home blood tests). Server only: it sends the secret key. Backend routes
 * call one function per Redcliffe endpoint; docs/backend/lab-tests-redcliffe.md maps each inrange
 * route to its function. Field names are exactly Redcliffe's, typos included (see the comments).
 * Every function validates what the doc constrains before sending, and every failure (our validation,
 * or any of Redcliffe's failure shapes) is thrown as one RedcliffeError carrying the doc's message.
 *
 * Intentionally not wrapped (not in inrange's journey): drop-off create/update, camp booking, imaging
 * and centre-visit (package data, providers, provider slots, booking), open-add-member,
 * center-update-is-credit, open-set-package, mock-b2b-webhook (staging test trigger).
 *
 * Env (server only; src/config/env.ts is for public values): REDCLIFFE_BASE_URL, REDCLIFFE_API_KEY.
 */

import type {
  RedcliffeBooking,
  RedcliffeBookingFilters,
  RedcliffeBookingUpdate,
  RedcliffeConfirmation,
  RedcliffeConsolidatedReport,
  RedcliffeCoordinates,
  RedcliffeCreatedBooking,
  RedcliffeDigitalReport,
  RedcliffeGender,
  RedcliffeNewBooking,
  RedcliffePackagePage,
  RedcliffePackageParameters,
  RedcliffePhleboTracking,
  RedcliffePlace,
  RedcliffeServiceability,
  RedcliffeSlot,
  RedcliffeTestStatus,
  RedcliffeUpdatedBooking,
  RedcliffeWebhook,
  RedcliffeWebhookSetup,
} from "./redcliffeTypes";

/** httpStatus is null when nothing was sent (bad input or missing config): answer 422/500, not 502. */
export class RedcliffeError extends Error {
  readonly httpStatus: number | null;
  readonly body: unknown;
  constructor(
    message: string,
    httpStatus: number | null = null,
    body: unknown = null,
  ) {
    super(message);
    this.name = "RedcliffeError";
    this.httpStatus = httpStatus;
    this.body = body;
  }
}

const TIMEOUT_MS = 15_000;
const MAX_DAYS_AHEAD = 4;
const MAX_ADDITIONAL_MEMBERS = 4;

// ---------- input checks (the doc's own limits) ----------

function ensure(ok: boolean, message: string) {
  if (!ok) throw new RedcliffeError(message);
}

/** Today in India: Redcliffe's booking_date and its 4-day window are IST dates. */
export function todayInIndia(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    now,
  );
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function checkCollectionDate(date: string) {
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
    addDays(date, 0) === date;
  ensure(valid, "collection_date must be in format of YYYY-MM-DD");
  const today = todayInIndia();
  ensure(
    date >= today && date <= addDays(today, MAX_DAYS_AHEAD),
    `collection_date must be between ${today} and ${addDays(today, MAX_DAYS_AHEAD)} (today plus ${MAX_DAYS_AHEAD} days)`,
  );
}

function checkCoordinates(latitude: number, longitude: number) {
  const ok =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  ensure(ok, "latitude and longitude must be decimal degrees");
}

function checkId(value: number, name: string) {
  ensure(
    Number.isInteger(value) && value > 0,
    `${name} must be a positive integer`,
  );
}

function checkMobile(value: string, name: string) {
  ensure(
    /^\d{10}$/.test(value) && Number(value) >= 6000000000,
    `${name} must be a 10-digit Indian mobile number (6000000000 to 9999999999)`,
  );
}

function checkName(value: string, name: string) {
  // ponytail: spaces allowed (the doc's examples use "Sachin Sharma"); the doc says letters only, 3-30
  ensure(/^[A-Za-z ]{3,30}$/.test(value), `${name} must be 3 to 30 letters`);
}

function checkAge(value: number, name: string) {
  ensure(
    Number.isInteger(value) && value > 0 && value <= 120,
    `${name} must be a whole number of years`,
  );
}

/** The doc's table says Male/Female; every example request sends lower case, so we send that. */
function toGender(value: string, name: string): RedcliffeGender {
  const gender = value.toLowerCase();
  ensure(
    gender === "male" || gender === "female",
    `${name} must be male or female`,
  );
  return gender as RedcliffeGender;
}

function checkPackageCodes(codes: string[], name: string) {
  ensure(
    Array.isArray(codes) &&
      codes.length > 0 &&
      codes.every((code) => typeof code === "string" && code.trim() !== ""),
    `${name} must list at least one package code`,
  );
}

// ---------- the one HTTP call ----------

const FAILED_STATUS = /^(fail|error)/i;

/** Redcliffe's failure shapes: status failure/Failed/error/false, {errors:[...]}, {error}, {detail}, DRF {field:[...]} */
function failureMessage(body: unknown): string | null {
  if (body === null || typeof body !== "object" || Array.isArray(body))
    return null;
  const reply = body as Record<string, unknown>;
  const said =
    typeof reply.message === "string" && reply.message ? reply.message : null;
  if (
    reply.status === false ||
    (typeof reply.status === "string" && FAILED_STATUS.test(reply.status))
  )
    return said ?? "Redcliffe reported a failure";
  if (Array.isArray(reply.errors))
    return reply.errors.join("; ") || "Redcliffe reported a failure";
  if (typeof reply.error === "string") return reply.error;
  if (typeof reply.detail === "string") return reply.detail;
  if (!("status" in reply)) {
    const fieldErrors = Object.entries(reply).filter(
      ([, value]) =>
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((item) => typeof item === "string"),
    );
    if (
      fieldErrors.length > 0 &&
      fieldErrors.length === Object.keys(reply).length
    )
      return fieldErrors
        .map(([field, value]) => `${field}: ${(value as string[]).join(" ")}`)
        .join("; ");
  }
  return null;
}

type Query = Record<string, string | number | undefined>;

async function redcliffe<T>(
  method: "GET" | "POST",
  path: string,
  options: { query?: Query; body?: unknown } = {},
): Promise<T> {
  const baseUrl = process.env.REDCLIFFE_BASE_URL?.replace(/\/+$/, "");
  const key = process.env.REDCLIFFE_API_KEY;
  if (!baseUrl || !key)
    throw new RedcliffeError(
      "REDCLIFFE_BASE_URL and REDCLIFFE_API_KEY must be set on the server",
    );

  const url = new URL(baseUrl + path);
  for (const [name, value] of Object.entries(options.query ?? {}))
    if (value !== undefined) url.searchParams.set(name, String(value));

  // globalThis.fetch: the lint rule reserving fetch for apiClient is about browser code; this is the server's own call
  const response = await globalThis
    .fetch(url, {
      method,
      headers: { key, "Content-Type": "application/json" },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    .catch((caught: unknown) => {
      throw new RedcliffeError(
        `Redcliffe could not be reached: ${caught instanceof Error ? caught.message : String(caught)}`,
      );
    });

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new RedcliffeError(
      `Redcliffe answered HTTP ${response.status} with a non-JSON body`,
      response.status,
      text.slice(0, 500),
    );
  }
  const failure = failureMessage(body);
  if (failure) throw new RedcliffeError(failure, response.status, body);
  if (!response.ok)
    throw new RedcliffeError(
      `Redcliffe answered HTTP ${response.status}`,
      response.status,
      body,
    );
  return body as T;
}

// ---------- location ----------

/** GET /api/partner/v2/get-partner-location-2-eloc/?place_query= : places for an area search. "No record(s) found" is []. */
export async function searchLocations(
  placeQuery: string,
): Promise<RedcliffePlace[]> {
  ensure(placeQuery.trim().length > 0, "place_query is required");
  try {
    const body = await redcliffe<{ results?: RedcliffePlace[] }>(
      "GET",
      "/api/partner/v2/get-partner-location-2-eloc/",
      { query: { place_query: placeQuery.trim() } },
    );
    return (body.results ?? []).map((place) => ({
      ...place,
      eloc: place.eloc.trim(),
    }));
  } catch (caught) {
    if (caught instanceof RedcliffeError && /no record/i.test(caught.message))
      return [];
    throw caught;
  }
}

/** GET /api/partner/v2/get-partner-loc-2-eloc/?eloc= : latitude and longitude of a place (empty strings mean an invalid eloc). */
export async function getCoordinatesForEloc(
  eloc: string,
): Promise<RedcliffeCoordinates> {
  const trimmed = eloc.trim();
  ensure(/^[A-Za-z0-9]{6}$/.test(trimmed), "eloc must be 6 letters or digits");
  const body = await redcliffe<{
    latitude: number | string;
    longitude: number | string;
  }>("GET", "/api/partner/v2/get-partner-loc-2-eloc/", {
    query: { eloc: trimmed },
  });
  if (body.latitude === "" || body.longitude === "")
    throw new RedcliffeError("eloc is not valid", 200, body);
  return { latitude: Number(body.latitude), longitude: Number(body.longitude) };
}

/** GET /api/center/v2/is-location-serviceable/?longitude=&latitude= : whether collectors reach the point. */
export async function checkServiceability(
  latitude: number,
  longitude: number,
): Promise<RedcliffeServiceability> {
  checkCoordinates(latitude, longitude);
  try {
    const body = await redcliffe<{ message: string }>(
      "GET",
      "/api/center/v2/is-location-serviceable/",
      { query: { longitude, latitude } },
    );
    return { serviceable: true, message: body.message };
  } catch (caught) {
    // "failure" here is the answer "not serviceable" (or a point Redcliffe cannot place), not a broken call
    if (
      caught instanceof RedcliffeError &&
      caught.httpStatus !== null &&
      caught.httpStatus < 500
    )
      return { serviceable: false, message: caught.message };
    throw caught;
  }
}

// ---------- slots and packages ----------

/** GET /api/booking/v2/get-time-slot-list/?collection_date=&latitude=&longitude= : one-hour windows on a day. */
export async function listTimeSlots(
  collectionDate: string,
  latitude: number,
  longitude: number,
): Promise<RedcliffeSlot[]> {
  checkCollectionDate(collectionDate);
  checkCoordinates(latitude, longitude);
  const body = await redcliffe<{
    results?: RedcliffeSlot[];
    data?: RedcliffeSlot[];
  }>("GET", "/api/booking/v2/get-time-slot-list/", {
    query: { collection_date: collectionDate, latitude, longitude },
  });
  // doc conflict: the slot list is "results" in the example and "data" in the field table and empty cases
  return body.results ?? body.data ?? [];
}

/** GET /api/external/v2/center-package-data/?search= : the packages enabled for inrange, 20 a page (production only). */
export async function getPackageData(
  search = "",
  page?: number,
): Promise<RedcliffePackagePage> {
  return redcliffe<RedcliffePackagePage>(
    "GET",
    "/api/external/v2/center-package-data/",
    { query: { search, page } },
  );
}

/** GET /api/external/v2/package-parameter-data/?code= : the tests inside one package (production only). */
export async function getPackageParameters(
  packageCode: string,
): Promise<RedcliffePackageParameters> {
  checkPackageCodes([packageCode], "code");
  return redcliffe<RedcliffePackageParameters>(
    "GET",
    "/api/external/v2/package-parameter-data/",
    { query: { code: packageCode } },
  );
}

// ---------- booking ----------

/**
 * POST /api/external/v2/center-create-booking/ : a TEMPORARY booking; the slot is locked for 30 minutes
 * until confirmBooking. booking_date is today (IST), as the doc requires.
 */
export async function createBooking(
  booking: RedcliffeNewBooking,
): Promise<RedcliffeCreatedBooking> {
  checkCollectionDate(booking.collection_date);
  checkId(booking.collection_slot, "collection_slot");
  checkPackageCodes(booking.package_code, "package_code");
  checkName(booking.customer_name.trim(), "customer_name");
  checkAge(booking.customer_age, "customer_age");
  const gender = toGender(booking.customer_gender, "customer_gender");
  checkMobile(booking.customer_phonenumber, "customer_phonenumber");
  ensure(
    /^\S+@\S+\.\S+$/.test(booking.customer_email.trim()),
    "customer_email must be an email address",
  );
  ensure(
    booking.customer_address.trim() !== "",
    "customer_address is required",
  );
  ensure(
    booking.customer_landmark.trim() !== "",
    "customer_landmark is required",
  );
  ensure(/^\d{6}$/.test(booking.pincode), "pincode must be 6 digits");
  checkCoordinates(booking.customer_latitude, booking.customer_longitude);
  ensure(
    typeof booking.is_credit === "boolean",
    "is_credit must be true or false",
  );
  const members = booking.additional_member ?? [];
  ensure(
    members.length <= MAX_ADDITIONAL_MEMBERS,
    `At most ${MAX_ADDITIONAL_MEMBERS} additional members can be added to one booking`,
  );
  members.forEach((member, index) => {
    checkName(
      member.customerName.trim(),
      `additional_member[${index}].customerName`,
    );
    checkAge(member.customerAge, `additional_member[${index}].customerAge`);
    toGender(
      member.customerGender,
      `additional_member[${index}].customerGender`,
    );
    checkPackageCodes(
      member.packageCode,
      `additional_member[${index}].packageCode`,
    );
  });

  const body = await redcliffe<RedcliffeCreatedBooking>(
    "POST",
    "/api/external/v2/center-create-booking/",
    {
      body: {
        ...booking,
        booking_date: todayInIndia(),
        customer_name: booking.customer_name.trim(),
        customer_gender: gender,
        customer_email: booking.customer_email.trim(),
        customer_altphonenumber: booking.customer_phonenumber,
        // doc conflict: the parameter table says customer_whatsappnumber, the example requests customer_whatsapppnumber (assumed table form; confirm)
        customer_whatsappnumber: booking.customer_phonenumber,
        additional_member: members.map((member) => ({
          ...member,
          customerName: member.customerName.trim(),
          customerGender: member.customerGender.toLowerCase(),
        })),
      },
    },
  );
  // "No Slots are available ... Try with another slot ID" comes back as status "Sucess" with no booking
  if (typeof body.booking_id !== "number")
    throw new RedcliffeError(
      body.message || "Redcliffe did not create the booking",
      200,
      body,
    );
  return body;
}

/**
 * POST /api/external/v2/center-confirm-booking/ : makes the temporary booking permanent (true, after
 * payment) or releases it (false). Doc conflict: its examples send "20009"/"true" as strings, its table
 * integer/boolean; we send real types so "false" can never read as truthy.
 */
export async function confirmBooking(
  bookingId: number,
  isConfirmed: boolean,
): Promise<RedcliffeConfirmation> {
  checkId(bookingId, "booking_id");
  return redcliffe<RedcliffeConfirmation>(
    "POST",
    "/api/external/v2/center-confirm-booking/",
    { body: { booking_id: bookingId, is_confirmed: isConfirmed } },
  );
}

/**
 * POST /api/external/v2/center-update-booking/ : reschedule (at most twice) or cancel a PERMANENT booking,
 * before a phlebo is assigned. Doc conflict: table says "remarks" and "Collection_date", examples "remark"
 * and "collection_date"; we send the example forms.
 */
export async function updateBooking(
  update: RedcliffeBookingUpdate,
): Promise<RedcliffeUpdatedBooking> {
  checkId(update.booking_id, "booking_id");
  ensure(update.remark.trim() !== "", "remark is required");
  if (update.booking_status === "rescheduled") {
    checkCollectionDate(update.collection_date);
    checkId(update.collection_slot, "collection_slot");
  } else
    ensure(
      update.booking_status === "cancelled",
      'booking_status must be "rescheduled" or "cancelled"',
    );
  return redcliffe<RedcliffeUpdatedBooking>(
    "POST",
    "/api/external/v2/center-update-booking/",
    { body: { ...update, remark: update.remark.trim() } },
  );
}

/**
 * GET /api/external/v2/center-get-booking?booking_id=&client_ref_id=&booking_status=&booking_date=&collection_date= :
 * bookings and their latest status. At least one filter is required: with none Redcliffe returns
 * every booking on inrange's account. (Note the filter is client_ref_id; create sends client_refid.)
 */
export async function getBookings(
  filters: RedcliffeBookingFilters,
): Promise<RedcliffeBooking[]> {
  const given = Object.entries(filters).filter(
    ([, value]) => value !== undefined,
  );
  ensure(given.length > 0, "Pass at least one filter to center-get-booking");
  if (filters.booking_id !== undefined)
    checkId(filters.booking_id, "booking_id");
  for (const name of ["booking_date", "collection_date"] as const) {
    const date = filters[name];
    if (date !== undefined)
      ensure(
        /^\d{4}-\d{2}-\d{2}$/.test(date),
        `${name} must be in format of YYYY-MM-DD`,
      );
  }
  const body = await redcliffe<{ data?: RedcliffeBooking[] }>(
    "GET",
    "/api/external/v2/center-get-booking",
    { query: filters },
  );
  return body.data ?? [];
}

/** GET /api/external/v2/booking-test-status/?booking_id= : test codes by state; "Booking is not synced yet." until the lab has the sample. */
export async function getBookingTestStatus(
  bookingId: number,
): Promise<RedcliffeTestStatus> {
  checkId(bookingId, "booking_id");
  const body = await redcliffe<{ data: RedcliffeTestStatus }>(
    "GET",
    "/api/external/v2/booking-test-status/",
    { query: { booking_id: bookingId } },
  );
  return body.data;
}

/** GET /api/external/v2/corporate-phlebo-tracking/?booking_id= : the assigned phlebo and the live tracking link. */
export async function getPhleboTracking(
  bookingId: number,
): Promise<RedcliffePhleboTracking> {
  checkId(bookingId, "booking_id");
  const body = await redcliffe<{ data: RedcliffePhleboTracking }>(
    "GET",
    "/api/external/v2/corporate-phlebo-tracking/",
    { query: { booking_id: bookingId } },
  );
  return body.data;
}

// ---------- reports ----------

/** GET /api/external/v2/get-consolidated-report/{bookingId} : the report PDF link (Report_url). Ask each time; links can expire. */
export async function getConsolidatedReport(
  bookingId: number,
): Promise<RedcliffeConsolidatedReport> {
  checkId(bookingId, "booking_id");
  return redcliffe<RedcliffeConsolidatedReport>(
    "GET",
    `/api/external/v2/get-consolidated-report/${bookingId}`,
  );
}

/** GET /api/external/v2/get-digital-report/{bookingId} : every test value with its reference range. */
export async function getDigitalReport(
  bookingId: number,
): Promise<RedcliffeDigitalReport[]> {
  checkId(bookingId, "booking_id");
  return redcliffe<RedcliffeDigitalReport[]>(
    "GET",
    `/api/external/v2/get-digital-report/${bookingId}`,
  );
}

// ---------- webhooks (set once per environment) ----------

/** POST /api/v1/webhook/create-update-webhook/ : registers inrange's webhook URL for the given triggers. */
export async function setWebhook(
  setup: RedcliffeWebhookSetup,
): Promise<{ status: string; message: string }> {
  ensure(/^https:\/\//.test(setup.url_link), "url_link must be an https URL");
  ensure(
    setup.hook_type_list.length > 0,
    "hook_type_list must name at least one trigger",
  );
  ensure(
    !setup.auth_key || !!setup.auth_value,
    "auth_value is required when auth_key is set",
  );
  return redcliffe<{ status: string; message: string }>(
    "POST",
    "/api/v1/webhook/create-update-webhook/",
    { body: setup },
  );
}

/** GET /api/v1/webhook/list-added-webhooks/ : the webhook URLs Redcliffe has for inrange. */
export async function listWebhooks(): Promise<RedcliffeWebhook[]> {
  const body = await redcliffe<{ results?: RedcliffeWebhook[] }>(
    "GET",
    "/api/v1/webhook/list-added-webhooks/",
  );
  return body.results ?? [];
}
