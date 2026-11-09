# Home blood tests (Redcliffe Labs)

## Purpose

The home blood test booking: packages, address, a collection slot, the 30-minute hold, payment,
tracking and the report. The browser calls the InRange routes below; each route calls one function
in `src/server/redcliffe/redcliffeClient.ts` (server only, holds the key). Add the env vars, write
each route as 3 to 5 lines calling the client, and the lab booking is live.

- Screens: `src/features/lab-booking/` (onboarding and `/patient-dashboard/lab-tests/book`),
  `/patient-dashboard/lab-tests`, `/patient-dashboard/lab-tests/[bookingId]`, Reports.
- Services: `src/services/labTestService.ts`, `addressService.ts`. Types: `src/types/labTest.ts`,
  `address.ts` (the shapes the routes answer with).
- Source of truth for Redcliffe: Redcliffe API v2 doc. The client's names, paths and checks follow it.

## Endpoints

All need the patient's Bearer token; a booking or address that is not the caller's answers 404.
`id` in the Redcliffe column is the **partner** booking id stored on our row, never InRange's id.

| Method | Path | Status | Service function | Calls `redcliffeClient.` (Redcliffe endpoint) | Screen |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/address/my-addresses` | exists | `addressService.listMyAddresses` | none | address step |
| POST | `/api/address/add` | exists | `addressService.addAddress` | none | new address |
| DELETE | `/api/address/:addressId` | exists | `addressService.deleteAddress` | none | address step, Remove |
| GET | `/api/labs/packages` | PROPOSED | `listLabPackages` | `getPackageData()`, following `links.next` (`center-package-data/?search=`) | package step, onboarding care package |
| GET | `/api/labs/packages/:code` | PROPOSED | `getLabPackageTests` | `getPackageParameters(code)` (`package-parameter-data/?code=`) | "What is tested" |
| GET | `/api/labs/locations/search?query=&latitude=&longitude=` | PROPOSED | `searchLabLocations` | `searchLocations(query)` (`get-partner-location-2-eloc/?place_query=`) | new address: search (the point is optional, ranks nearby first) |
| GET | `/api/labs/locations/reverse?latitude&longitude` | PROPOSED | `findLabLocationAt` | none (pilot: Photon reverse) | new address: Use my current location |
| GET | `/api/labs/locations/:eloc` | PROPOSED | `getLabLocationCoordinates` | `getCoordinatesForEloc(eloc)` (`get-partner-loc-2-eloc/?eloc=`) | new address: pick a place |
| GET | `/api/labs/serviceability?latitude&longitude` | PROPOSED | `checkLabServiceability` | `checkServiceability(lat, lng)` (`is-location-serviceable/`) | address step |
| GET | `/api/labs/slots?date&addressId` | PROPOSED | `listLabSlots` | `listTimeSlots(date, address.latitude, address.longitude)` (`get-time-slot-list/`) | time step, "Change time" |
| POST | `/api/labs/bookings` | PROPOSED | `createLabBooking` | `createBooking(...)`; first `confirmBooking(oldId, false)` for an older unpaid hold (`center-create-booking/`) | review: "hold slot" |
| GET | `/api/labs/bookings` | PROPOSED | `listMyLabBookings` | none (database) | lab tests list, Home |
| GET | `/api/labs/bookings/:id` | PROPOSED | `getLabBooking` | `getBookings({ booking_id })`, `getPhleboTracking(id)`, `getBookingTestStatus(id)` | booking page, Home |
| POST | `/api/labs/bookings/:id/reschedule` | PROPOSED | `rescheduleLabBooking` | `updateBooking({ booking_status: "rescheduled", ... })` (`center-update-booking/`) | "Change time" |
| POST | `/api/labs/bookings/:id/cancel` | PROPOSED | `cancelLabBooking` | `updateBooking({ booking_status: "cancelled", ... })`; still unpaid: `confirmBooking(id, false)` | "Cancel" |
| GET | `/api/labs/bookings/:id/report` | PROPOSED | `getLabReportUrl` | `getConsolidatedReport(id)` -> `{ url: Report_url }` (`get-consolidated-report/{id}`) | booking page, Reports |
| POST | `/api/payments/verify` (purpose `LAB_BOOKING`) | PROPOSED | `paymentService.verifyPayment` | `confirmBooking(partnerId, true)` (`center-confirm-booking/`) | checkout |
| POST | `/api/webhooks/redcliffe` | PROPOSED | none (Redcliffe calls it) | none | none |
| one-off setup script | | | none | `setWebhook(...)`, `listWebhooks()` | none |


### Saved addresses (the team's contract, 28 Oct 2026)

The app follows the team's `/api/address` contract exactly: `POST /api/address/add` with
`{ addressLine, city, state, pincode, latitude, longitude, isPrimary }` (addressLine and pincode
required; `isPrimary` replaces the old primary) answering `201 { data: { addressId } }`;
`GET /api/address/my-addresses` answering `AddressId, AddressLine, City, State, Pincode, Latitude,
Longitude, IsPrimary`; `DELETE /api/address/:addressId`.

**One field to add: `landmark`.** Redcliffe's create booking requires `customer_landmark`, so the
app also sends `landmark` on add and reads `Landmark` from the list. Please store it (column
`Landmark`, string) and return it. Until then a saved address comes back without it, the address step
shows "Add a landmark to this address. The lab needs one." and that address cannot be booked. Also: `my-addresses` answered 404 on https://mediapi.unios.in on 28 Oct 2026, so
deploy these routes to the hosted backend.

## Requests and responses

A route, end to end:

```ts
// GET /api/labs/slots?date=2026-10-30&addressId=12
const address = await findOwnedAddress(user.id, Number(query.addressId)); // 404 if not theirs
const slots = await listTimeSlots(query.date, address.latitude, address.longitude);
return { success: true, data: slots.map((s) => ({ slotId: s.id, startTime: s.format_24_hrs.start_time, endTime: s.format_24_hrs.end_time, available: s.available_slot })) };
```

Errors, once for every route: `catch (e) { if (e instanceof RedcliffeError) return status(e.httpStatus === null ? 422 : 502, { success: false, message: e.message }) }`.
`httpStatus === null` means the client refused bad input before sending (the message names the
field). Log `e.body` for the rest; the key is never in it.

What each route answers (shapes in `src/types/labTest.ts`, in `{ success, message, data }`):

- **packages**: `LabPackage[]`, only codes InRange enabled. `testCount` <- `parameters`, `fastingNote` <- `fasting_time`, `reportTime` <- `tat_time`, `forGender` <- `recommended_gender`, `ageRange` <- `recommended_age` "5-99", `price` <- `package_center_prices.offer_price`, `listPrice` <- `.package_price`.
- **packages/:code**: `{ code, name, groups: [{ name: data[].name, tests: data[].package_detail[].name }] }`.
- **locations/search**: `LabPlaceMatch[]` from `results[]` (`name` <- `placeName`, `address` <- `placeAddress`, city/state/pincode <- `address.*`). The client trims `eloc` and turns "No record(s) found" into `[]`.
- **locations/:eloc**: `{ latitude, longitude }`.
- **Pilot (Redcliffe key not set)**: search and reverse use Photon (OpenStreetMap, India only), so real addresses work; each place gets a 6-character `eloc` cached in `place_cache` for `locations/:eloc`. `latitude`/`longitude` on search come from the visitor's rough IP location (the `inrange_geo` cookie set by `src/proxy.ts` from Vercel's geo headers). With the key set, search is Redcliffe's and `reverse` answers 404.
- **serviceability**: `{ serviceable, message }`, exactly what the client returns.
- **slots**: a flat list `[{ slotId, startTime, endTime, available }]` (above). The app groups them.
- **bookings** (every booking route): `LabBooking`. From `createBooking`: `partnerBookingId` <- `booking_id`, `packageName` <- `packages[0].name`, `price.packagePrice` <- `discounted_price.total_price_package`, `price.total` <- `final_total_price` (what checkout charges), `holdExpiresAt` <- now + 30 min. From `getBookings`: `collector` <- `phlebo_detail`; `getPhleboTracking` -> `collector.trackingUrl` <- `tracking_link`; `getBookingTestStatus` -> `tests[]` (`pending_tests` PENDING, `completed_tests` COMPLETED, `rejected_tests` REJECTED, `dismissed_tests` DISMISSED; "Booking is not synced yet." means `tests: []`).
- **report**: `{ url }`, a fresh link each time (Redcliffe's links expire).

`POST /api/labs/bookings` body: `{ packageCode, addressId, collectionDate, slotId, patient: { name, age, gender, mobile, email }, carePackageCode? }`.
The service already refuses dates outside today..+4, a bad slot id and a patient Redcliffe would
refuse. Reschedule body: `{ collectionDate, slotId }`. Cancel body: `{ reason }`.

```ts
createBooking({
  collection_date: body.collectionDate, collection_slot: Number(body.slotId), package_code: [body.packageCode],
  customer_name: p.name, customer_age: p.age, customer_gender: p.gender, customer_email: p.email, customer_phonenumber: p.mobile,
  customer_address: address.addressLine, address_line2: `${address.city}, ${address.state}`, customer_landmark: address.landmark,
  pincode: address.pincode, customer_latitude: address.latitude, customer_longitude: address.longitude,
  is_credit: true, client_refid: row.id, reference_data: row.id,
});
```

`is_credit: true`: InRange collects the money, Redcliffe collects nothing at the door. The client
adds `booking_date` (today, IST), `customer_altphonenumber` and `customer_whatsappnumber` (= mobile).
With `carePackageCode` the price is the care package's (backend table), and the consultation is
marked paid when the payment verifies.

## Notes

### Booking state machine

1. `POST /api/labs/bookings` -> Redcliffe **temporary** booking, slot locked **30 min**. Row `PAYMENT_PENDING`, `hold_expires_at` = now + 30 min. Eligibility `AWAITING_PAYMENT`.
2. Checkout `purpose=LAB_BOOKING&referenceId=<row id>`: the order refuses (409) if the hold has under 2 min left. On verify: `confirmBooking(partnerId, true)` -> `BOOKED`, eligibility `LAB_SCHEDULED`.
3. Hold expired before payment ("Temporary booking id has been expired and cancelled."): `createBooking` again with the same slot and confirm; if that fails, `EXPIRED` and refund in full. Never leave a paid row without a Redcliffe booking. Unpaid rows past `hold_expires_at` become `EXPIRED`.
4. Webhooks (`POST /api/webhooks/redcliffe`, find the row by `data.client_refid`, else `data.booking_id`; store the raw body; never move a row backwards): `phleboassigned` -> `COLLECTOR_ASSIGNED` (reschedule and cancel now blocked); `phlebo_started_journey`/`phlebo_end_journey` -> refresh tracking; `pickup` -> `SAMPLE_COLLECTED` (eligibility `SAMPLE_COLLECTED`); `resample` -> `BOOKED`; `samplesync`/`partialreport` -> `PROCESSING`; `rescheduled` -> new date/slot; `cancelled` -> `CANCELLED`.
5. `consolidatereport` -> `REPORT_READY`; store `Report_url`; add a `reports` row (`source: LAB_BOOKING`). For a care-package booking the row has `purpose: ELIGIBILITY`, `reviewStatus: UNDER_REVIEW`, and eligibility moves to `UNDER_REVIEW` (the back office then approves or not; reports.md). `reportvalues` -> store the values (`getDigitalReport` reads them on demand; the app shows no values yet).
6. Reschedule: at most 2, only while `BOOKED` (`reschedulesLeft` = 2 - count). Cancel a confirmed booking: only while `BOOKED`; Redcliffe charges for it.

Register the webhook once per environment with `setWebhook({ url_link: "https://<backend>/api/webhooks/redcliffe", hook_type_list: [...the triggers above, "booking_created", "pickup_hold"], auth_key: "x-redcliffe-secret", auth_value: REDCLIFFE_WEBHOOK_SECRET })`; the handler answers 401 on a wrong secret. On staging, `mock-b2b-webhook/` fires test events in order phleboassigned, pickup, samplesync, consolidatereport, reportvalues (not wrapped; call it by hand).

### Env vars (backend server only, never `NEXT_PUBLIC_`)

| Var | Value |
| --- | --- |
| `REDCLIFFE_BASE_URL` | `https://api.redcliffelabs.com` in production; the staging host from Redcliffe onboarding (the doc shows `apiqa.` and `apidev.redcliffelabs.com`) |
| `REDCLIFFE_API_KEY` | sent as the `key` header on every call |
| `REDCLIFFE_WEBHOOK_SECRET` | the `auth_value` Redcliffe sends back on every webhook |

Check the client without a network: `node --no-warnings --conditions=react-server src/server/redcliffe/redcliffeClient.check.mjs`.

### Redcliffe doc conflicts to confirm

What the client sends today is in bold.

1. WhatsApp field: table `customer_whatsappnumber`, every example `customer_whatsapppnumber`. **Table form** (assumed, confirm with Redcliffe).
2. Update booking: table `remarks`, examples `remark`. **`remark`**.
3. Capitalised table names (`Booking_date`, `Collection_slot`, `Collection_date`, `Customer_age`, `Address_line2`) vs lower case in examples. **Lower case**.
4. `collection_date` is missing from the create-booking table but in every example. **Sent**.
5. Gender: table `Male`/`Female`, examples `male`. **Lower case**.
6. Email: table and examples 1 and 4 `customer_email`, example 2 `email`. **`customer_email`**.
7. Our reference id: example 1 `Client_refid` (broken JSON), responses `client_refid`, get-booking filter `client_ref_id`. **`client_refid` on create, `client_ref_id` to filter**.
8. Add-on members: create example uses `customerName`/`customerAge`/`customerGender`/`packageCode`, open-add-member uses `customer_name`/.../`packages`. **camelCase** (we book one person, so unused today).
9. Types: confirm-booking examples send `"20009"` and `"true"` as strings, the table integer/boolean; create example 2 sends age and coordinates as strings. **Real numbers and booleans** (so `"false"` can never read as true).
10. Slot list: `results` in the example, `data` in the table; slot id `id` in the example, `slot_id` in the table. **Read `results`, else `data`; `id`**.
11. Booking window: "current date + within next 4 days" vs the error "collection_date must be future date from Current date". Is today bookable, and is today + 4 included? **Client allows today..today+4; the app offers today..today+3**.
12. Create with a full slot answers `"status": "Sucess"` with an error message and no booking. **Treated as a failure**.
13. `center-get-booking` with no filter returns every booking on the account. **Client refuses a call with no filter**.
14. Undocumented codes: the `booking_status` integer filter, and webhook `booking_status` values such as `"5"` and `"14"`. Ask for the list.
15. `customer_type` and `booking_type`: required or not is unclear. **Neither sent** (`booking_type` defaults to Homedx).
16. Name "alphabetical only": spaces assumed allowed (examples use "Sachin Sharma"). **Letters and spaces, 3 to 30**.
17. Package APIs work on production only, so staging cannot test the package steps.

### Lab plans on /pricing (decision needed)

`/pricing` sells `plan-lab-basic` and `plan-lab-doctor-combo` through checkout `purpose=PLAN`. If kept,
the backend prices them from its own table and on payment stores a credit naming the Redcliffe
package code(s) it covers; `/api/labs/packages` then sets `coveredByPlan: true`, and
`POST /api/labs/bookings` calls `confirmBooking(id, true)` at once (`paymentRequired: false`).

### Tables (suggested)

- `lab_bookings`: id, patient_id, partner_booking_id, status, package_code, package_name, care_package_code, address_id, collection_date, slot_id, slot_start, slot_end, patient_name, patient_age, patient_gender, patient_mobile, patient_email, package_price, discount, collection_charge, total, hold_expires_at, reschedule_count, collector_name, collector_phone, tracking_url, report_url, created_at, updated_at.
- `lab_booking_events`: id, lab_booking_id, webhook_type, payload (JSON), received_at.
- `lab_packages_enabled`: code (the allow-list for `/api/labs/packages`).
