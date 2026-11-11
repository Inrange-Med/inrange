import Motion from "@/components/landing/Motion";
import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import ComboBanner from "@/components/landing/ComboBanner";
import LossCalculator from "@/components/landing/LossCalculator";
import Programmes from "@/components/landing/Programmes";
import Everyday from "@/components/landing/Everyday";
import Timeline from "@/components/landing/Timeline";
import Measures from "@/components/landing/Measures";
import Companion from "@/components/landing/Companion";
import Doctors from "@/components/landing/Doctors";
import Pharmacy from "@/components/landing/Pharmacy";
import Maintenance from "@/components/landing/Maintenance";
import Pricing from "@/components/landing/Pricing";
import Resources from "@/components/landing/Resources";
import Faq from "@/components/landing/Faq";
import Footer from "@/components/landing/Footer";
import { QA } from "@/components/landing/faq-data";
import { SITE } from "@/components/landing/tools/catalog";

/*
  Who inrange is, in the terms search engines and AI systems use to decide what a site is and
  whether to trust it. Only confirmed, public facts belong here (see CLAUDE.md).
*/
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["MedicalOrganization", "Organization"],
      "@id": `${SITE}/#org`,
      name: "inrange",
      url: SITE,
      logo: `${SITE}/icon.svg`,
      description:
        "Doctor-led care for obesity and type 2 diabetes in India, by video, with blood tests at home, an app with WhatsApp support, and medication only if a doctor judges it clinically appropriate.",
      areaServed: { "@type": "Country", name: "India" },
      knowsAbout: [
        "Obesity",
        "Type 2 diabetes",
        "Prediabetes",
        "Fatty liver",
        "Waist circumference",
        "HbA1c",
      ],
      publishingPrinciples: `${SITE}/editorial-standards`,
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "care@inrangemed.com",
        areaServed: "IN",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      url: SITE,
      name: "inrange",
      inLanguage: "en-IN",
      publisher: { "@id": `${SITE}/#org` },
    },
    {
      "@type": "FAQPage",
      mainEntity: QA.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <Motion />
      <a href="#check" className="skip">
        Skip to the weight loss calculator
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <ComboBanner />
        <LossCalculator />
        <Programmes />
        <Timeline />
        <Everyday />
        <Measures />
        <Companion />
        <Doctors />
        <Pricing />
        <Pharmacy />
        <Maintenance />
        <Resources />
        <Faq />
      </main>
      <Footer
        notes={[
          "Weight loss calculator: American Diabetes Association, Standards of Care in Diabetes, 2026, section 8; Look AHEAD Research Group, Diabetes Care 2007; Knowler WC, et al., N Engl J Med 2002; Wilding JPH, et al., N Engl J Med 2021; Jastreboff AM, et al., N Engl J Med 2022.",
          "Healthy weight range: Misra A, et al. Revised definition of obesity in Asian Indians living in India. Diabetes Metab Syndr, 2025.",
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
