/** /refund: the pilot's cancellation and refund policy (Razorpay's website review asks for one). */
import type { Metadata } from "next";
import PilotLegalPage from "@/components/ui/PilotLegalPage";

export const metadata: Metadata = {
  title: "Cancellation and refund policy | InRange",
};

export default function RefundPage() {
  return (
    <PilotLegalPage
      title="Cancellation and refund policy"
      intro="This policy covers every payment made on InRange: care plans, home blood tests and paid consultations. The free eligibility check and the free first consultation cost nothing, so there is nothing to refund."
      sections={[
        {
          heading: "Care plans",
          body: [
            "You pay for a plan only after your doctor has reviewed your eligibility, and you see an itemised price before you pay.",
            "Cancel before your plan starts and we refund the full amount. Your plan starts at your first plan consultation.",
            "After your plan starts, you can cancel at any time. We refund the months you have not started yet. The month you are in, and any medicine already dispensed, are not refunded.",
            "Medicine cannot be returned once it has been dispensed, for your safety and as the law requires.",
          ],
        },
        {
          heading: "Home blood tests",
          body: [
            "Cancel any time before the sample is collected and we refund the full amount.",
            "Once the sample is collected, the test is not refundable.",
            "If the lab cannot collect your sample or cannot produce your report, we refund the full amount or book a new visit, whichever you prefer.",
          ],
        },
        {
          heading: "Paid consultations",
          body: [
            "Cancel at least 2 hours before the consultation and we refund the full fee. You can also move it to another time at no charge.",
            "If you cancel within 2 hours of the start, or do not join, the fee is not refunded.",
            "If your doctor cannot attend, we refund the full fee or book another time, whichever you prefer.",
          ],
        },
        {
          heading: "Failed or duplicate payments",
          body: [
            "If money left your account but the payment did not complete, or you were charged twice, we refund the extra amount in full. You do not need to ask.",
          ],
        },
        {
          heading: "How to ask for a refund",
          body: [
            "Write to aamerjalan3@gmail.com from your registered email, or message your care team in the app. Include your registered mobile number and what the payment was for.",
            "We reply within 2 working days. Approved refunds go back to the card, UPI account or bank account you paid with, and usually arrive within 5 to 7 working days.",
          ],
        },
      ]}
    />
  );
}
