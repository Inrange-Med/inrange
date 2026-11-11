/**
 * Home blood tests through Redcliffe Labs. The inrange backend calls Redcliffe (it holds the secret
 * key); each route below names the Redcliffe call behind it. Doc: docs/backend/lab-tests-redcliffe.md
 *   GET  /api/labs/packages                           PROPOSED. Bookable packages (center-package-data)
 *   GET  /api/labs/packages/:code                     PROPOSED. What a package tests (package-parameter-data)
 *   GET  /api/labs/locations/search?query=&latitude=&longitude=  PROPOSED. Area search, nearby first (get-partner-location-2-eloc)
 *   GET  /api/labs/locations/reverse?latitude&longitude          PROPOSED. The place at a point ("Use my current location")
 *   GET  /api/labs/locations/:eloc                    PROPOSED. A place's coordinates (get-partner-loc-2-eloc)
 *   GET  /api/labs/serviceability?latitude&longitude  PROPOSED. Whether collectors reach a point (is-location-serviceable)
 *   GET  /api/labs/slots?date&addressId               PROPOSED. Collection windows on a day (get-time-slot-list)
 *   POST /api/labs/bookings                           PROPOSED. Holds a slot for 30 minutes (center-create-booking)
 *   GET  /api/labs/bookings                           PROPOSED. The patient's bookings (inrange database)
 *   GET  /api/labs/bookings/:id                       PROPOSED. One booking (center-get-booking, booking-test-status, corporate-phlebo-tracking)
 *   POST /api/labs/bookings/:id/reschedule            PROPOSED. Moves it (center-update-booking, rescheduled)
 *   POST /api/labs/bookings/:id/cancel                PROPOSED. Cancels it (center-update-booking, cancelled)
 * Redcliffe's limits are checked before any call (labPatientProblem from lib/validation/labBookingRules,
 * the 4-day window), so a screen gets a plain sentence instead of a failed booking at the last step.
 */

import {
  ApiError,
  apiRequest,
  listFrom,
  nullWhenMissing,
} from "@/lib/http/apiClient";
import { combineDateAndTime, toApiDate } from "@/lib/format/dateTime";
import { labPatientProblem } from "@/lib/validation/labBookingRules";
import type {
  LabBooking,
  LabCoordinates,
  LabPackage,
  LabPackageTests,
  LabPlaceMatch,
  LabServiceability,
  LabSlot,
  NewLabBooking,
} from "@/types/labTest";

type RequestOptions = Parameters<typeof apiRequest>[1];
type RawLabBooking = Omit<LabBooking, "id" | "partnerBookingId"> & {
  id: number | string;
  partnerBookingId: number | string | null;
};
type RawSlot = {
  slotId: number | string;
  startTime: string;
  endTime: string;
  available: number;
};

/** Redcliffe books collections from today to today + 4 days. */
const LAB_DAYS_AHEAD = 4;

/** A backend without the endpoint answers 404 with an HTML page; say it in words instead. */
async function labRequest<T>(
  path: string,
  options?: RequestOptions,
): Promise<T> {
  try {
    return await apiRequest<T>(path, options);
  } catch (caught) {
    if (
      caught instanceof ApiError &&
      caught.isMissingEndpoint &&
      (caught.body === null || typeof caught.body !== "object")
    ) {
      throw new ApiError(
        "Home blood tests are not available yet.",
        404,
        caught.body,
      );
    }
    throw caught;
  }
}

const toLabBooking = (raw: RawLabBooking): LabBooking => ({
  ...raw,
  id: String(raw.id),
  partnerBookingId:
    raw.partnerBookingId === null ? null : String(raw.partnerBookingId),
  collector: raw.collector ?? null,
  reportFile: raw.reportFile ?? null,
  tests: raw.tests ?? [],
});

function labDateProblem(date: string) {
  const today = new Date();
  const lastDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + LAB_DAYS_AHEAD,
  );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Choose a collection day.";
  if (date < toApiDate(today) || date > toApiDate(lastDay))
    return `The lab collects from today up to ${LAB_DAYS_AHEAD} days ahead. Choose another day.`;
  return null;
}

function slotProblem(slotId: string) {
  return /^\d+$/.test(slotId) ? null : "Choose a collection time.";
}

/** Throws the first problem as an Error (screens show it with errorMessage). */
function refuse(...problems: (string | null)[]) {
  const problem = problems.find(Boolean);
  if (problem) throw new Error(problem);
}

export async function listLabPackages(): Promise<LabPackage[] | null> {
  return nullWhenMissing(() =>
    labRequest("/api/labs/packages").then((body) => listFrom<LabPackage>(body)),
  );
}

export async function getLabPackageTests(
  code: string,
): Promise<LabPackageTests> {
  const body = await labRequest<{ data: LabPackageTests }>(
    `/api/labs/packages/${encodeURIComponent(code)}`,
  );
  return body.data;
}

/** `near` ranks places around that point first (the visitor's rough location); `signal` drops a stale search. */
export async function searchLabLocations(
  query: string,
  near?: LabCoordinates | null,
  signal?: AbortSignal,
): Promise<LabPlaceMatch[]> {
  const body = await labRequest("/api/labs/locations/search", {
    query: { query, latitude: near?.latitude, longitude: near?.longitude },
    signal,
  });
  return listFrom<LabPlaceMatch>(body);
}

/** The place at a point, for "Use my current location". */
export async function findLabLocationAt(
  point: LabCoordinates,
): Promise<LabPlaceMatch> {
  const body = await labRequest<{ data: LabPlaceMatch }>(
    "/api/labs/locations/reverse",
    { query: point },
  );
  return body.data;
}

export async function getLabLocationCoordinates(
  eloc: string,
): Promise<LabCoordinates> {
  const body = await labRequest<{ data: LabCoordinates }>(
    `/api/labs/locations/${encodeURIComponent(eloc)}`,
  );
  return body.data;
}

export async function checkLabServiceability(
  point: LabCoordinates,
): Promise<LabServiceability> {
  const body = await labRequest<{ data: LabServiceability }>(
    "/api/labs/serviceability",
    { query: point },
  );
  return body.data;
}

/** The open collection windows on one day at a saved address. `date` is "YYYY-MM-DD", today to today + 4. */
export async function listLabSlots(
  date: string,
  addressId: number,
): Promise<LabSlot[]> {
  refuse(labDateProblem(date));
  const body = await labRequest<{
    data: RawSlot[] | Record<string, RawSlot[]>;
  }>("/api/labs/slots", { query: { date, addressId } });
  // the documented answer is a flat list; the older grouped one ({ morning, afternoon, evening }) still reads
  const slots = Array.isArray(body.data)
    ? body.data
    : Object.values(body.data ?? {}).flat();
  return slots.map((slot) => ({
    id: String(slot.slotId),
    startsAt: combineDateAndTime(date, slot.startTime),
    endsAt: combineDateAndTime(date, slot.endTime),
    open: slot.available > 0,
  }));
}

/** Holds the slot for 30 minutes. Pay within that time (or it is confirmed at once when a plan covers it). */
export async function createLabBooking(
  booking: NewLabBooking,
): Promise<LabBooking> {
  refuse(
    labDateProblem(booking.collectionDate),
    slotProblem(booking.slotId),
    labPatientProblem(booking.patient),
  );
  const body = await labRequest<{ data: RawLabBooking }>("/api/labs/bookings", {
    method: "POST",
    body: booking,
  });
  return toLabBooking(body.data);
}

export async function listMyLabBookings(): Promise<LabBooking[] | null> {
  return nullWhenMissing(() =>
    labRequest("/api/labs/bookings").then((body) =>
      listFrom<RawLabBooking>(body).map(toLabBooking),
    ),
  );
}

export async function getLabBooking(
  bookingId: string,
): Promise<LabBooking | null> {
  return nullWhenMissing(() =>
    labRequest<{ data: RawLabBooking }>(
      `/api/labs/bookings/${encodeURIComponent(bookingId)}`,
    ).then((body) => toLabBooking(body.data)),
  );
}

export async function rescheduleLabBooking(
  bookingId: string,
  collectionDate: string,
  slotId: string,
): Promise<LabBooking> {
  refuse(labDateProblem(collectionDate), slotProblem(slotId));
  const body = await labRequest<{ data: RawLabBooking }>(
    `/api/labs/bookings/${encodeURIComponent(bookingId)}/reschedule`,
    {
      method: "POST",
      body: { collectionDate, slotId },
    },
  );
  return toLabBooking(body.data);
}

export async function cancelLabBooking(
  bookingId: string,
  reason: string,
): Promise<LabBooking> {
  const body = await labRequest<{ data: RawLabBooking }>(
    `/api/labs/bookings/${encodeURIComponent(bookingId)}/cancel`,
    { method: "POST", body: { reason } },
  );
  return toLabBooking(body.data);
}

/** A fresh link to the lab's PDF (Redcliffe's links can expire, so ask each time). */
