import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getHomeFeed, getStarterFeed } from "@/lib/home/get-home-feed";
import { greeting, plural, sinceLabel } from "@/lib/ui/format";
import { prisma } from "@/lib/db";
import { Billboard } from "@/components/kick/billboard";
import { FeaturedCarousel } from "@/components/kick/featured-carousel";
import { BillboardSlide, MobileFeaturedCard, NightHero } from "@/components/kick/featured-slides";
import { UnlockCard } from "@/components/kick/unlock-card";
import { ApplicationProgressCard } from "@/components/kick/application-progress-card";
import { Rail } from "@/components/kick/rail";
import { NewPill, SectionHeading } from "@/components/kick/section-heading";
import { MatchPosterCard } from "@/components/kick/match-poster-card";
import { DeadlineTicket } from "@/components/kick/deadline-ticket";
import { FundingPoster } from "@/components/kick/funding-poster";
import { OneAwayCard } from "@/components/kick/one-away-card";
import { DestinationTile } from "@/components/kick/destination-tile";
import { HomeVisitMarker } from "@/components/kick/home-visit-marker";
import { cn } from "@/lib/utils";

export const metadata = { title: "Home" };

/**
 * Home (docs/ui-remodel.md §9.1): a billboard of top matches, the student's
 * biggest fixable gap, then rails — each with its own card format.
 */
export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const now = new Date();
  const feed = await getHomeFeed(session.user.id, now);

  if (!feed.hasProfile) return <StarterHome userId={session.user.id} />;

  const tracked = await prisma.application.findMany({
    where: { userId: session.user.id },
    select: { programId: true },
  });
  const trackedProgrammes = new Set(tracked.flatMap((a) => (a.programId ? [a.programId] : [])));

  const since = feed.previousVisitAt ? sinceLabel(feed.previousVisitAt, now) : null;
  const newPill =
    feed.newStrongCount > 0 && since ? <NewPill>{`${feed.newStrongCount} new ${since}`}</NewPill> : null;
  const greet = `Good ${greeting(now)}${feed.firstName ? `, ${feed.firstName}` : ""}`;
  const hasFeatured = feed.featured.length > 0;
  const railsEmpty =
    feed.strongMatches.length === 0 &&
    feed.closingSoon.length === 0 &&
    feed.funding.length === 0 &&
    feed.oneAway.length === 0 &&
    feed.destinations.length === 0;

  const slides = feed.featured.map((f, i) => <BillboardSlide key={f.id} f={f} first={i === 0} />);
  const mobileSlides = feed.featured.map((f) => <MobileFeaturedCard key={f.id} f={f} />);
  const labels = feed.featured.map((f) => `${f.title}, ${f.institution.name}`);

  return (
    <div className="pb-16">
      <h1 className="sr-only">{greet}</h1>
      <HomeVisitMarker />

      {hasFeatured ? (
        <>
          {/* Phones: greeting and a swipeable row of featured cards */}
          <section aria-label="Your top matches" className={cn("bg-night pt-16 text-white md:hidden", feed.unlock ? "pb-16" : "pb-8")}>
            <div className="px-gutter pt-4 pb-5">
              <p className="font-display text-[28px] leading-tight font-bold tracking-[-0.02em]">{greet}</p>
              {newPill && since && (
                <p className="mt-1 text-[15px] text-on-night-muted">
                  {plural(feed.newStrongCount, "new match", "new matches")} {since}
                </p>
              )}
            </div>
            <FeaturedCarousel slides={mobileSlides} labels={labels} />
          </section>
          {/* Wider screens: the billboard */}
          <Billboard slides={slides} labels={labels} className="hidden md:block" />
        </>
      ) : (
        <NightHero
          title="No strong matches yet"
          body="Widen your preferences or add missing details to see more."
          primary={{ label: "Edit preferences", href: "/profile#preferences" }}
          secondary={{ label: "Browse programmes", href: "/programs" }}
        />
      )}

      {feed.unlock && <UnlockCard unlock={feed.unlock} className="-mt-12 md:-mt-[68px]" />}

      <div className="mt-12 space-y-12">
        {feed.applications.length > 0 && (
          <section aria-labelledby="pickup-title" className="px-gutter">
            <SectionHeading
              id="pickup-title"
              title="Pick up where you left off"
              actions={
                <Link href="/plan?tab=applications" className="inline-flex min-h-11 items-center text-[15px] font-bold text-kick-blue hover:underline">
                  Open My plan
                </Link>
              }
            />
            <div className="mt-4 grid max-w-[1328px] gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
              {feed.applications.map((app) => (
                <ApplicationProgressCard key={app.id} app={app} now={now} />
              ))}
            </div>
          </section>
        )}

        {railsEmpty ? (
          <section aria-labelledby="empty-title" className="mx-gutter max-w-[1328px] rounded-panel bg-white p-6 shadow-hairline md:p-8">
            <h2 id="empty-title" className="type-section-h2">
              Nothing to show yet
            </h2>
            <p className="mt-2 max-w-[70ch] text-base text-ink-3">
              Add more details to your profile, or widen your preferred countries and fields.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/profile" className="inline-flex h-12 items-center rounded-full bg-kick-blue px-6 font-bold text-white hover:bg-kick-blue-hover">
                Edit profile
              </Link>
              <Link href="/programs" className="inline-flex h-12 items-center rounded-full border border-line-strong bg-white px-6 font-bold text-ink hover:border-kick-blue">
                Browse programmes
              </Link>
            </div>
          </section>
        ) : (
          <>
            {feed.strongMatches.length > 0 && (
              <Rail
                id="strong"
                title="Strong matches for you"
                pill={newPill}
                seeAll={{ href: "/programs?sort=best&qualify=1", label: `See all ${feed.strongMatchesTotal.toLocaleString("en-GB")}` }}
                prevLabel="Previous matches"
                nextLabel="More matches"
              >
                {feed.strongMatches.map((card) => (
                  <MatchPosterCard key={card.id} card={card} tracking={trackedProgrammes.has(card.id)} now={now} />
                ))}
              </Rail>
            )}

            {feed.closingSoon.length > 0 && (
              <Rail id="closing" title="Closing soon" prevLabel="Earlier deadlines" nextLabel="Later deadlines" gap={18}>
                {feed.closingSoon.map((item) => (
                  <DeadlineTicket key={item.id} item={item} now={now} />
                ))}
              </Rail>
            )}

            {feed.funding.length > 0 && (
              <Rail
                id="funding"
                title="Funding you qualify for"
                seeAll={{ href: "/scholarships", label: `See all ${feed.fundingTotal.toLocaleString("en-GB")}` }}
                prevLabel="Previous scholarships"
                nextLabel="More scholarships"
              >
                {feed.funding.map((card) => (
                  <FundingPoster key={card.id} card={card} now={now} />
                ))}
              </Rail>
            )}

            {feed.oneAway.length > 0 && (
              <Rail
                id="one-away"
                title="One requirement away"
                description="Close one gap and these become strong matches."
                prevLabel="Previous opportunities"
                nextLabel="More opportunities"
                gap={18}
                stretch
              >
                {feed.oneAway.map((item) => (
                  <OneAwayCard key={item.id} item={item} />
                ))}
              </Rail>
            )}

            {feed.destinations.length > 0 && (
              <Rail id="destinations" title="Browse by destination" prevLabel="Previous countries" nextLabel="More countries" gap={18}>
                {feed.destinations.map((d) => (
                  <DestinationTile key={d.countryCode} countryCode={d.countryCode} count={d.count} />
                ))}
              </Rail>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Home before a profile exists (docs/ui-remodel.md §9.2). */
async function StarterHome({ userId }: { userId: string }) {
  const [starter, saved] = await Promise.all([
    getStarterFeed(),
    prisma.savedOpportunity.findMany({ where: { userId, scholarshipId: { not: null } }, select: { scholarshipId: true } }),
  ]);
  const savedIds = new Set(saved.map((s) => s.scholarshipId));
  return (
    <div className="pb-16">
      <NightHero
        title="See the universities and scholarships you qualify for"
        body="Complete your profile and we'll show you exactly which programmes and scholarships you qualify for."
        primary={{ label: "Complete your profile", href: "/profile" }}
        secondary={{ label: "Browse programmes", href: "/programs" }}
      />
      <div className="mt-12 space-y-12">
        {starter.destinations.length > 0 && (
          <Rail id="popular" title="Popular destinations" prevLabel="Previous countries" nextLabel="More countries" gap={18}>
            {starter.destinations.map((d) => (
              <DestinationTile key={d.countryCode} countryCode={d.countryCode} count={d.count} personalised={false} />
            ))}
          </Rail>
        )}
        {starter.funding.length > 0 && (
          <Rail
            id="fully-funded"
            title="Fully funded scholarships"
            seeAll={{ href: "/scholarships?coverage=FULL_FUNDING", label: "See all" }}
            prevLabel="Previous scholarships"
            nextLabel="More scholarships"
          >
            {starter.funding.map((card) => (
              <FundingPoster key={card.id} card={{ ...card, saved: savedIds.has(card.id) }} />
            ))}
          </Rail>
        )}
      </div>
    </div>
  );
}
