/* /admin/medicine/leads/[leadId]: the same lead page a salesperson has, for an admin, who can also change the salesperson. */

import LeadPage from "@/features/sales/LeadPage";

export default async function AdminLeadPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  return <LeadPage leadId={leadId} admin />;
}
