/**
 * Copies the visitor's rough IP location (Vercel's geo headers) into a short-lived cookie on the pages
 * that search for an address, so nearby places rank first. No prompt, no exact position: city level.
 */

import { NextResponse, type NextRequest } from "next/server";
import { ROUGH_LOCATION_COOKIE } from "@/lib/location/roughLocation";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const lat = request.headers.get("x-vercel-ip-latitude");
  const lon = request.headers.get("x-vercel-ip-longitude");
  if (lat && lon && !request.cookies.has(ROUGH_LOCATION_COOKIE))
    response.cookies.set(ROUGH_LOCATION_COOKIE, `${lat},${lon}`, {
      maxAge: 60 * 60 * 24,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  return response;
}

export const config = {
  matcher: ["/onboarding/:path*", "/patient-dashboard/lab-tests/:path*"],
};
