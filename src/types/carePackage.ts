/**
 * What a new patient buys before their first consultation (GET /api/care-packages). Prices are set
 * by the backend and shown as sent. A package that includes lab tests names the Redcliffe package
 * it books, so its tests can be listed (labPackageCode -> GET /api/labs/packages/:code).
 */
export type CarePackage = {
  code: string;
  name: string;
  description: string;
  priceRupees: number;
  includesLabTests: boolean;
  labPackageCode: string | null;
  /** short lines shown on the card, for example "Video consultation with a doctor". The app drops any
   *  stated length ("30-minute"): consultations show no duration (client call, 12 Nov 2026). */
  includes: string[];
};
