/*
  The doctor dashboard's waiting state (Arhaan's clinician .skeleton in ClinicShell): soft blocks
  shaped like a portal page that breathe while it loads, still under reduced motion. `titled={false}`
  drops the title block for a page that keeps its own head above the placeholders.
*/

import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";

export default function ClinicSkeleton({
  titled = true,
}: {
  titled?: boolean;
}) {
  return (
    <div
      className={clinicStyles.skeleton}
      data-titled={titled}
      aria-busy="true"
      aria-label="Loading"
    >
      {titled && <span style={{ width: "40%", height: 40 }} />}
      <span style={{ height: 220 }} />
      <span style={{ height: 320 }} />
    </div>
  );
}
