/* /patient-dashboard/profile: who the patient is, their plan and settings. ProfileView loads and saves. */

import type { Metadata } from "next";
import ProfileView from "./components/ProfileView";

export const metadata: Metadata = { title: "Profile | InRange" };

export default function ProfilePage() {
  return <ProfileView />;
}
