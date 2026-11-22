/** /grievance: how to raise a complaint during the pilot. */
import type { Metadata } from "next";
import PilotLegalPage from "@/components/ui/PilotLegalPage";

export const metadata: Metadata = { title: "Grievances | inrange" };

export default function GrievancePage() {
  return (
    <PilotLegalPage
      title="Grievances"
      intro="If you have a complaint about your care, your data or a payment, tell us and we will look into it."
      sections={[
        {
          heading: "How to raise a complaint",
          body: [
            "Message your care team in the app with your registered mobile number, what happened and when.",
          ],
        },
        {
          heading: "Grievance officer",
          body: [
            "The grievance officer's name and address are published here before public launch.",
          ],
        },
      ]}
    />
  );
}
