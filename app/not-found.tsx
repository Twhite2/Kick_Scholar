import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KickScholarLogo } from "@/components/kick/kickscholar-logo";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="px-gutter py-6">
        <Link href="/" aria-label="KickScholar home" className="inline-flex min-h-11 items-center">
          <KickScholarLogo aria-hidden className="h-7 w-auto" />
        </Link>
      </div>
      <section aria-labelledby="nf-title" className="mx-auto flex max-w-xl flex-1 flex-col items-start justify-center gap-4 px-gutter pb-24">
        <Compass aria-hidden="true" className="size-8 text-kick-blue" />
        <h1 id="nf-title" className="type-page-h1">We can&apos;t find that page</h1>
        <p className="text-base text-ink-3">The link may be wrong, or the page has moved.</p>
        <Button size="lg" render={<Link href="/dashboard" />}>
          Go to Home
        </Button>
      </section>
    </main>
  );
}
