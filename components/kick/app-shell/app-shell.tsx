"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Compass, House, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOP_NAV, isExploreRoute, isNightRoute } from "@/lib/ui/nav";
import { DataSaverBanner } from "@/components/kick/data-saver";
import { KickScholarLogo } from "@/components/kick/kickscholar-logo";
import { AvatarMenu, type ShellUser } from "./avatar-menu";

/**
 * The signed-in shell (docs/ui-remodel.md §7): a top bar on every width — a
 * transparent "night" bar floating over dark banners, a white sticky bar
 * elsewhere — plus a four-tab bar on phones. No sidebar, no drawer.
 */
export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const night = isNightRoute(pathname);
  const onHome = pathname === "/dashboard";

  return (
    <div className="flex min-h-screen w-full flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-white px-4 py-3 font-bold text-kick-blue focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      {onHome && <DataSaverBanner />}
      <div className="relative flex flex-1 flex-col">
        <TopBar user={user} pathname={pathname} night={night} />
        <main id="main" className="flex-1 pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>
      <TabBar pathname={pathname} />
    </div>
  );
}

function TopBar({ user, pathname, night }: { user: ShellUser; pathname: string; night: boolean }) {
  return (
    <header
      className={cn(
        "z-30 flex h-16 w-full items-center gap-3 px-gutter md:h-20 md:gap-6",
        night
          ? "absolute inset-x-0 top-0 text-white"
          : "sticky top-0 border-b border-line bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/85",
      )}
    >
      {/* The logo: reversed on the night bar, colour on the light one (logo/README.txt). */}
      <Link href="/dashboard" aria-label="KickScholar home" className="inline-flex min-h-11 shrink-0 items-center">
        <KickScholarLogo aria-hidden tone={night ? "reversed" : "colour"} className="h-[22px] w-auto md:h-7" />
      </Link>

      <nav aria-label="Main" className="hidden md:block">
        <ul className="flex items-center md:gap-3 lg:gap-6">
          {TOP_NAV.map((item) => {
            const current = item.match(pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "relative inline-flex min-h-11 items-center font-bold md:text-[14px] lg:text-[15px]",
                    "after:absolute after:inset-x-0 after:bottom-1.5 after:h-0.5 after:rounded-full after:content-['']",
                    night
                      ? current
                        ? "text-white after:bg-white"
                        : "text-on-night-muted hover:text-white"
                      : current
                        ? "text-kick-blue after:bg-kick-blue"
                        : "text-ink-3 hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="ml-auto flex items-center gap-2 md:gap-3">
        <Link
          href="/programs?focus=search"
          className={cn(
            "hidden h-11 items-center gap-2.5 rounded-full px-4 text-[15px] whitespace-nowrap xl:inline-flex",
            night
              ? "bg-white/10 text-[#D5E0EC] hover:bg-white/15"
              : "border border-line-strong bg-white text-ink-3 hover:border-ink-3",
          )}
        >
          <Search aria-hidden="true" className="size-[18px]" />
          Search programmes or universities
        </Link>
        <Link
          href="/programs?focus=search"
          aria-label="Search programmes or universities"
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-full xl:hidden",
            night ? "text-white hover:bg-white/10" : "text-ink hover:bg-grey-tint",
          )}
        >
          <Search aria-hidden="true" className="size-5" />
        </Link>
        <AvatarMenu user={user} tone={night ? "night" : "light"} />
      </div>
    </header>
  );
}

const TABS = [
  { label: "Home", href: "/dashboard", icon: House, match: (p: string) => p === "/dashboard" },
  { label: "Explore", href: "/programs", icon: Compass, match: isExploreRoute },
  {
    label: "My plan",
    href: "/plan",
    icon: ClipboardList,
    match: (p: string) => ["/plan", "/saved", "/applications"].some((r) => p === r || p.startsWith(`${r}/`)),
  },
  { label: "Profile", href: "/profile", icon: User, match: (p: string) => p.startsWith("/profile") || p.startsWith("/eligibility") },
];

function TabBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex h-16">
        {TABS.map((tab) => {
          const current = tab.match(pathname);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[13px] font-bold",
                  current ? "text-kick-blue" : "text-ink-3",
                )}
              >
                <tab.icon aria-hidden="true" className="size-[22px]" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
