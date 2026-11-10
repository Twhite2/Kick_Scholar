import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Photo credits" };
export const dynamic = "force-dynamic";

/**
 * Every campus photo in use, with its author, licence and source
 * (docs/ui-remodel.md §11.5). Wikimedia Commons licences require attribution.
 */
export default async function CreditsPage() {
  const photos = await prisma.university.findMany({
    where: { coverUrl: { not: null } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, coverCredit: true, coverLicense: true, coverLicenseUrl: true, coverSourceUrl: true },
  });

  return (
    <main className="min-h-screen pb-16">
      <div className="px-gutter py-6">
        <Link href="/" className="inline-flex min-h-11 items-center font-display text-2xl font-[750] tracking-[-0.03em] text-kick-blue">
          KickScholar
        </Link>
      </div>
      <div className="box-content max-w-[860px] px-gutter">
        <h1 className="type-page-h1 text-ink">Photo credits</h1>
        <p className="mt-3 max-w-[70ch] text-base text-ink-2">
          Campus photos come from Wikimedia Commons and are used under the licences shown. University logos are their
          owners&apos; trademarks and are shown only to identify each institution next to its name.
        </p>
        {photos.length === 0 ? (
          <p className="mt-8 rounded-panel bg-white p-6 text-[15px] text-ink-3 shadow-hairline">No photos are in use yet.</p>
        ) : (
          <ul role="list" className="mt-8 divide-y divide-line rounded-panel bg-white shadow-hairline">
            {photos.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <Link href={`/institutions/${p.id}`} className="font-bold text-ink hover:text-kick-blue">
                  {p.name}
                </Link>
                <p className="text-sm text-ink-3">
                  {p.coverCredit ?? "Unknown author"}
                  {p.coverLicense && (
                    <>
                      {" · "}
                      {p.coverLicenseUrl ? (
                        <a href={p.coverLicenseUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
                          {p.coverLicense}
                        </a>
                      ) : (
                        p.coverLicense
                      )}
                    </>
                  )}
                  {p.coverSourceUrl && (
                    <>
                      {" · "}
                      <a href={p.coverSourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
                        Source
                      </a>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
