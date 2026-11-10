import Link from "next/link";

/**
 * Only links to pages that exist (docs/ui-remodel.md §9.11). About, Contact,
 * guides, destinations, Privacy and Terms are hidden until they are written;
 * Privacy and Terms should exist before public launch (flagged, not drafted).
 */
const COLUMNS: Array<{ title: string; items: Array<{ label: string; href: string }> }> = [
  {
    title: "Product",
    items: [
      { label: "Programmes", href: "/signup?next=/programs" },
      { label: "Scholarships", href: "/signup?next=/scholarships" },
      { label: "How it works", href: "#how-it-works" },
    ],
  },
  {
    title: "Your account",
    items: [
      { label: "Create a free account", href: "/signup" },
      { label: "Log in", href: "/login" },
    ],
  },
  {
    title: "About the data",
    items: [{ label: "Photo credits", href: "/credits" }],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="px-gutter py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="font-display text-2xl font-[750] tracking-[-0.03em] text-kick-blue">KickScholar</span>
            <p className="mt-3 max-w-[240px] text-[15px] text-ink-3">Find universities and scholarships you actually qualify for.</p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-[15px] font-bold text-ink">{col.title}</p>
              <ul className="mt-3 space-y-1">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="inline-flex min-h-11 items-center text-[15px] text-ink-3 hover:text-ink">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-line pt-6 text-[13px] text-ink-3">© {new Date().getFullYear()} KickScholar.</div>
      </div>
    </footer>
  );
}
