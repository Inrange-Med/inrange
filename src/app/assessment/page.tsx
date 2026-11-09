/**
 * "Start free check" lands here (ASSESSMENT_URL). In the pilot the free check is the app's own
 * onboarding questions, which start right after sign-in, so this page sends people there.
 */
import { redirect } from "next/navigation";

export default function AssessmentPage() {
  redirect("/sign-in");
}
