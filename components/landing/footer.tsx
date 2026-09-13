import Link from "next/link";

type FooterLink = { label: string; href: string | null };

const PRODUCT: FooterLink[] = [
  { label: "Programs", href: "/programs" },
  { label: "Scholarships", href: "/scholarships" },
  { label: "How it works", href: "#how-it-works" },
];

const RESOURCES: FooterLink[] = [
  { label: "Eligibility", href: "/eligibility" },
  { label: "Guides", href: null },
  { label: "Study destinations", href: null },
];

const COMPANY: FooterLink[] = [
  { label: "About", href: null },
  { label: "Contact", href: null },
];

const LEGAL: FooterLink[] = [
  { label: "Privacy", href: null },
  { label: "Terms", href: null },
];

function FooterColumn({ title, items }: { title: string; items: FooterLink[] }) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.label}>
            {item.href ? (
              <Link
                href={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground/60">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-16 md:px-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <span className="text-lg font-semibold tracking-tight text-kick-blue">
              KickScholar
            </span>
            <p className="mt-3 max-w-[220px] text-sm text-muted-foreground">
              Find universities and scholarships you actually qualify for.
            </p>
          </div>
          <FooterColumn title="Product" items={PRODUCT} />
          <FooterColumn title="Resources" items={RESOURCES} />
          <FooterColumn title="Company" items={COMPANY} />
          <FooterColumn title="Legal" items={LEGAL} />
        </div>
        <div className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} KickScholar.
        </div>
      </div>
    </footer>
  );
}
