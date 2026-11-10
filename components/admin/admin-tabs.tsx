"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin", label: "Data quality" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/crawl-jobs", label: "Crawl jobs" },
  { href: "/admin/verification", label: "Verification queue" },
];

/** Admin tabs that mark the current page (docs/ui-remodel.md §9.12). */
export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="mb-8 border-b border-line">
      <ul className="flex flex-wrap gap-x-6">
        {ADMIN_NAV.map((item) => {
          const current = item.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative inline-flex min-h-12 items-center text-[15px] font-bold",
                  "after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:rounded-full after:content-['']",
                  current ? "text-kick-blue after:bg-kick-blue" : "text-ink-3 hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

