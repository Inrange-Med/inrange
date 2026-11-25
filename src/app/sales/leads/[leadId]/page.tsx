/* /sales/leads/[leadId]: one lead, on its own page (features/sales/LeadPage). */

import LeadPage from "@/features/sales/LeadPage";

export default async function SalesLeadPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  return <LeadPage leadId={leadId} />;
}
