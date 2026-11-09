/** /privacy: the pilot's privacy notice, describing what this build stores and who sees it. */
import type { Metadata } from "next";
import PilotLegalPage from "@/components/ui/PilotLegalPage";

export const metadata: Metadata = { title: "Privacy notice | InRange" };

export default function PrivacyPage() {
  return (
    <PilotLegalPage
      title="Privacy notice"
      intro="InRange is a doctor-led programme for weight and type 2 diabetes. This notice says what the pilot stores about you, where it is kept and who can see it."
      sections={[
        {
          heading: "What we keep",
          body: [
            "Your mobile number, and the answers you give when you join: name, email, gender, age, height, weight, health conditions and what you have tried before.",
            "The consents you give, with the date of each, and any you later withdraw.",
            "Weights you log, reports you upload and results from home blood tests.",
            "What your doctor writes after a consultation: notes, prescriptions and plan suggestions. Messages between you and your care team.",
            "Payment records: what was paid, when and the invoice number. Card and bank details go to the payment provider and never reach us.",
          ],
        },
        {
          heading: "Where it is kept",
          body: [
            "In India, in a database and private file store in Mumbai. Data is encrypted in transit and at rest.",
            "Files such as reports and prescriptions open only through links that expire within minutes.",
          ],
        },
        {
          heading: "Who sees it",
          body: [
            "You, and the doctor caring for you. Every time a doctor opens or changes your record, it is logged.",
            "When you book a home blood test, the partner lab receives what it needs to collect the sample: name, age, gender, mobile, email and address.",
            "When you pay, the payment provider receives the amount and your mobile number.",
          ],
        },
        {
          heading: "Call transcription",
          body: [
            "An AI scribe that drafts notes from video calls is optional, and only used if you agree to it during sign-up. It is not switched on in the pilot.",
          ],
        },
        {
          heading: "Your choices",
          body: [
            "You can change your privacy consent in Profile, under Privacy and security.",
            "To get a copy of your data or have it deleted, write to aamerjalan3@gmail.com from your registered email, or message your care team.",
          ],
        },
      ]}
    />
  );
}
