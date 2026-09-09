import { LandingNavbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
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

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <LandingNavbar />
      <main className="flex flex-1 flex-col">
        <Hero />
        <TrustStrip />
        <ProblemSection />
        <HowItWorks />
        <ProductPreview />
        <EligibilitySection />
        <ScholarshipSection />
        <DataTrustSection />
        <DiscoverySection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
