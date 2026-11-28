import Link from "next/link";
import { VarsityFindLogo } from "@/components/kick/varsityfind-logo";

/**
 * Only links to pages that exist (docs/ui-remodel.md §9.11). About, Contact,
 * guides, destinations, Privacy and Terms are hidden until they are written;
 * Privacy and Terms should exist before public launch (flagged, not drafted).
 */
const columns = (inviteOnly: boolean): Array<{ title: string; items: Array<{ label: string; href: string }> }> => [
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
      inviteOnly ? { label: "Join the waitlist", href: "/waitlist" } : { label: "Create a free account", href: "/signup" },
      { label: "Log in", href: "/login" },
    ],
  },
  {
    title: "About the data",
    items: [{ label: "Photo credits", href: "/credits" }],
  },
];

/** `inviteOnly`: sign-up is closed (SIGNUP_MODE=invite), so the account link leads to the waitlist. */
export function LandingFooter({ inviteOnly = false }: { inviteOnly?: boolean }) {
  const COLUMNS = columns(inviteOnly);
  return (
    <footer className="border-t border-line bg-white">
      <div className="px-gutter py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <VarsityFindLogo className="h-7 w-auto" />
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
        <div className="mt-12 border-t border-line pt-6 text-[13px] text-ink-3">© {new Date().getFullYear()} VarsityFind.</div>
      </div>
    </footer>
  );
}
