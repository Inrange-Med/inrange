/**
 * The visitor's rough location, from their IP: src/proxy.ts copies Vercel's geo headers into the
 * `inrange_geo` cookie ("lat,lon"). Used only to rank nearby addresses first; null when unknown.
 */

import type { LabCoordinates } from "@/types/labTest";

export const ROUGH_LOCATION_COOKIE = "inrange_geo";

export function roughLocation(): LabCoordinates | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${ROUGH_LOCATION_COOKIE}=`))
    ?.slice(ROUGH_LOCATION_COOKIE.length + 1);
  const [latitude, longitude] = decodeURIComponent(raw ?? "")
    .split(",")
    .map(Number);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && raw
    ? { latitude, longitude }
    : null;
}
