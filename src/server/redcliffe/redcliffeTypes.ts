/**
 * Redcliffe Labs API v2 shapes, named exactly as Redcliffe names them (snake_case, its own spellings).
 * Inputs are what redcliffeClient.ts sends; responses are the fields the doc's examples show (the
 * backend maps them to inrange's shapes in src/types/labTest.ts). Type-only: no runtime code here.
 */

export type RedcliffeGender = "male" | "female";

/** GET get-partner-location-2-eloc: one place match. `eloc` arrives padded with spaces. */
export type RedcliffePlace = {
  type: string;
  eloc: string;
  placeName: string;
  placeAddress: string;
  address: {
    houseNumber: string;
    houseName: string;
    poi: string;
    street: string;
    subSubLocality: string;
    subLocality: string;
    locality: string;
    village: string;
    subDistrict: string;
    district: string;
    city: string;
    state: string;
    pincode: string;
  };
};

export type RedcliffeCoordinates = { latitude: number; longitude: number };

/** GET is-location-serviceable: a non-serviceable place is an answer, not an error. */
export type RedcliffeServiceability = { serviceable: boolean; message: string };

/** GET get-time-slot-list: one one-hour window. available_slot 0 means the slot is full or inactive. */
export type RedcliffeSlot = {
  id: number;
  available_slot: number;
  format_24_hrs: { start_time: string; end_time: string };
  format_12_hrs: { start_time: string; end_time: string };
};

/** GET center-package-data: one page (20 a page; follow links.next). */
export type RedcliffePackagePage = {
  status: string;
  links: { next: string | null; previous: string | null };
  count: number;
  page_size: number;
  data: {
    name: string;
    description: string;
    recommended_gender: string;
    recommended_age: string;
    tat_time: string;
    fasting_time: string;
    code: string;
    parameters: number;
    package_center_prices: { package_price: number; offer_price: number };
    type: string;
  }[];
};

/** GET package-parameter-data: the test groups in one package. */
export type RedcliffePackageParameters = {
  status: string;
  code: string;
  name: string;
  data: { name: string; package_detail: { name: string }[] }[];
};

/** An add-on member inside center-create-booking (camelCase, as in the doc's example request 2). */
export type RedcliffeAdditionalMember = {
  customerName: string;
  customerAge: number;
  customerGender: RedcliffeGender;
  packageCode: string[];
};

/** What the backend passes to createBooking. booking_date is set by the client (today, IST). */
export type RedcliffeNewBooking = {
  collection_date: string;
  collection_slot: number;
  package_code: string[];
  customer_name: string;
  customer_age: number;
  customer_gender: RedcliffeGender | "Male" | "Female";
  customer_email: string;
  customer_phonenumber: string;
  customer_address: string;
  address_line2?: string;
  customer_landmark: string;
  pincode: string;
  customer_latitude: number;
  customer_longitude: number;
  /** true: inrange collects the payment (prepaid); false: Redcliffe collects cash (COD) */
  is_credit: boolean;
  /** inrange's own booking id: webhooks and center-get-booking find the booking by it */
  client_refid?: string;
  reference_data?: string;
  center_discount?: number;
  additional_member?: RedcliffeAdditionalMember[];
};

/** POST center-create-booking success: a temporary booking, slot locked for 30 minutes. */
export type RedcliffeCreatedBooking = {
  status: string;
  message: string;
  pk: number;
  booking_id: number;
  booking_type: string;
  booking_date: string;
  collection_date: string;
  collection_slot: number;
  packages: {
    id: number;
    name: string;
    code: string;
    package_price: number;
    offer_price: number;
    is_addon: boolean;
    description: string;
  }[];
  discounted_price: {
    total_price_package: number;
    counpon_discount: number;
    final_total_price: number;
    phlebo_cost: number;
    subscription_amount: number;
    subscription_discount_amount: number;
    referral_coupon_discount: number;
    coupon_type: string;
    hard_copy_cost: number;
  };
  booking_status: string;
  pickup_status: string;
  slot_time: { id: number; slot: string };
  is_credit: boolean;
  client_refid: string | null;
  reference_data: string | null;
};

/** POST center-confirm-booking success. booking_id and payment_detail appear only in some cases. */
export type RedcliffeConfirmation = {
  status: string;
  message: string;
  booking_id?: number;
  booking_status?: string;
  payment_detail?: { is_credit: boolean; amount_collected: number };
};

/** POST center-update-booking body: reschedule (new date and slot) or cancel. */
export type RedcliffeBookingUpdate =
  | {
      booking_id: number;
      booking_status: "rescheduled";
      remark: string;
      collection_date: string;
      collection_slot: number;
    }
  | { booking_id: number; booking_status: "cancelled"; remark: string };

export type RedcliffeUpdatedBooking = {
  status: string;
  message: string;
  booking_id: number;
  booking_status: "rescheduled" | "cancelled";
  details: { collection_date: string; collection_slot: string };
};

/** GET center-get-booking filters. At least one is required (with none, Redcliffe returns every booking). */
export type RedcliffeBookingFilters = {
  booking_id?: number;
  client_ref_id?: string;
  booking_status?: number;
  booking_date?: string;
  collection_date?: string;
};

export type RedcliffeReportParameter = {
  name: string;
  type: string;
  unit: string;
  value: string;
  refernce_range: Record<string, string>;
};

/** GET center-get-booking: one booking (data[] holds these). */
export type RedcliffeBooking = {
  booking_id: number;
  booking_date: string;
  collection_date: string;
  collection_slot: number;
  collection_time: { slot_12_hrs: string; slot_24_hrs: string };
  booking_status: { id: number; value: string };
  customer_phone: number;
  address: string;
  client_ref_id: string;
  landmark: string;
  patient_detail: {
    patient_id: number;
    customer_name: string;
    age: number;
    gender: string;
    package: {
      code: string;
      name: string;
      package_price: string;
      offer_price: string;
    }[];
  }[];
  payment_detail: {
    is_credit: boolean;
    pickup_charge: string;
    final_price: string;
  };
  phlebo_detail: { name: string; contact: string } | null;
  report: {
    patient_id: number;
    status: string;
    report_link: string;
    test: { id: number; name: string; parameter: RedcliffeReportParameter[] }[];
  }[];
};

/** GET booking-test-status: test codes by state (only after the sample is synced). */
export type RedcliffeTestStatus = {
  booking_id: string;
  pending_tests: string[];
  dismissed_tests: string[];
  completed_tests: string[];
  rejected_tests: string[];
  total_tests: string[];
};

/** GET corporate-phlebo-tracking. */
export type RedcliffePhleboTracking = {
  id: number;
  customer_name: string;
  collection_date: string;
  phlebo_user_fullname: string | null;
  center__name: string;
  collection_slot: string;
  tracking_link: string;
  parent_booking: { parent_booking_id: number | null };
};

/** GET get-consolidated-report. Note the capital R in Report_url. */
export type RedcliffeConsolidatedReport = {
  id: number;
  name: string;
  phonenumber: string;
  client_refid: string;
  Report_url: string;
  timestamp: string;
  booking_type: string;
  customer_email: string;
  reference_data: string | null;
};

/** GET get-digital-report: one entry per package, with its parameter values. */
export type RedcliffeDigitalReport = {
  _id: string;
  booking_id: number;
  customer_name: string;
  collection_date: string;
  booking_date: string;
  package: { id: number; name: string; code: string };
  test_code: string;
  test_name: string;
  barcode: string;
  test_values: {
    id: string;
    test_parameter: {
      id: number;
      name: string;
      unit: string;
      lower_bound_female: string;
      lower_bound_male: string;
      upper_bound_male: string;
      upper_bound_female: string;
      reference_range_female: string;
      reference_range_male: string;
    };
    test_method: string;
    value: string;
    is_highlighted: boolean;
  }[];
};

/** Every webhook trigger in the doc (create-update-webhook hook_type_list). */
export type RedcliffeWebhookType =
  | "rescheduled"
  | "booking_created"
  | "cancelled"
  | "phleboassigned"
  | "pickup"
  | "resample"
  | "samplesync"
  | "consolidatereport"
  | "reportvalues"
  | "partialreport"
  | "tubescan"
  | "ppmc_report"
  | "phlebo_started_journey"
  | "phlebo_end_journey"
  | "pickup_hold"
  | "imaging_voucher_update"
  | "imaging_consolidated_report"
  | "imaging_booking_canceled"
  | "imaging_booking_rescheduled"
  | "imaging_booking_reached"
  | "imaging_booking_created";

/** POST create-update-webhook body. auth_value is required when auth_key is set. */
export type RedcliffeWebhookSetup = {
  url_link: string;
  hook_type_list: RedcliffeWebhookType[];
  auth_key?: string;
  auth_value?: string;
};

export type RedcliffeWebhook = {
  id: number;
  hook_type_data: {
    id: number;
    name: string;
    order: number;
    description: string;
  };
  created_at: string;
  updated_at: string;
  url_link: string;
  webhook_auth_key: string | null;
  webhook_auth_value: string | null;
  center: number;
  hook_type: number;
};

/** What Redcliffe POSTs to inrange's webhook URL. */
export type RedcliffeWebhookEvent = {
  webhook_type: RedcliffeWebhookType;
  data: {
    booking_id: number;
    type: string;
    client_refid: string | null;
    data: Record<string, unknown>;
  };
};
