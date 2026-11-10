import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { FactorScore } from "@/lib/matching/types";
import { institutionFaceSelect, toInstitutionFace } from "@/lib/cards/faces";
import { matchInfo, tuitionLabel, tuitionOf } from "@/lib/cards/programme-cards";
import { countryName } from "@/lib/ui/country";
import { formatDate, formatDuration, plural } from "@/lib/ui/format";
import { STRENGTH_LABEL } from "@/lib/ui/strength";
import { programmeRows } from "@/lib/ui/requirements";
import { capitalise, getComparisonProfile, joinList, splitLanguages } from "@/lib/detail/shared";
import { InstitutionLogo } from "@/components/kick/institution-logo";
import { ScoreDial } from "@/components/kick/score-dial";

export const metadata: Metadata = { title: "Compare programmes" };

const MAX = 3;

/** Up to three programmes side by side (docs/ui-remodel.md §9.6). */
export default async function ComparePage({ searchParams }: PageProps<"/compare">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const now = new Date();

  const params = await searchParams;
  const ids = (typeof params.ids === "string" ? params.ids.split(",") : [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX);

  const [programmes, matches, profile] = await Promise.all([
    ids.length
      ? prisma.program.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            name: true,
            durationMonths: true,
            intakes: true,
            instructionLanguages: true,
            tuitionType: true,
            tuitionAmount: true,
            tuitionCurrency: true,
            tuitionPeriod: true,
            verified: true,
            universityId: true,
            university: { select: institutionFaceSelect },
            requirements: { select: { id: true, requirementType: true, testName: true, operator: true, value: true, unit: true, description: true } },
            deadlines: { where: { date: { gte: now } }, orderBy: { date: "asc" }, take: 1, select: { date: true } },
            _count: { select: { fundingOpportunities: true } },
          },
        })
      : [],
    prisma.match.findMany({
      where: { userId, programId: { in: ids } },
      select: { programId: true, score: true, matchStrength: true, factorScores: true },
    }),
    getComparisonProfile(userId),
  ]);
  const uniFunding = programmes.length
    ? await prisma.fundingOpportunity.groupBy({
        by: ["universityId"],
        where: { universityId: { in: programmes.map((p) => p.universityId) }, programId: null },
        _count: { _all: true },
      })
    : [];

  const byId = new Map(programmes.map((p) => [p.id, p]));
  const ordered = ids.flatMap((id) => byId.get(id) ?? []);
  const matchById = new Map(matches.map((m) => [m.programId, m]));

  if (ordered.length < 2) {
    return (
      <div className="mx-auto max-w-xl px-gutter py-16">
        <h1 className="type-page-h1">Compare programmes</h1>
        <p className="mt-3 text-base text-ink-3">
          Add two or three programmes with the compare button on any programme, then open the comparison from the tray.
        </p>
        <Link href="/programs" className="mt-6 inline-flex h-12 items-center rounded-full bg-kick-blue px-6 font-bold text-white hover:bg-kick-blue-hover">
          Browse programmes
        </Link>
      </div>
    );
  }

  const columns = ordered.map((p) => {
    const m = matchById.get(p.id);
    const factors = (m?.factorScores as unknown as FactorScore[] | undefined) ?? [];
    const rows = programmeRows(p.requirements, factors, profile);
    const uni = uniFunding.find((u) => u.universityId === p.universityId)?._count._all ?? 0;
    return {
      p,
      face: toInstitutionFace(p.university),
      match: matchInfo(m, p.verified),
      tuition: tuitionLabel(tuitionOf(p)) ?? "Not yet published",
      length: formatDuration(p.durationMonths) ?? "Not published",
      starts: p.intakes.length ? joinList(p.intakes.map(capitalise)) : "Not published",
      deadline: p.deadlines[0]?.date ? formatDate(p.deadlines[0].date, now) : "Not published yet",
      languages: splitLanguages(p.instructionLanguages).length ? joinList(splitLanguages(p.instructionLanguages)) : "Not published",
      funding: p._count.fundingOpportunities + uni,
      met: rows.filter((r) => r.status === "met").length,
      missing: rows.filter((r) => r.status === "missing").length,
      location: [p.university.city, countryName(p.university.country)].filter(Boolean).join(", "),
    };
  });

  const ROWS: Array<{ label: string; value: (c: (typeof columns)[number]) => React.ReactNode }> = [
    { label: "Tuition", value: (c) => c.tuition },
    { label: "Length", value: (c) => c.length },
    { label: "Starts", value: (c) => c.starts },
    { label: "Next deadline", value: (c) => c.deadline },
    { label: "Taught in", value: (c) => c.languages },
    { label: "Linked funding", value: (c) => (c.funding > 0 ? plural(c.funding, "scholarship") : "None linked yet") },
    {
      label: "Requirements",
      value: (c) => (
        <span>
          <span className="font-bold text-green-text">{c.met} met</span>
          {c.missing > 0 && <span className="font-bold text-red-text">, {c.missing} missing</span>}
        </span>
      ),
    },
    { label: "Location", value: (c) => c.location },
  ];

  return (
    <div className="pb-16">
      <div className="px-gutter pt-6 md:pt-10">
        <h1 className="type-page-h1">Compare programmes</h1>
        <p className="mt-2 type-body-sm text-ink-3">Side by side, from the same published data as each programme page.</p>
      </div>
      <div className="mt-6 overflow-x-auto px-gutter pb-4">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 overflow-hidden rounded-panel bg-white text-left shadow-hairline">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-40 bg-white p-4 align-bottom text-[13px] font-bold text-ink-3">
                <span className="sr-only">Detail</span>
              </th>
              {columns.map((c) => (
                <th key={c.p.id} scope="col" className="min-w-[220px] border-l border-line p-4 align-top">
                  <div className="flex flex-col gap-3">
                    <InstitutionLogo name={c.face.name} logoUrl={c.face.logoUrl} acronym={c.face.acronym} seed={c.face.id} size={46} />
                    <Link href={`/programs/${c.p.id}`} className="type-card-title text-ink hover:text-kick-blue">
                      {c.p.name}
                    </Link>
                    <span className="text-sm font-normal text-ink-3">{c.face.name}</span>
                    {c.match ? (
                      <span className="flex items-center gap-3">
                        <ScoreDial score={c.match.score} strength={c.match.strength} size={46} />
                        <span className="text-sm font-bold text-ink">{STRENGTH_LABEL[c.match.strength]}</span>
                      </span>
                    ) : (
                      <span className="text-sm text-ink-3">No match score yet</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="sticky left-0 z-10 border-t border-line bg-white p-4 text-[15px] font-bold text-ink">
                  {row.label}
                </th>
                {columns.map((c) => (
                  <td key={c.p.id} className="border-t border-l border-line p-4 text-[15px] text-ink-2">
                    {row.value(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
