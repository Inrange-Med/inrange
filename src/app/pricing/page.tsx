/**
 * /pricing stays as a URL (the landing banner and menu link here), but the consultation and blood test
 * choice now lives in onboarding, with the real packages and prices. Signed-out visitors are sent to
 * sign in first by the onboarding screen itself.
 */
import { redirect } from "next/navigation";

export default function PricingPage() {
  redirect("/onboarding");
}
