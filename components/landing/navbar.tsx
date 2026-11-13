"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { KickScholarLogo } from "@/components/kick/kickscholar-logo";

// The catalogue needs an account, so signed-out links go to sign-up and come
// back to the catalogue afterwards (docs/ui-remodel.md §9.11).
const LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Programmes", href: "/signup?next=/programs" },
  { label: "Scholarships", href: "/signup?next=/scholarships" },
];

/** Night over the hero, white once the page scrolls. */
export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors",
        scrolled ? "border-b border-line bg-white/95 text-ink backdrop-blur" : "bg-transparent text-white",
      )}
    >
      <div className="flex h-16 items-center justify-between gap-4 px-gutter md:h-20">
        <Link href="/" aria-label="KickScholar home" className="inline-flex min-h-11 shrink-0 items-center">
          <KickScholarLogo aria-hidden tone={scrolled ? "colour" : "reversed"} className="h-[22px] w-auto md:h-7" />
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-8">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn("inline-flex min-h-11 items-center text-[15px] font-bold", scrolled ? "text-ink-3 hover:text-ink" : "text-on-night-muted hover:text-white")}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className={cn("inline-flex h-11 items-center rounded-full px-5 text-[15px] font-bold", scrolled ? "text-ink hover:bg-grey-tint" : "text-white hover:bg-white/10")}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className={cn(
              "inline-flex h-11 items-center rounded-full px-5 text-[15px] font-bold",
              scrolled ? "bg-kick-blue text-white hover:bg-kick-blue-hover" : "bg-white text-ink hover:bg-[#E3EBF4]",
            )}
          >
            Sign up
          </Link>
        </div>

        <Sheet>
          <SheetTrigger
            render={
              <button
                type="button"
                aria-label="Open menu"
                className={cn("inline-flex size-11 items-center justify-center rounded-full md:hidden", scrolled ? "text-ink" : "text-white")}
              />
            }
          >
            <Menu aria-hidden="true" className="size-6" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-white">
            <SheetHeader>
              <SheetTitle>
                <KickScholarLogo className="h-6 w-auto" />
              </SheetTitle>
            </SheetHeader>
            <nav aria-label="Main" className="flex flex-col gap-1 px-3">
              {LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="flex min-h-11 items-center rounded-xl px-3 text-[15px] font-bold text-ink hover:bg-blue-tint">
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-3 flex flex-col gap-2 px-3">
              <Link href="/login" className="inline-flex h-11 items-center justify-center rounded-full border border-line-strong font-bold text-ink">
                Log in
              </Link>
              <Link href="/signup" className="inline-flex h-11 items-center justify-center rounded-full bg-kick-blue font-bold text-white">
                Sign up
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
