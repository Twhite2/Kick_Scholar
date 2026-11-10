import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  SAMPLE_NOW,
  sampleApplications,
  sampleClosingSoon,
  sampleDestinations,
  sampleFeatured,
  sampleFunding,
  sampleOneAway,
  sampleStrongMatches,
  sampleUnlock,
} from "@/fixtures/home-feed.sample";
import { STRENGTH_ORDER } from "@/lib/ui/strength";
import { Button } from "@/components/ui/button";
import { InstitutionLogo, type LogoSize } from "@/components/kick/institution-logo";
import { CountryFlag } from "@/components/kick/country-flag";
import { ScoreDial } from "@/components/kick/score-dial";
import { Pill, RequirementBadge, SourceBadge, StrengthBadge } from "@/components/kick/badges";
import { SaveButton } from "@/components/kick/save-button";
import { Rail } from "@/components/kick/rail";
import { NewPill } from "@/components/kick/section-heading";
import { Billboard } from "@/components/kick/billboard";
import { BillboardSlide, MobileFeaturedCard } from "@/components/kick/featured-slides";
import { UnlockCard } from "@/components/kick/unlock-card";
import { ApplicationProgressCard } from "@/components/kick/application-progress-card";
import { MatchPosterCard } from "@/components/kick/match-poster-card";
import { DeadlineTicket } from "@/components/kick/deadline-ticket";
import { FundingPoster } from "@/components/kick/funding-poster";
import { OneAwayCard } from "@/components/kick/one-away-card";
import { DestinationTile } from "@/components/kick/destination-tile";
import { CoverImage } from "@/components/kick/cover-image";
import { FactGrid, KeyDates, RequirementComparison, ScoreBreakdown } from "@/components/kick/detail/panels";
import { NightBannerSkeleton, PosterGridSkeleton } from "@/components/kick/skeletons";
import { DataSaverSwitch } from "@/components/kick/data-saver";

export const metadata: Metadata = { title: "Component kit" };

const SIZES: LogoSize[] = [32, 40, 44, 46, 52, 56, 64, 72];

function KitSection({ title, children, bleed = false }: { title: string; children: React.ReactNode; bleed?: boolean }) {
  return (
    <section className="space-y-4">
      <h2 className="px-gutter type-section-h2 text-ink">{title}</h2>
      <div className={bleed ? "" : "px-gutter"}>{children}</div>
    </section>
  );
}

/**
 * Every KickScholar component at once, with sample data (docs/ui-remodel.md
 * §8). Our Storybook, and the place for screenshots. 404 in production.
 */
export default function KitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const now = SAMPLE_NOW;

  return (
    <div className="space-y-14 pb-24">
      <div className="px-gutter pt-10">
        <h1 className="type-page-h1 text-ink">Component kit</h1>
        <p className="mt-2 type-body-sm text-ink-3">Sample data only (fixtures/home-feed.sample.ts). Dates are relative to 10 Nov 2026.</p>
      </div>

      <KitSection title="Type">
        <div className="space-y-3 rounded-panel bg-white p-6 shadow-hairline">
          <p className="type-display-xl">Display XL</p>
          <p className="type-display-l">Display L</p>
          <p className="type-page-h1">Page heading</p>
          <p className="type-section-h2">Section heading</p>
          <p className="type-poster-title">Poster title</p>
          <p className="type-card-title">Card title</p>
          <p className="text-base">Body text, Atkinson Hyperlegible Next.</p>
          <p className="type-caption">Caption, the smallest text in the app</p>
        </div>
      </KitSection>

      <KitSection title="Logos, flags and dials">
        <div className="space-y-6 rounded-panel bg-white p-6 shadow-hairline">
          <div className="flex flex-wrap items-end gap-4">
            {SIZES.map((s) => (
              <InstitutionLogo key={s} name="University College Dublin" seed={`ucd-${s}`} size={s} />
            ))}
            <InstitutionLogo name="RWTH Aachen University" acronym="RWTH" seed="rwth" size={56} />
            <InstitutionLogo name="Université Paris-Saclay" seed="ups" size={56} />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {["FI", "SE", "NO", "DK", "DE", "NL", "BE", "FR", "IE", "GB", "NG", "XX"].map((c) => (
              <span key={c} className="flex items-center gap-2 text-sm text-ink-2">
                <CountryFlag code={c} /> {c}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {STRENGTH_ORDER.map((s, i) => (
              <ScoreDial key={s} score={[92, 76, 58, 81, 30][i]} strength={s} size={60} />
            ))}
            <ScoreDial score={92} strength="STRONG_MATCH" size={46} />
            <ScoreDial score={92} strength="STRONG_MATCH" size={88} />
            <div className="rounded-panel bg-night p-3">
              <ScoreDial score={92} strength="STRONG_MATCH" size={88} tone="night" />
            </div>
          </div>
        </div>
      </KitSection>

      <KitSection title="Badges, pills and buttons">
        <div className="space-y-5 rounded-panel bg-white p-6 shadow-hairline">
          <div className="flex flex-wrap gap-2">
            {STRENGTH_ORDER.map((s) => (
              <StrengthBadge key={s} strength={s} />
            ))}
            <SourceBadge verified />
            <SourceBadge verified={false} />
            <RequirementBadge verified />
            <RequirementBadge verified={false} />
            <Pill>Master&apos;s</Pill>
            <Pill tone="blue">2 years</Pill>
            <NewPill>4 new since Friday</NewPill>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Reject</Button>
            <Button size="lg">Large</Button>
            <SaveButton targetType="program" targetId="kit" title="Kit programme" initialSaved={false} />
            <SaveButton targetType="program" targetId="kit2" title="Kit programme" initialSaved />
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-tile bg-night p-4">
            <SaveButton targetType="program" targetId="kit3" title="Kit programme" initialSaved={false} variant="night" />
            <SourceBadge verified tone="night" />
            <Pill tone="night">Taught in English</Pill>
            <div className="w-72">
              <DataSaverSwitch tone="night" />
            </div>
          </div>
        </div>
      </KitSection>

      <KitSection title="Billboard (wide screens)" bleed>
        <Billboard
          slides={sampleFeatured.map((f, i) => <BillboardSlide key={f.id} f={f} first={i === 0} />)}
          labels={sampleFeatured.map((f) => `${f.title}, ${f.institution.name}`)}
        />
        <UnlockCard unlock={sampleUnlock} className="-mt-[68px]" />
      </KitSection>

      <KitSection title="Featured card (phones)">
        <div className="max-w-[360px] rounded-panel bg-night p-4">
          <MobileFeaturedCard f={sampleFeatured[0]} />
        </div>
      </KitSection>

      <KitSection title="Pick up where you left off">
        <div className="grid max-w-[1328px] gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {sampleApplications.map((a) => (
            <ApplicationProgressCard key={a.id} app={a} now={now} />
          ))}
        </div>
      </KitSection>

      <Rail id="kit-strong" title="Strong matches for you" pill={<NewPill>4 new since Friday</NewPill>} seeAll={{ href: "#", label: "See all 34" }} prevLabel="Previous matches" nextLabel="More matches">
        {sampleStrongMatches.map((c) => (
          <MatchPosterCard key={c.id} card={c} now={now} />
        ))}
      </Rail>

      <Rail id="kit-closing" title="Closing soon" prevLabel="Earlier deadlines" nextLabel="Later deadlines" gap={18}>
        {sampleClosingSoon.map((d) => (
          <DeadlineTicket key={d.id} item={d} now={now} />
        ))}
      </Rail>

      <Rail id="kit-funding" title="Funding you qualify for" seeAll={{ href: "#", label: "See all 61" }} prevLabel="Previous scholarships" nextLabel="More scholarships">
        {sampleFunding.map((c) => (
          <FundingPoster key={c.id} card={c} now={now} />
        ))}
      </Rail>

      <Rail id="kit-one-away" title="One requirement away" description="Close one gap and these become strong matches." prevLabel="Previous" nextLabel="More" gap={18} stretch>
        {sampleOneAway.map((o) => (
          <OneAwayCard key={o.id} item={o} />
        ))}
      </Rail>

      <Rail id="kit-dest" title="Browse by destination" prevLabel="Previous countries" nextLabel="More countries" gap={18}>
        {sampleDestinations.map((d) => (
          <DestinationTile key={d.countryCode} countryCode={d.countryCode} count={d.count} />
        ))}
      </Rail>

      <KitSection title="Covers: scenes and data saver">
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
          {(["nordic", "canal", "gothic", "modern", "harbour"] as const).map((s) => (
            <div key={s} className="relative aspect-video overflow-hidden rounded-tile">
              <CoverImage institutionId={s} countryCode="FI" scene={s} sizes="220px" dataSaver={false} />
              <span className="absolute bottom-2 left-2 rounded-full bg-white px-2 py-0.5 type-caption">{s}</span>
            </div>
          ))}
          {["FI", "NL", "DE", "GB"].map((c) => (
            <div key={c} className="relative aspect-video overflow-hidden rounded-tile">
              <CoverImage institutionId={c} countryCode={c} city="City name" sizes="220px" dataSaver />
            </div>
          ))}
        </div>
      </KitSection>

      <KitSection title="Detail page pieces">
        <div className="max-w-[860px] space-y-6">
          <FactGrid
            facts={[
              { label: "Tuition", value: "€18,000", note: "A linked scholarship can cover it", noteTone: "green" },
              { label: "Length", value: "2 years" },
              { label: "Starts", value: "September" },
              { label: "Applications", value: "Close 2 Jan", note: "Closes in 53 days", noteTone: "muted" },
              { label: "Taught in", value: "English" },
            ]}
          />
          <div className="rounded-panel bg-white p-6 shadow-hairline">
            <RequirementComparison
              rows={[
                { key: "1", label: "English or language test", theyAsk: "IELTS 6.5 or TOEFL iBT 90", youHave: null, status: "missing", action: { label: "Add test score", href: "/profile#language" } },
                { key: "2", label: "Minimum grade", theyAsk: "At least 3.0 (4-point scale)", youHave: "3.72 on a 5-point scale", status: "met" },
                { key: "3", label: "Previous degree", theyAsk: "Bachelor's in computer science or a closely related field", youHave: "Bachelor's in Computer Science", status: "unknown" },
              ]}
            />
          </div>
          <div className="rounded-panel bg-white p-6 shadow-hairline">
            <ScoreBreakdown
              factors={[
                { factor: "ACADEMIC_COMPATIBILITY", score: 100, explanation: "Your GPA meets the stated requirement." },
                { factor: "LANGUAGE_COMPATIBILITY", score: 0, explanation: "IELTS 6.5 is required — no matching score on file." },
                { factor: "BUDGET_COMPATIBILITY", score: 60, explanation: "Tuition varies — verify directly." },
                { factor: "WORK_EXPERIENCE", score: null, explanation: "No work experience requirement is published." },
              ]}
            />
          </div>
          <KeyDates
            now={now}
            intakes={["September"]}
            dates={[
              { label: "Application deadline", date: "2027-01-02T00:00:00.000Z" },
              { label: "Documents due", date: "2026-10-01T00:00:00.000Z" },
            ]}
          />
        </div>
      </KitSection>

      <KitSection title="Loading skeletons" bleed>
        <NightBannerSkeleton />
        <div className="mt-6">
          <PosterGridSkeleton count={4} />
        </div>
      </KitSection>
    </div>
  );
}
