/* /admin/team: everyone who signs in to work: the sales team, the coaches and the operations team. Admins only. */

import type { Metadata } from "next";
import TeamView from "./components/TeamView";

export const metadata: Metadata = { title: "Team | inrange" };

export default function TeamPage() {
  return <TeamView />;
}
