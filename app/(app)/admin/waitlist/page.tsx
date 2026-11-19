import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { TARGET_COUNTRIES } from "@/lib/constants/countries";
import { countryName } from "@/lib/ui/country";
import { formatCount } from "@/lib/ui/format";
import { humanise } from "@/lib/ui/text";
import { degreeLabel } from "@/lib/ui/requirements";
import { signupMode } from "@/lib/waitlist/core";
import { cn } from "@/lib/utils";
import { WaitlistInvitePanel } from "@/components/admin/waitlist-invite-panel";
import { WaitlistRow, type WaitlistRowData } from "@/components/admin/waitlist-row";

export const metadata: Metadata = { title: "Waitlist" };

const th = "px-4 py-3 text-left text-[13px] font-bold text-ink-3";
const STATUSES = ["WAITING", "INVITED", "JOINED"] as const;
type Status = (typeof STATUSES)[number];
const PAGE = 100;

const dateLabel = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-tile bg-white px-5 py-4 shadow-hairline">
      <p className="font-display text-[28px] leading-none font-[750] text-ink tabular-nums">{formatCount(value)}</p>
      <p className="mt-1.5 text-sm text-ink-3">{label}</p>
    </div>
  );
}

export default async function AdminWaitlistPage({ searchParams }: PageProps<"/admin/waitlist">) {
  await requireAdmin();
  const raw = (await searchParams).status;
  const status: Status = STATUSES.find((s) => s === raw) ?? "WAITING";
  const now = new Date();

  const [byStatus, byDegree, byCountry, entries] = await Promise.all([
    prisma.waitlistEntry.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.waitlistEntry.groupBy({ by: ["desiredDegreeLevel"], where: { status: "WAITING" }, _count: { _all: true } }),
    prisma.$queryRaw<Array<{ country: string; count: bigint }>>`
      SELECT c AS country, COUNT(*) AS count
      FROM "WaitlistEntry", unnest("preferredCountries") AS c
      WHERE status = 'WAITING'
      GROUP BY c
      ORDER BY count DESC, c ASC`,
    prisma.waitlistEntry.findMany({
      where: { status },
      // The queue in the order it is served; the others newest first.
      orderBy: { [status === "WAITING" ? "createdAt" : status === "INVITED" ? "invitedAt" : "joinedAt"]: status === "WAITING" ? "asc" : "desc" },
      take: PAGE,
    }),
  ]);

  const counts = Object.fromEntries(STATUSES.map((s) => [s, byStatus.find((r) => r.status === s)?._count._all ?? 0])) as Record<Status, number>;
  const countries = Object.keys(TARGET_COUNTRIES)
    .map((code) => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

  const rows: WaitlistRowData[] = entries.map((e) => ({
    id: e.id,
    email: e.email,
    degree: degreeLabel(e.desiredDegreeLevel),
    countries: e.preferredCountries.map((c) => countryName(c)).join(", "),
    nationality: e.nationality,
    source: e.source,
    status: e.status,
    dateLabel:
      e.status === "WAITING"
        ? `Joined list ${dateLabel(e.createdAt)}`
        : e.status === "INVITED"
          ? `Invited ${dateLabel(e.invitedAt ?? e.createdAt)}`
          : `Signed up ${dateLabel(e.joinedAt ?? e.createdAt)}`,
    inviteExpired: e.status === "INVITED" && (!e.inviteExpiresAt || e.inviteExpiresAt <= now),
  }));

  return (
    <div className="space-y-8">
      {signupMode() !== "invite" && (
        <p className="rounded-tile bg-blue-tint px-4 py-3 text-[15px] text-ink">
          Sign-up is open to everyone, so nobody is being sent to the waitlist. Set <code className="font-mono">SIGNUP_MODE=invite</code> to close it.
          Invite links still work, and anyone on the list who signs up is marked as joined.
        </p>
      )}

      <section aria-label="Totals" className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Waiting" value={counts.WAITING} />
        <StatTile label="Invited, not signed up yet" value={counts.INVITED} />
        <StatTile label="Signed up from the list" value={counts.JOINED} />
      </section>

      <section aria-labelledby="demand-heading">
        <h2 id="demand-heading" className="font-display text-xl font-bold text-ink">
          What people waiting want
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {byDegree
            .sort((a, b) => b._count._all - a._count._all)
            .map((d) => (
              <span key={d.desiredDegreeLevel ?? "none"} className="inline-flex h-8 items-center rounded-full bg-white px-3 text-sm text-ink shadow-hairline">
                {degreeLabel(d.desiredDegreeLevel) ?? "No degree given"}
                <span className="ml-2 font-bold tabular-nums">{formatCount(d._count._all)}</span>
              </span>
            ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {byCountry.map((c) => (
            <span key={c.country} className="inline-flex h-8 items-center rounded-full bg-white px-3 text-sm text-ink shadow-hairline">
              {countryName(c.country)}
              <span className="ml-2 font-bold tabular-nums">{formatCount(Number(c.count))}</span>
            </span>
          ))}
          {byCountry.length === 0 && byDegree.length === 0 && <p className="text-sm text-ink-3">Nobody is waiting.</p>}
        </div>
      </section>

      <WaitlistInvitePanel waiting={counts.WAITING} countries={countries} />

      <section aria-labelledby="list-heading">
        <h2 id="list-heading" className="sr-only">
          Entries
        </h2>
        <nav aria-label="Filter by status" className="mb-3 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/admin/waitlist?status=${s}`}
              aria-current={s === status ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center rounded-full px-4 text-[15px] font-bold",
                s === status ? "bg-varsity-blue text-white" : "bg-white text-ink shadow-hairline hover:bg-grey-tint",
              )}
            >
              {humanise(s)} <span className="ml-1.5 tabular-nums opacity-80">{formatCount(counts[s])}</span>
            </Link>
          ))}
        </nav>
        {rows.length === 0 ? (
          <p className="rounded-panel bg-white px-5 py-8 text-center text-[15px] text-ink-3 shadow-hairline">Nobody here yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-panel bg-white shadow-hairline">
            <table className="w-full min-w-[920px] text-[15px]">
              <thead className="border-b border-line">
                <tr>
                  <th scope="col" className={th}>Email</th>
                  <th scope="col" className={th}>Degree</th>
                  <th scope="col" className={th}>Countries</th>
                  <th scope="col" className={th}>Nationality</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={th}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <WaitlistRow key={r.id} entry={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {counts[status] > PAGE && (
          <p className="mt-3 text-sm text-ink-3">
            Showing the first {PAGE} of {formatCount(counts[status])}.
          </p>
        )}
      </section>
    </div>
  );
}
