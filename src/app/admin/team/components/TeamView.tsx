"use client";

/*
  /admin/team: the people who sign in to work, added the way a doctor is (a name and a mobile number, which is
  their sign-in). Three lists:
    Sales team        ranked, 1 the best; each signs in to /sales and sees only the leads assigned to them
    Coaches           health, fitness or both; each signs in to /coach and sees only their patients
    Operations team   the blood test, consultations and pharmacy desks; each signs in to Operations and does
                      their desks' work
  Doctors are on their own page. One number is one person and one kind of sign-in.
*/

import PageHead from "@/components/ui/PageHead";
import CoachesSheet from "@/app/admin/medicine/components/CoachesSheet";
import SalesTeamSheet from "@/app/admin/medicine/components/SalesTeamSheet";
import OpsTeamPanel from "./OpsTeamPanel";
import adminStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

export default function TeamView() {
  return (
    <main className={adminStyles.page}>
      <PageHead
        className={adminStyles.pageHead}
        title="Team"
        sub="Each person signs in with their mobile number."
      />
      <div className={s.sheet}>
        <SalesTeamSheet inline onChanged={() => {}} />
        <CoachesSheet inline />
        <OpsTeamPanel />
      </div>
    </main>
  );
}
