import { LandingNavbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { IllustrativeMatchCard } from "@/components/landing/illustrative-match-card";
import { TrustStrip } from "@/components/landing/trust-strip";
import { ProblemSection } from "@/components/landing/problem-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ProductPreview } from "@/components/landing/product-preview";
import { EligibilitySection } from "@/components/landing/eligibility-section";
import { ScholarshipSection } from "@/components/landing/scholarship-section";
import { DataTrustSection } from "@/components/landing/data-trust-section";
import { DiscoverySection } from "@/components/landing/discovery-section";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";
import { signupMode } from "@/lib/waitlist/core";

export default function Home() {
  // The landing page is prerendered, so this is read when the site is built:
  // rebuild after changing SIGNUP_MODE. The sign-up page itself reads it per request.
  const inviteOnly = signupMode() === "invite";
  return (
    <div className="flex flex-1 flex-col bg-paper">
      <LandingNavbar inviteOnly={inviteOnly} />
      <main className="flex flex-1 flex-col">
        <Hero visual={<IllustrativeMatchCard />} />
        <TrustStrip />
        <ProblemSection />
        <HowItWorks />
        <ProductPreview />
        <EligibilitySection />
        <ScholarshipSection />
        <DataTrustSection />
        <DiscoverySection />
        <FinalCta inviteOnly={inviteOnly} />
      </main>
      <LandingFooter />
    </div>
  );
}
