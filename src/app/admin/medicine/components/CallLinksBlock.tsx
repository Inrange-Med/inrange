"use client";

/*
  A consultation's video links, for admin to send by any means (23 Nov 2026 call): one for the patient, one
  for the doctor, and one for the patient's salesperson, who joins after the doctor. Asking for them makes
  the room if nobody has opened it yet. The links work until the doctor ends the call, so they go only to the
  person each one is for. The doctor still ends the call from their own dashboard, so the prescription follows.
*/

import ErrorNotice from "@/components/ui/ErrorNotice";
import CopyLine from "@/features/payment-links/CopyLine";
import { useApiResource } from "@/hooks/useApiResource";
import { getCallLinks } from "@/services/medicineOpsService";
import adminStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

export default function CallLinksBlock({
  consultationId,
  patientName,
  doctorName,
}: {
  consultationId: string;
  patientName: string;
  doctorName: string;
}) {
  const links = useApiResource(`call-links-${consultationId}`, () =>
    getCallLinks(consultationId),
  );
  if (links.error && !links.data)
    return <ErrorNotice message={links.error} onRetry={links.reload} />;
  if (!links.data)
    return <span className={adminStyles.muted}>Getting the links</span>;
  return (
    <div className={s.planForm}>
      <CopyLine label={patientName} value={links.data.patient} />
      <CopyLine label={doctorName} value={links.data.doctor} />
      {links.data.sales ? (
        <CopyLine
          label={`${links.data.salesName} (sales)`}
          value={links.data.sales}
        />
      ) : (
        <span className={adminStyles.muted}>
          No salesperson on this patient, so no third link.
        </span>
      )}
      <span className={adminStyles.muted}>
        Each link lets its holder into the call until the doctor ends it. Send
        each one only to the person it is for.
      </span>
    </div>
  );
}
