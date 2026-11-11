/** /terms: the pilot's terms of use. */
import type { Metadata } from "next";
import PilotLegalPage from "@/components/ui/PilotLegalPage";

export const metadata: Metadata = { title: "Terms of use | inrange" };

export default function TermsPage() {
  return (
    <PilotLegalPage
      title="Terms of use"
      intro="These terms cover the inrange pilot, which is open to invited people only."
      sections={[
        {
          heading: "Who can use it",
          body: [
            "Adults aged 18 or over, in India, who were invited to the pilot.",
          ],
        },
        {
          heading: "Not emergency care",
          body: [
            "inrange is not an emergency service. For chest pain, trouble breathing or any emergency, call 112 or go to the nearest hospital.",
          ],
        },
        {
          heading: "Your care",
          body: [
            "Consultations are by video with registered medical practitioners, under the Telemedicine Practice Guidelines 2020.",
            "Your doctor decides your plan. Medicine is prescribed only if your doctor judges it clinically appropriate, and not everyone is prescribed medication. Results vary from person to person.",
          ],
        },
        {
          heading: "Payments",
          body: [
            "You see an itemised price before you pay. During the pilot, some payments are test payments; the checkout says so when nothing is charged.",
            "Cancellations and refunds follow our cancellation and refund policy at inrangemed.com/refund.",
          ],
        },
        {
          heading: "Your account",
          body: [
            "You sign in with a code sent to your mobile. Keep your phone secure, and sign out on shared devices.",
          ],
        },
      ]}
    />
  );
}
